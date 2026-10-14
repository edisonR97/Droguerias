import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCountDto } from './counts.dto';
@Injectable()
export class CountsService {
  constructor(private readonly prisma: PrismaService) {}
  list(u: RequestUser) {
    return this.prisma.inventoryCount.findMany({
      where: { establishmentId: u.establishmentId },
      include: {
        branch: true,
        createdBy: { select: { displayName: true } },
        approvedBy: { select: { displayName: true } },
        items: { include: { batch: { include: { product: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async create(u: RequestUser, i: CreateCountDto) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: i.branchId, establishmentId: u.establishmentId, active: true },
      });
      if (!branch) throw new NotFoundException('Sede no encontrada');
      const batches = await tx.inventoryBatch.findMany({
        where: { id: { in: i.items.map((x) => x.batchId) }, branchId: branch.id },
      });
      if (batches.length !== i.items.length)
        throw new NotFoundException('Uno o más lotes no pertenecen a la sede');
      return tx.inventoryCount.create({
        data: {
          establishmentId: u.establishmentId,
          branchId: branch.id,
          createdById: u.id,
          reason: i.reason,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          items: {
            create: i.items.map((x) => {
              const b = batches.find((y) => y.id === x.batchId)!;
              return {
                batchId: b.id,
                expectedQuantity: b.quantity,
                countedQuantity: new Prisma.Decimal(x.countedQuantity),
              };
            }),
          },
        },
        include: { items: { include: { batch: { include: { product: true } } } }, branch: true },
      });
    });
  }
  async approve(u: RequestUser, id: string) {
    const c = await this.prisma.inventoryCount.findFirst({
      where: { id, establishmentId: u.establishmentId, status: 'SUBMITTED' },
    });
    if (!c) throw new NotFoundException('Conteo enviado no encontrado');
    return this.prisma.inventoryCount.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: u.id, approvedAt: new Date() },
    });
  }
  async apply(u: RequestUser, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const c = await tx.inventoryCount.findFirst({
          where: { id, establishmentId: u.establishmentId, status: 'APPROVED' },
          include: { items: { include: { batch: true } } },
        });
        if (!c) throw new NotFoundException('Conteo aprobado no encontrado');
        for (const x of c.items) {
          if (!x.batch.quantity.equals(x.expectedQuantity))
            throw new ConflictException(
              'El inventario cambió después del conteo; debe realizar uno nuevo',
            );
          const variance = x.countedQuantity.minus(x.expectedQuantity);
          if (variance.isZero()) continue;
          await tx.inventoryBatch.update({
            where: { id: x.batchId },
            data: {
              quantity: x.countedQuantity,
              status: x.countedQuantity.isZero() ? 'DEPLETED' : 'AVAILABLE',
            },
          });
          const inv = await tx.branchInventory.update({
            where: { branchId_productId: { branchId: c.branchId, productId: x.batch.productId } },
            data: { onHand: { increment: variance } },
          });
          await tx.inventoryMovement.create({
            data: {
              establishmentId: u.establishmentId,
              branchId: c.branchId,
              productId: x.batch.productId,
              batchId: x.batchId,
              userId: u.id,
              type: variance.isPositive()
                ? InventoryMovementType.ADJUSTMENT_IN
                : InventoryMovementType.ADJUSTMENT_OUT,
              quantity: variance,
              unitCost: x.batch.unitCost,
              balanceAfter: inv.onHand,
              reason: `Conteo físico: ${c.reason}`,
              referenceType: 'INVENTORY_COUNT',
              referenceId: c.id,
              idempotencyKey: `count:${c.id}:${x.id}`,
            },
          });
        }
        const updated = await tx.inventoryCount.update({
          where: { id: c.id },
          data: { status: 'APPLIED', appliedById: u.id, appliedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            establishmentId: u.establishmentId,
            userId: u.id,
            action: 'inventory_count.apply',
            entityType: 'InventoryCount',
            entityId: c.id,
            outcome: 'SUCCESS',
            reason: c.reason,
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
