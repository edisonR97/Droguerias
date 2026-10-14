import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, InventoryMovementType, Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTransferDto } from './transfers.dto';

export function validateTransferDraft(
  originBranchId: string,
  destinationBranchId: string,
  items: Array<{ productId: string; sourceBatchId: string; quantity: number | Prisma.Decimal }>,
) {
  if (originBranchId === destinationBranchId)
    throw new BadRequestException('Origen y destino deben ser diferentes');

  const uniqueBatches = new Set(items.map((item) => item.sourceBatchId));
  if (uniqueBatches.size !== items.length)
    throw new BadRequestException('Cada lote debe aparecer una sola vez en la transferencia');

  for (const item of items) {
    const quantity =
      item.quantity instanceof Prisma.Decimal ? item.quantity : new Prisma.Decimal(item.quantity);
    if (quantity.lte(0)) throw new ConflictException('La cantidad transferida debe ser positiva');
  }

  return true;
}

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}
  context(u: RequestUser) {
    return this.prisma.branch.findMany({
      where: { establishmentId: u.establishmentId, active: true },
      select: { id: true, code: true, name: true },
    });
  }
  list(u: RequestUser) {
    return this.prisma.inventoryTransfer.findMany({
      where: { establishmentId: u.establishmentId },
      include: {
        originBranch: true,
        destinationBranch: true,
        items: { include: { product: true, sourceBatch: true } },
        createdBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async create(u: RequestUser, i: CreateTransferDto) {
    validateTransferDraft(i.originBranchId, i.destinationBranchId, i.items);
    return this.prisma.$transaction(async (tx) => {
      const branches = await tx.branch.count({
        where: {
          id: { in: [i.originBranchId, i.destinationBranchId] },
          establishmentId: u.establishmentId,
          active: true,
        },
      });
      if (branches !== 2) throw new NotFoundException('Sede inválida');
      const uniqueBatches = new Set(i.items.map((item) => item.sourceBatchId));
      if (uniqueBatches.size !== i.items.length)
        throw new BadRequestException('Cada lote debe aparecer una sola vez en la transferencia');
      for (const x of i.items) {
        const batch = await tx.inventoryBatch.findFirst({
          where: {
            id: x.sourceBatchId,
            branchId: i.originBranchId,
            productId: x.productId,
            status: BatchStatus.AVAILABLE,
          },
        });
        if (!batch || batch.quantity.minus(batch.reserved).lt(x.quantity))
          throw new ConflictException('Lote sin existencia suficiente');
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: { reserved: { increment: x.quantity } },
        });
        await tx.branchInventory.update({
          where: {
            branchId_productId: { branchId: i.originBranchId, productId: x.productId },
          },
          data: { reserved: { increment: x.quantity } },
        });
      }
      return tx.inventoryTransfer.create({
        data: {
          establishmentId: u.establishmentId,
          originBranchId: i.originBranchId,
          destinationBranchId: i.destinationBranchId,
          createdById: u.id,
          notes: i.notes ?? null,
          items: {
            create: i.items.map((x) => ({
              productId: x.productId,
              sourceBatchId: x.sourceBatchId,
              quantity: new Prisma.Decimal(x.quantity),
            })),
          },
        },
        include: { items: true, originBranch: true, destinationBranch: true },
      });
    });
  }
  async ship(u: RequestUser, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const t = await tx.inventoryTransfer.findFirst({
          where: { id, establishmentId: u.establishmentId, status: 'DRAFT' },
          include: { items: { include: { sourceBatch: true } } },
        });
        if (!t) throw new NotFoundException('Transferencia en borrador no encontrada');
        for (const x of t.items) {
          const changed = await tx.inventoryBatch.updateMany({
            where: {
              id: x.sourceBatchId,
              quantity: { gte: x.quantity },
              reserved: { gte: x.quantity },
            },
            data: {
              quantity: { decrement: x.quantity },
              reserved: { decrement: x.quantity },
            },
          });
          if (changed.count !== 1)
            throw new ConflictException('Inventario cambió; revise la transferencia');
          const inv = await tx.branchInventory.update({
            where: { branchId_productId: { branchId: t.originBranchId, productId: x.productId } },
            data: {
              onHand: { decrement: x.quantity },
              reserved: { decrement: x.quantity },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              establishmentId: u.establishmentId,
              branchId: t.originBranchId,
              productId: x.productId,
              batchId: x.sourceBatchId,
              userId: u.id,
              type: InventoryMovementType.TRANSFER_OUT,
              quantity: x.quantity.negated(),
              unitCost: x.sourceBatch.unitCost,
              balanceAfter: inv.onHand,
              reason: 'Salida por transferencia',
              referenceType: 'TRANSFER',
              referenceId: t.id,
              idempotencyKey: `transfer-out:${t.id}:${x.id}`,
            },
          });
        }
        return tx.inventoryTransfer.update({
          where: { id: t.id },
          data: { status: 'IN_TRANSIT', shippedById: u.id, shippedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async receive(u: RequestUser, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const t = await tx.inventoryTransfer.findFirst({
          where: { id, establishmentId: u.establishmentId, status: 'IN_TRANSIT' },
          include: { items: { include: { sourceBatch: true } } },
        });
        if (!t) throw new NotFoundException('Transferencia en tránsito no encontrada');
        for (const x of t.items) {
          const source = x.sourceBatch;
          const batch = await tx.inventoryBatch.upsert({
            where: {
              branchId_productId_lotNumber: {
                branchId: t.destinationBranchId,
                productId: x.productId,
                lotNumber: source.lotNumber,
              },
            },
            create: {
              branchId: t.destinationBranchId,
              productId: x.productId,
              supplierId: source.supplierId,
              lotNumber: source.lotNumber,
              expiresAt: source.expiresAt,
              unitCost: source.unitCost,
              quantity: x.quantity,
              status: BatchStatus.AVAILABLE,
            },
            update: { quantity: { increment: x.quantity }, status: BatchStatus.AVAILABLE },
          });
          const inv = await tx.branchInventory.upsert({
            where: {
              branchId_productId: { branchId: t.destinationBranchId, productId: x.productId },
            },
            create: { branchId: t.destinationBranchId, productId: x.productId, onHand: x.quantity },
            update: { onHand: { increment: x.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              establishmentId: u.establishmentId,
              branchId: t.destinationBranchId,
              productId: x.productId,
              batchId: batch.id,
              userId: u.id,
              type: InventoryMovementType.TRANSFER_IN,
              quantity: x.quantity,
              unitCost: source.unitCost,
              balanceAfter: inv.onHand,
              reason: 'Entrada por transferencia',
              referenceType: 'TRANSFER',
              referenceId: t.id,
              idempotencyKey: `transfer-in:${t.id}:${x.id}`,
            },
          });
        }
        return tx.inventoryTransfer.update({
          where: { id: t.id },
          data: { status: 'RECEIVED', receivedById: u.id, receivedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async cancel(u: RequestUser, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const t = await tx.inventoryTransfer.findFirst({
          where: { id, establishmentId: u.establishmentId },
          include: { items: { include: { sourceBatch: true } } },
        });
        if (!t) throw new NotFoundException('Transferencia no encontrada');
        if (t.status === 'CANCELLED') return { transfer: t, idempotent: true };
        if (t.status === 'RECEIVED')
          throw new ConflictException('Una transferencia recibida no puede cancelarse');
        if (t.status === 'DRAFT')
          for (const x of t.items) {
            await tx.inventoryBatch.update({
              where: { id: x.sourceBatchId },
              data: { reserved: { decrement: x.quantity } },
            });
            await tx.branchInventory.update({
              where: {
                branchId_productId: {
                  branchId: t.originBranchId,
                  productId: x.productId,
                },
              },
              data: { reserved: { decrement: x.quantity } },
            });
          }
        if (t.status === 'IN_TRANSIT')
          for (const x of t.items) {
            await tx.inventoryBatch.update({
              where: { id: x.sourceBatchId },
              data: { quantity: { increment: x.quantity }, status: BatchStatus.AVAILABLE },
            });
            const inv = await tx.branchInventory.update({
              where: { branchId_productId: { branchId: t.originBranchId, productId: x.productId } },
              data: { onHand: { increment: x.quantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                establishmentId: u.establishmentId,
                branchId: t.originBranchId,
                productId: x.productId,
                batchId: x.sourceBatchId,
                userId: u.id,
                type: InventoryMovementType.TRANSFER_IN,
                quantity: x.quantity,
                unitCost: x.sourceBatch.unitCost,
                balanceAfter: inv.onHand,
                reason: 'Cancelación de transferencia en tránsito',
                referenceType: 'TRANSFER_CANCEL',
                referenceId: t.id,
                idempotencyKey: `transfer-cancel:${t.id}:${x.id}`,
              },
            });
          }
        const updated = await tx.inventoryTransfer.update({
          where: { id: t.id },
          data: { status: 'CANCELLED' },
        });
        await tx.auditLog.create({
          data: {
            establishmentId: u.establishmentId,
            userId: u.id,
            action: 'transfer.cancel',
            entityType: 'InventoryTransfer',
            entityId: t.id,
            outcome: 'SUCCESS',
          },
        });
        return { transfer: updated, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
