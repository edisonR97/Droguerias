import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { postAutomaticEntry } from '../accounting/automatic-entry';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReturnDto } from './returns.dto';

export function validateReturnRequest(
  quantity: Prisma.Decimal,
  soldQuantity: Prisma.Decimal,
  reason: string,
  idempotencyKey: string,
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new BadRequestException('Debe indicar el motivo de la devolución');
  if (!idempotencyKey.trim())
    throw new BadRequestException('Debe indicar una clave de idempotencia');
  if (quantity.lte(0)) throw new BadRequestException('La cantidad devuelta debe ser mayor a cero');
  if (quantity.gt(soldQuantity))
    throw new ConflictException('La devolución supera la cantidad vendida');
  return true;
}

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}
  list(u: RequestUser) {
    return this.prisma.saleReturn.findMany({
      where: { establishmentId: u.establishmentId },
      include: {
        sale: true,
        user: { select: { displayName: true } },
        items: { include: { saleItem: { include: { product: true } }, allocations: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async create(u: RequestUser, i: CreateReturnDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.saleReturn.findUnique({
          where: {
            establishmentId_idempotencyKey: {
              establishmentId: u.establishmentId,
              idempotencyKey: i.idempotencyKey,
            },
          },
          include: { items: true },
        });
        if (duplicate) return { return: duplicate, idempotent: true };
        const sale = await tx.sale.findFirst({
          where: { id: i.saleId, establishmentId: u.establishmentId, status: 'COMPLETED' },
          include: {
            items: { include: { allocations: { include: { returnAllocations: true } } } },
            receivable: true,
          },
        });
        if (!sale) throw new NotFoundException('Venta completada no encontrada');
        const prepared = [];
        for (const requested of i.items) {
          const item = sale.items.find((x) => x.id === requested.saleItemId);
          if (!item) throw new NotFoundException('Ítem no pertenece a la venta');
          const quantity = new Prisma.Decimal(requested.quantity);
          const returned = item.allocations
            .flatMap((a) => a.returnAllocations)
            .reduce((s, a) => s.plus(a.quantity), new Prisma.Decimal(0));
          validateReturnRequest(
            quantity,
            item.quantity.minus(returned),
            i.reason,
            i.idempotencyKey,
          );
          let remaining = quantity;
          const allocations = [];
          for (const original of item.allocations) {
            const used = original.returnAllocations.reduce(
              (s, a) => s.plus(a.quantity),
              new Prisma.Decimal(0),
            );
            const available = original.quantity.minus(used);
            if (available.lte(0)) continue;
            const take = available.lt(remaining) ? available : remaining;
            allocations.push({ original, take });
            remaining = remaining.minus(take);
            if (remaining.lte(0)) break;
          }
          if (remaining.gt(0))
            throw new ConflictException('No hay asignaciones disponibles para devolver');
          prepared.push({
            item,
            quantity,
            amount: item.unitPrice.mul(quantity).toDecimalPlaces(2),
            subtotal: item.taxRate.gt(0)
              ? item.unitPrice
                  .mul(quantity)
                  .div(new Prisma.Decimal(1).plus(item.taxRate.div(100)))
                  .toDecimalPlaces(2)
              : item.unitPrice.mul(quantity).toDecimalPlaces(2),
            allocations,
          });
        }
        const total = prepared.reduce((s, x) => s.plus(x.amount), new Prisma.Decimal(0));
        const ret = await tx.saleReturn.create({
          data: {
            establishmentId: u.establishmentId,
            saleId: sale.id,
            userId: u.id,
            reason: i.reason,
            total,
            idempotencyKey: i.idempotencyKey,
          },
        });
        for (const p of prepared) {
          const ri = await tx.saleReturnItem.create({
            data: {
              saleReturnId: ret.id,
              saleItemId: p.item.id,
              quantity: p.quantity,
              amount: p.amount,
            },
          });
          for (const a of p.allocations) {
            await tx.saleReturnAllocation.create({
              data: {
                saleReturnItemId: ri.id,
                saleItemId: p.item.id,
                batchId: a.original.batchId,
                quantity: a.take,
              },
            });
            await tx.inventoryBatch.update({
              where: { id: a.original.batchId },
              data: { quantity: { increment: a.take }, status: 'AVAILABLE' },
            });
            const inv = await tx.branchInventory.update({
              where: {
                branchId_productId: { branchId: sale.branchId, productId: p.item.productId },
              },
              data: { onHand: { increment: a.take } },
            });
            await tx.inventoryMovement.create({
              data: {
                establishmentId: u.establishmentId,
                branchId: sale.branchId,
                productId: p.item.productId,
                batchId: a.original.batchId,
                userId: u.id,
                type: InventoryMovementType.RETURN_IN,
                quantity: a.take,
                unitCost: a.original.unitCost,
                balanceAfter: inv.onHand,
                reason: `Devolución: ${i.reason}`,
                referenceType: 'SALE_RETURN',
                referenceId: ret.id,
                idempotencyKey: `return:${ret.id}:${a.original.batchId}`,
              },
            });
          }
        }
        const subtotal = prepared.reduce(
          (sum, item) => sum.plus(item.subtotal),
          new Prisma.Decimal(0),
        );
        const tax = total.minus(subtotal);
        const cost = prepared.reduce(
          (sum, item) =>
            sum.plus(
              item.allocations.reduce(
                (lineCost, allocation) =>
                  lineCost.plus(allocation.take.mul(allocation.original.unitCost)),
                new Prisma.Decimal(0),
              ),
            ),
          new Prisma.Decimal(0),
        );
        const receivableCredit = sale.receivable
          ? Prisma.Decimal.min(sale.receivable.balance, total)
          : new Prisma.Decimal(0);
        const cashRefund = total.minus(receivableCredit);
        if (sale.receivable && receivableCredit.gt(0)) {
          const balance = sale.receivable.balance.minus(receivableCredit);
          const originalAmount = Prisma.Decimal.max(
            sale.receivable.originalAmount.minus(total),
            new Prisma.Decimal(0),
          );
          await tx.accountReceivable.update({
            where: { id: sale.receivable.id },
            data: {
              balance,
              originalAmount,
              status: balance.isZero()
                ? 'PAID'
                : balance.equals(originalAmount)
                  ? 'OPEN'
                  : 'PARTIALLY_PAID',
            },
          });
        }
        await postAutomaticEntry(tx, {
          establishmentId: u.establishmentId,
          userId: u.id,
          description: `Devolución de venta #${ret.number.toString()}`,
          referenceType: 'SALE_RETURN',
          referenceId: ret.id,
          lines: [
            { code: '417501', debit: subtotal, description: 'Devolución en ventas' },
            { code: '240801', debit: tax, description: 'Reversión de IVA generado' },
            {
              code: '130505',
              credit: receivableCredit,
              description: 'Disminución de cuenta por cobrar',
            },
            { code: '110505', credit: cashRefund, description: 'Reembolso al cliente' },
            { code: '143501', debit: cost, description: 'Reingreso de inventario' },
            { code: '613501', credit: cost, description: 'Reversión del costo de venta' },
          ],
        });
        await tx.auditLog.create({
          data: {
            establishmentId: u.establishmentId,
            userId: u.id,
            action: 'sale.return',
            entityType: 'SaleReturn',
            entityId: ret.id,
            outcome: 'SUCCESS',
            reason: i.reason,
            metadata: { total: total.toString() },
          },
        });
        return {
          return: await tx.saleReturn.findUniqueOrThrow({
            where: { id: ret.id },
            include: { items: { include: { allocations: true } } },
          }),
          idempotent: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
