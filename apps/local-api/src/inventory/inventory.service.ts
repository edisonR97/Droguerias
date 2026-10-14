import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, InventoryMovementType, Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { FefoQueryDto, InventoryQueryDto, ReceiveInventoryDto } from './inventory.dto';
import { allocateFefo } from './fefo';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async receive(user: RequestUser, input: ReceiveInventoryDto) {
    if (input.expiresAt <= new Date())
      throw new BadRequestException('No se puede recibir un lote vencido');
    const quantity = new Prisma.Decimal(input.quantity);
    const incomingCost = new Prisma.Decimal(input.unitCost);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.inventoryMovement.findUnique({
            where: {
              establishmentId_idempotencyKey: {
                establishmentId: user.establishmentId,
                idempotencyKey: input.idempotencyKey,
              },
            },
            include: { batch: true },
          });
          if (duplicate) return { movement: duplicate, batch: duplicate.batch, idempotent: true };
          const [branch, product] = await Promise.all([
            tx.branch.findFirst({
              where: { id: input.branchId, establishmentId: user.establishmentId, active: true },
            }),
            tx.product.findFirst({
              where: {
                id: input.productId,
                establishmentId: user.establishmentId,
                status: 'ACTIVE',
              },
            }),
          ]);
          if (!branch || !product)
            throw new NotFoundException('Sede o producto inexistente/inactivo');
          if (
            input.locationId &&
            !(await tx.warehouseLocation.findFirst({
              where: { id: input.locationId, branchId: branch.id, active: true },
            }))
          )
            throw new NotFoundException('Ubicación inválida');
          if (
            input.supplierId &&
            !(await tx.supplier.findFirst({
              where: { id: input.supplierId, establishmentId: user.establishmentId, active: true },
            }))
          )
            throw new NotFoundException('Proveedor inválido');

          const existing = await tx.inventoryBatch.findUnique({
            where: {
              branchId_productId_lotNumber: {
                branchId: branch.id,
                productId: product.id,
                lotNumber: input.lotNumber.trim().toUpperCase(),
              },
            },
          });
          const batch = existing
            ? await tx.inventoryBatch.update({
                where: { id: existing.id },
                data: {
                  quantity: { increment: quantity },
                  unitCost: existing.quantity
                    .mul(existing.unitCost)
                    .plus(quantity.mul(incomingCost))
                    .div(existing.quantity.plus(quantity)),
                  expiresAt: input.expiresAt,
                  supplierId: input.supplierId ?? null,
                  locationId: input.locationId ?? null,
                  status: BatchStatus.AVAILABLE,
                },
              })
            : await tx.inventoryBatch.create({
                data: {
                  branchId: branch.id,
                  productId: product.id,
                  supplierId: input.supplierId ?? null,
                  locationId: input.locationId ?? null,
                  lotNumber: input.lotNumber.trim().toUpperCase(),
                  expiresAt: input.expiresAt,
                  unitCost: incomingCost,
                  quantity,
                  status: BatchStatus.AVAILABLE,
                },
              });
          const inventory = await tx.branchInventory.upsert({
            where: { branchId_productId: { branchId: branch.id, productId: product.id } },
            create: { branchId: branch.id, productId: product.id, onHand: quantity },
            update: { onHand: { increment: quantity } },
          });
          const movement = await tx.inventoryMovement.create({
            data: {
              establishmentId: user.establishmentId,
              branchId: branch.id,
              productId: product.id,
              batchId: batch.id,
              userId: user.id,
              type: InventoryMovementType.RECEIPT,
              quantity,
              unitCost: incomingCost,
              balanceAfter: inventory.onHand,
              reason: input.reason,
              referenceType: input.referenceType ?? null,
              referenceId: input.referenceId ?? null,
              idempotencyKey: input.idempotencyKey,
            },
          });
          await tx.auditLog.create({
            data: {
              establishmentId: user.establishmentId,
              userId: user.id,
              action: 'inventory.receive',
              entityType: 'InventoryBatch',
              entityId: batch.id,
              outcome: 'SUCCESS',
              metadata: { movementId: movement.id.toString(), quantity: quantity.toString() },
            },
          });
          return { movement, batch, inventory, idempotent: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Operación duplicada o lote ya registrado');
      throw error;
    }
  }

  async fefo(user: RequestUser, input: FefoQueryDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, establishmentId: user.establishmentId, status: 'ACTIVE' },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        branchId: input.branchId,
        productId: input.productId,
        status: BatchStatus.AVAILABLE,
        expiresAt: { gt: new Date() },
        quantity: { gt: 0 },
      },
      orderBy: [{ expiresAt: 'asc' }, { receivedAt: 'asc' }],
    });
    const { allocations, remaining } = allocateFefo(batches, new Prisma.Decimal(input.quantity));
    if (remaining.gt(0))
      throw new ConflictException(
        `Existencia vendible insuficiente. Faltan ${remaining.toString()} unidades`,
      );
    return { productId: product.id, requested: String(input.quantity), allocations };
  }

  async kardex(user: RequestUser, query: InventoryQueryDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: query.branchId, establishmentId: user.establishmentId },
    });
    if (!branch) throw new NotFoundException('Sede no encontrada');
    return this.prisma.inventoryMovement.findMany({
      where: {
        establishmentId: user.establishmentId,
        branchId: branch.id,
        ...(query.productId ? { productId: query.productId } : {}),
      },
      include: { product: true, batch: true, user: { select: { id: true, displayName: true } } },
      orderBy: { occurredAt: 'desc' },
      skip: (query.page - 1) * query.quantity,
      take: Math.min(query.quantity, 100),
    });
  }

  async expirySummary(user: RequestUser, branchId?: string) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 180);
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        branch: { establishmentId: user.establishmentId },
        ...(branchId ? { branchId } : {}),
        quantity: { gt: 0 },
        expiresAt: { lte: horizon },
      },
      include: { product: true, supplier: true, location: true, branch: true },
      orderBy: { expiresAt: 'asc' },
    });
    const now = new Date();
    return batches.map((batch) => {
      const daysRemaining = Math.ceil((batch.expiresAt.getTime() - now.getTime()) / 86_400_000);
      return {
        ...batch,
        daysRemaining,
        inventoryValue: batch.quantity.mul(batch.unitCost).toFixed(2),
        classification:
          daysRemaining < 0
            ? 'EXPIRED'
            : daysRemaining <= 7
              ? 'DAYS_7'
              : daysRemaining <= 15
                ? 'DAYS_15'
                : daysRemaining <= 30
                  ? 'DAYS_30'
                  : daysRemaining <= 60
                    ? 'DAYS_60'
                    : daysRemaining <= 90
                      ? 'DAYS_90'
                      : 'DAYS_180',
      };
    });
  }
}
