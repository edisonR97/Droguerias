import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BatchStatus,
  InventoryMovementType,
  PaymentMethod,
  Prisma,
  type Product,
} from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { allocateFefo } from '../inventory/fefo';
import { PrismaService } from '../prisma/prisma.service';
import { postAutomaticEntry, reverseAutomaticEntry } from '../accounting/automatic-entry';
import type { CheckoutDto, CloseCashSessionDto, OpenCashSessionDto, VoidSaleDto } from './pos.dto';

export function validateCashSessionAmount(amount: Prisma.Decimal, isOpening = false) {
  if (amount.lt(0)) throw new BadRequestException('El monto de caja no puede ser negativo');
  if (isOpening && amount.isZero())
    throw new BadRequestException('La apertura de caja debe tener un monto inicial');
  return true;
}

export function validateCheckoutAmounts(
  paymentMethod: PaymentMethod,
  receivedAmount: number | Prisma.Decimal,
  total: Prisma.Decimal,
) {
  const amount =
    receivedAmount instanceof Prisma.Decimal ? receivedAmount : new Prisma.Decimal(receivedAmount);

  if (paymentMethod === PaymentMethod.CREDIT && amount.gt(0))
    throw new BadRequestException('Las ventas a crédito no deben incluir efectivo recibido');

  if (paymentMethod === PaymentMethod.CASH && amount.lt(total))
    throw new BadRequestException('El efectivo recibido es inferior al total');

  return true;
}

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async openCash(user: RequestUser, input: OpenCashSessionDto) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: input.branchId, establishmentId: user.establishmentId, active: true },
    });
    if (!branch) throw new NotFoundException('Sede no encontrada');
    const openingAmount = new Prisma.Decimal(input.openingAmount);
    validateCashSessionAmount(openingAmount, true);
    const existing = await this.prisma.cashSession.findFirst({
      where: {
        establishmentId: user.establishmentId,
        branchId: branch.id,
        openedById: user.id,
        status: 'OPEN',
      },
    });
    if (existing) return existing;
    return this.prisma.cashSession.create({
      data: {
        establishmentId: user.establishmentId,
        branchId: branch.id,
        openedById: user.id,
        openingAmount,
      },
    });
  }

  getOpenCash(user: RequestUser, branchId: string) {
    return this.prisma.cashSession.findFirst({
      where: {
        establishmentId: user.establishmentId,
        branchId,
        openedById: user.id,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async receipt(user: RequestUser, id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, establishmentId: user.establishmentId },
      include: {
        branch: true,
        user: { select: { displayName: true } },
        customer: true,
        items: { include: { product: true, allocations: { include: { batch: true } } } },
      },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  async salesHistory(user: RequestUser, search = '') {
    const where: Prisma.SaleWhereInput = {
      establishmentId: user.establishmentId,
      ...(search
        ? {
            OR: [
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { customer: { documentNumber: { contains: search } } },
            ],
          }
        : {}),
    };
    return this.prisma.sale.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, displayName: true } },
        customer: true,
        items: {
          include: { product: { select: { id: true, internalCode: true, commercialName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  cashHistory(user: RequestUser) {
    return this.prisma.cashSession.findMany({
      where: { establishmentId: user.establishmentId },
      include: {
        branch: { select: { id: true, name: true } },
        openedBy: { select: { id: true, displayName: true } },
        closedBy: { select: { id: true, displayName: true } },
        sales: { where: { status: 'COMPLETED' }, select: { total: true, paymentMethod: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
  }

  async closeCash(user: RequestUser, id: string, input: CloseCashSessionDto) {
    return this.prisma.$transaction(async (tx) => {
      const cash = await tx.cashSession.findFirst({
        where: { id, establishmentId: user.establishmentId, openedById: user.id, status: 'OPEN' },
      });
      if (!cash) throw new NotFoundException('Sesión de caja abierta no encontrada');
      const sales = await tx.sale.aggregate({
        where: { cashSessionId: cash.id, status: 'COMPLETED', paymentMethod: 'CASH' },
        _sum: { total: true },
      });
      const expected = cash.openingAmount.plus(sales._sum.total ?? 0);
      const closing = new Prisma.Decimal(input.closingAmount);
      validateCashSessionAmount(closing);
      const closed = await tx.cashSession.update({
        where: { id: cash.id },
        data: {
          status: 'CLOSED',
          closingAmount: closing,
          expectedAmount: expected,
          closedById: user.id,
          closedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          establishmentId: user.establishmentId,
          userId: user.id,
          action: 'cash.close',
          entityType: 'CashSession',
          entityId: cash.id,
          outcome: 'SUCCESS',
          metadata: {
            expected: expected.toString(),
            closing: closing.toString(),
            difference: closing.minus(expected).toString(),
          },
        },
      });
      return { ...closed, difference: closing.minus(expected).toFixed(2) };
    });
  }

  async voidSale(user: RequestUser, id: string, input: VoidSaleDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findFirst({
          where: { id, establishmentId: user.establishmentId },
          include: { cashSession: true, items: { include: { allocations: true } } },
        });
        if (!sale) throw new NotFoundException('Venta no encontrada');
        if (sale.status === 'VOIDED') return { sale, idempotent: true };
        const receivable = await tx.accountReceivable.findUnique({ where: { saleId: sale.id } });
        if (receivable && !receivable.balance.equals(receivable.originalAmount))
          throw new ConflictException(
            'No se puede anular una venta a crédito con abonos registrados',
          );
        if (sale.cashSession.status !== 'OPEN')
          throw new ConflictException('No se puede anular una venta de una caja cerrada');
        for (const item of sale.items)
          for (const allocation of item.allocations) {
            await tx.inventoryBatch.update({
              where: { id: allocation.batchId },
              data: { quantity: { increment: allocation.quantity }, status: BatchStatus.AVAILABLE },
            });
            const inventory = await tx.branchInventory.update({
              where: { branchId_productId: { branchId: sale.branchId, productId: item.productId } },
              data: { onHand: { increment: allocation.quantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                establishmentId: user.establishmentId,
                branchId: sale.branchId,
                productId: item.productId,
                batchId: allocation.batchId,
                userId: user.id,
                type: InventoryMovementType.RETURN_IN,
                quantity: allocation.quantity,
                unitCost: allocation.unitCost,
                balanceAfter: inventory.onHand,
                reason: `Anulación: ${input.reason}`,
                referenceType: 'SALE_VOID',
                referenceId: sale.id,
                idempotencyKey: `void:${sale.id}:${allocation.batchId}`,
              },
            });
          }
        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: 'VOIDED',
            voidedAt: new Date(),
            voidedById: user.id,
            voidReason: input.reason,
          },
        });
        if (receivable)
          await tx.accountReceivable.update({
            where: { id: receivable.id },
            data: { balance: 0, status: 'CANCELLED' },
          });
        await reverseAutomaticEntry(tx, {
          establishmentId: user.establishmentId,
          userId: user.id,
          referenceType: 'SALE',
          referenceId: sale.id,
          reason: input.reason,
        });
        await tx.auditLog.create({
          data: {
            establishmentId: user.establishmentId,
            userId: user.id,
            action: 'sale.void',
            entityType: 'Sale',
            entityId: sale.id,
            outcome: 'SUCCESS',
            reason: input.reason,
          },
        });
        return { sale: updated, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async checkout(user: RequestUser, input: CheckoutDto) {
    const grouped = new Map<string, Prisma.Decimal>();
    for (const item of input.items)
      grouped.set(
        item.productId,
        (grouped.get(item.productId) ?? new Prisma.Decimal(0)).plus(item.quantity),
      );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.sale.findUnique({
            where: {
              establishmentId_idempotencyKey: {
                establishmentId: user.establishmentId,
                idempotencyKey: input.idempotencyKey,
              },
            },
            include: { items: { include: { product: true, allocations: true } } },
          });
          if (duplicate) return { sale: duplicate, idempotent: true };
          const cash = await tx.cashSession.findFirst({
            where: {
              id: input.cashSessionId,
              establishmentId: user.establishmentId,
              branchId: input.branchId,
              openedById: user.id,
              status: 'OPEN',
            },
          });
          if (!cash) throw new ConflictException('Debe abrir una sesión de caja en esta sede');
          if (
            input.customerId &&
            !(await tx.customer.findFirst({
              where: { id: input.customerId, establishmentId: user.establishmentId, active: true },
            }))
          )
            throw new NotFoundException('Cliente no encontrado');
          if (input.paymentMethod === PaymentMethod.CREDIT && !input.customerId)
            throw new BadRequestException('Las ventas a crédito requieren un cliente identificado');

          const lines: Array<{
            product: Product;
            quantity: Prisma.Decimal;
            allocations: ReturnType<typeof allocateFefo>['allocations'];
            subtotal: Prisma.Decimal;
            tax: Prisma.Decimal;
            total: Prisma.Decimal;
          }> = [];
          for (const [productId, quantity] of grouped) {
            const product = await tx.product.findFirst({
              where: { id: productId, establishmentId: user.establishmentId, status: 'ACTIVE' },
            });
            if (!product) throw new NotFoundException('Producto no encontrado o inactivo');
            const batches = await tx.inventoryBatch.findMany({
              where: {
                branchId: input.branchId,
                productId,
                status: BatchStatus.AVAILABLE,
                expiresAt: { gt: new Date() },
                quantity: { gt: 0 },
              },
              orderBy: [{ expiresAt: 'asc' }, { receivedAt: 'asc' }],
            });
            const allocation = allocateFefo(batches, quantity);
            if (allocation.remaining.gt(0))
              throw new ConflictException(
                `Existencia insuficiente para ${product.commercialName}; faltan ${allocation.remaining.toString()}`,
              );
            const total = product.salePrice.mul(quantity).toDecimalPlaces(2);
            const subtotal = product.taxRate.gt(0)
              ? total.div(new Prisma.Decimal(1).plus(product.taxRate.div(100))).toDecimalPlaces(2)
              : total;
            lines.push({
              product,
              quantity,
              allocations: allocation.allocations,
              subtotal,
              tax: total.minus(subtotal),
              total,
            });
          }
          const subtotal = lines.reduce(
            (sum, line) => sum.plus(line.subtotal),
            new Prisma.Decimal(0),
          );
          const tax = lines.reduce((sum, line) => sum.plus(line.tax), new Prisma.Decimal(0));
          const total = lines.reduce((sum, line) => sum.plus(line.total), new Prisma.Decimal(0));
          validateCheckoutAmounts(input.paymentMethod, input.receivedAmount, total);
          const received =
            input.paymentMethod === PaymentMethod.CREDIT
              ? new Prisma.Decimal(0)
              : new Prisma.Decimal(input.receivedAmount);
          const sale = await tx.sale.create({
            data: {
              establishmentId: user.establishmentId,
              branchId: input.branchId,
              cashSessionId: cash.id,
              userId: user.id,
              customerId: input.customerId ?? null,
              paymentMethod: input.paymentMethod,
              subtotal,
              tax,
              total,
              receivedAmount: received,
              changeAmount:
                input.paymentMethod === PaymentMethod.CREDIT
                  ? new Prisma.Decimal(0)
                  : received.minus(total),
              idempotencyKey: input.idempotencyKey,
            },
          });
          await tx.electronicDocument.create({
            data: {
              establishmentId: user.establishmentId,
              saleId: sale.id,
              type: input.documentType ?? 'POS_EQUIVALENT',
              provider: process.env.EINVOICE_PROVIDER?.trim() || 'GENERIC_REST',
              idempotencyKey: `sale:${sale.id}`,
            },
          });
          for (const line of lines) {
            const saleItem = await tx.saleItem.create({
              data: {
                saleId: sale.id,
                productId: line.product.id,
                quantity: line.quantity,
                unitPrice: line.product.salePrice,
                taxRate: line.product.taxRate,
                subtotal: line.subtotal,
                tax: line.tax,
                total: line.total,
              },
            });
            for (const allocation of line.allocations) {
              const quantity = new Prisma.Decimal(allocation.quantity);
              const updated = await tx.inventoryBatch.updateMany({
                where: { id: allocation.batchId, quantity: { gte: quantity } },
                data: { quantity: { decrement: quantity } },
              });
              if (updated.count !== 1)
                throw new ConflictException(
                  'El inventario cambió durante la venta; intente nuevamente',
                );
              const inventory = await tx.branchInventory.update({
                where: {
                  branchId_productId: { branchId: input.branchId, productId: line.product.id },
                },
                data: { onHand: { decrement: quantity } },
              });
              await tx.saleItemAllocation.create({
                data: {
                  saleItemId: saleItem.id,
                  batchId: allocation.batchId,
                  quantity,
                  unitCost: new Prisma.Decimal(allocation.unitCost),
                },
              });
              await tx.inventoryMovement.create({
                data: {
                  establishmentId: user.establishmentId,
                  branchId: input.branchId,
                  productId: line.product.id,
                  batchId: allocation.batchId,
                  userId: user.id,
                  type: InventoryMovementType.SALE,
                  quantity: quantity.negated(),
                  unitCost: new Prisma.Decimal(allocation.unitCost),
                  balanceAfter: inventory.onHand,
                  reason: 'Venta POS',
                  referenceType: 'SALE',
                  referenceId: sale.id,
                  idempotencyKey: `${input.idempotencyKey}:${allocation.batchId}`,
                },
              });
            }
          }
          const cost = lines.reduce(
            (sum, line) =>
              sum.plus(
                line.allocations.reduce(
                  (lineCost, allocation) =>
                    lineCost.plus(new Prisma.Decimal(allocation.quantity).mul(allocation.unitCost)),
                  new Prisma.Decimal(0),
                ),
              ),
            new Prisma.Decimal(0),
          );
          await postAutomaticEntry(tx, {
            establishmentId: user.establishmentId,
            userId: user.id,
            description: `Venta POS #${sale.number.toString()}`,
            referenceType: 'SALE',
            referenceId: sale.id,
            lines: [
              {
                code: input.paymentMethod === PaymentMethod.CREDIT ? '130505' : '110505',
                debit: total,
                description:
                  input.paymentMethod === PaymentMethod.CREDIT
                    ? 'Cuenta por cobrar al cliente'
                    : 'Ingreso recibido',
              },
              { code: '413501', credit: subtotal, description: 'Venta de mercancías' },
              { code: '240801', credit: tax, description: 'IVA generado' },
              { code: '613501', debit: cost, description: 'Costo de venta' },
              { code: '143501', credit: cost, description: 'Salida de inventario' },
            ],
          });
          if (input.paymentMethod === PaymentMethod.CREDIT) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            await tx.accountReceivable.create({
              data: {
                establishmentId: user.establishmentId,
                customerId: input.customerId!,
                saleId: sale.id,
                originalAmount: total,
                balance: total,
                dueDate,
              },
            });
          }
          await tx.auditLog.create({
            data: {
              establishmentId: user.establishmentId,
              userId: user.id,
              action: 'sale.complete',
              entityType: 'Sale',
              entityId: sale.id,
              outcome: 'SUCCESS',
              metadata: { total: total.toString(), items: lines.length },
            },
          });
          return {
            sale: await tx.sale.findUniqueOrThrow({
              where: { id: sale.id },
              include: { items: { include: { product: true, allocations: true } } },
            }),
            idempotent: false,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('La operación ya fue registrada');
      throw error;
    }
  }

  async context(user: RequestUser) {
    return {
      branches: await this.prisma.branch.findMany({
        where: { establishmentId: user.establishmentId, active: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
    };
  }
}
