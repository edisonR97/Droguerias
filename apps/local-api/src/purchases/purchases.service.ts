import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BatchStatus, InventoryMovementType, Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { postAutomaticEntry } from '../accounting/automatic-entry';
import type {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  ReceivePurchaseDto,
} from './purchases.dto';

export function validateSupplierPayload(input: {
  taxId: string;
  legalName: string;
  tradeName?: string;
}) {
  const taxId = input.taxId.trim();
  const legalName = input.legalName.trim();
  const tradeName = input.tradeName?.trim();

  if (!taxId) throw new BadRequestException('Debe indicar el NIT o documento del proveedor');
  if (!legalName) throw new BadRequestException('Debe indicar la razón social del proveedor');

  return {
    taxId,
    legalName,
    tradeName: tradeName ?? null,
  };
}

export function validatePurchaseReceiptLine(
  quantity: Prisma.Decimal,
  pending: Prisma.Decimal,
  expiresAt: Date,
  lotNumber: string,
) {
  const trimmedLot = lotNumber.trim();
  if (!trimmedLot) throw new BadRequestException('Debe indicar un número de lote');
  if (quantity.lte(0)) throw new BadRequestException('La cantidad recibida debe ser mayor a cero');
  if (expiresAt <= new Date()) throw new BadRequestException('No se reciben lotes vencidos');
  if (quantity.gt(pending))
    throw new ConflictException('La recepción supera la cantidad pendiente');
  return true;
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}
  context(user: RequestUser) {
    return Promise.all([
      this.prisma.branch.findMany({
        where: { establishmentId: user.establishmentId, active: true },
        select: { id: true, name: true },
      }),
      this.prisma.supplier.findMany({
        where: { establishmentId: user.establishmentId, active: true },
        orderBy: { legalName: 'asc' },
      }),
    ]).then(([branches, suppliers]) => ({ branches, suppliers }));
  }
  list(user: RequestUser) {
    return this.prisma.purchaseOrder.findMany({
      where: { establishmentId: user.establishmentId },
      include: {
        branch: true,
        supplier: true,
        createdBy: { select: { displayName: true } },
        approvedBy: { select: { displayName: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async createSupplier(user: RequestUser, input: CreateSupplierDto) {
    const normalized = validateSupplierPayload(input);
    try {
      return await this.prisma.supplier.create({
        data: {
          ...input,
          establishmentId: user.establishmentId,
          taxId: normalized.taxId,
          legalName: normalized.legalName,
          tradeName: normalized.tradeName,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('El proveedor ya existe');
      throw error;
    }
  }
  async create(user: RequestUser, input: CreatePurchaseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const [branch, supplier] = await Promise.all([
        tx.branch.findFirst({
          where: { id: input.branchId, establishmentId: user.establishmentId, active: true },
        }),
        tx.supplier.findFirst({
          where: { id: input.supplierId, establishmentId: user.establishmentId, active: true },
        }),
      ]);
      if (!branch || !supplier) throw new NotFoundException('Sede o proveedor no encontrado');
      const ids = [...new Set(input.items.map((i) => i.productId))];
      if (ids.length !== input.items.length)
        throw new BadRequestException('No repita productos en la orden');
      const products = await tx.product.findMany({
        where: { id: { in: ids }, establishmentId: user.establishmentId, status: 'ACTIVE' },
      });
      if (products.length !== ids.length)
        throw new NotFoundException('Uno o más productos no existen');
      const lines = input.items.map((i) => {
        const quantity = new Prisma.Decimal(i.quantity),
          cost = new Prisma.Decimal(i.unitCost),
          rate = new Prisma.Decimal(i.taxRate),
          subtotal = quantity.mul(cost).toDecimalPlaces(2),
          tax = subtotal.mul(rate).div(100).toDecimalPlaces(2);
        return { ...i, quantity, cost, rate, subtotal, tax, total: subtotal.plus(tax) };
      });
      const subtotal = lines.reduce((s, l) => s.plus(l.subtotal), new Prisma.Decimal(0)),
        tax = lines.reduce((s, l) => s.plus(l.tax), new Prisma.Decimal(0));
      const order = await tx.purchaseOrder.create({
        data: {
          establishmentId: user.establishmentId,
          branchId: branch.id,
          supplierId: supplier.id,
          createdById: user.id,
          expectedAt: input.expectedAt ?? null,
          notes: input.notes ?? null,
          subtotal,
          tax,
          total: subtotal.plus(tax),
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              orderedQuantity: l.quantity,
              unitCost: l.cost,
              taxRate: l.rate,
              subtotal: l.subtotal,
              tax: l.tax,
              total: l.total,
            })),
          },
        },
        include: { items: { include: { product: true } }, supplier: true, branch: true },
      });
      await tx.auditLog.create({
        data: {
          establishmentId: user.establishmentId,
          userId: user.id,
          action: 'purchase.create',
          entityType: 'PurchaseOrder',
          entityId: order.id,
          outcome: 'SUCCESS',
        },
      });
      return order;
    });
  }
  async approve(user: RequestUser, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, establishmentId: user.establishmentId },
    });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status !== 'DRAFT')
      throw new ConflictException('Solo se aprueban órdenes en borrador');
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: user.id, approvedAt: new Date() },
    });
  }
  async receive(user: RequestUser, id: string, input: ReceivePurchaseDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.purchaseOrder.findFirst({
          where: {
            id,
            establishmentId: user.establishmentId,
            status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] },
          },
          include: { items: true },
        });
        if (!order) throw new NotFoundException('Orden aprobada no encontrada');
        const duplicate = await tx.inventoryMovement.findFirst({
          where: {
            establishmentId: user.establishmentId,
            idempotencyKey: { startsWith: input.idempotencyKey },
          },
        });
        if (duplicate) return { order, idempotent: true };
        let receivedSubtotal = new Prisma.Decimal(0);
        let receivedTax = new Prisma.Decimal(0);
        for (const received of input.items) {
          const item = order.items.find((i) => i.id === received.itemId);
          if (!item) throw new BadRequestException('Ítem ajeno a la orden');
          const quantity = new Prisma.Decimal(received.quantity),
            pending = item.orderedQuantity.minus(item.receivedQuantity);
          validatePurchaseReceiptLine(quantity, pending, received.expiresAt, received.lotNumber);
          const lineSubtotal = item.unitCost.mul(quantity).toDecimalPlaces(2);
          const lineTax = lineSubtotal.mul(item.taxRate).div(100).toDecimalPlaces(2);
          receivedSubtotal = receivedSubtotal.plus(lineSubtotal);
          receivedTax = receivedTax.plus(lineTax);
          const lot = received.lotNumber.trim().toUpperCase();
          const batch = await tx.inventoryBatch.upsert({
            where: {
              branchId_productId_lotNumber: {
                branchId: order.branchId,
                productId: item.productId,
                lotNumber: lot,
              },
            },
            create: {
              branchId: order.branchId,
              productId: item.productId,
              supplierId: order.supplierId,
              lotNumber: lot,
              expiresAt: received.expiresAt,
              unitCost: item.unitCost,
              quantity,
              status: BatchStatus.AVAILABLE,
            },
            update: {
              quantity: { increment: quantity },
              expiresAt: received.expiresAt,
              status: BatchStatus.AVAILABLE,
            },
          });
          const inventory = await tx.branchInventory.upsert({
            where: { branchId_productId: { branchId: order.branchId, productId: item.productId } },
            create: { branchId: order.branchId, productId: item.productId, onHand: quantity },
            update: { onHand: { increment: quantity } },
          });
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { receivedQuantity: { increment: quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              establishmentId: user.establishmentId,
              branchId: order.branchId,
              productId: item.productId,
              batchId: batch.id,
              userId: user.id,
              type: InventoryMovementType.RECEIPT,
              quantity,
              unitCost: item.unitCost,
              balanceAfter: inventory.onHand,
              reason: 'Recepción de orden de compra',
              referenceType: 'PURCHASE_ORDER',
              referenceId: order.id,
              idempotencyKey: `${input.idempotencyKey}:${item.id}`,
            },
          });
        }
        const refreshed = await tx.purchaseOrder.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true },
        });
        const complete = refreshed.items.every((i) => i.receivedQuantity.gte(i.orderedQuantity));
        const updated = await tx.purchaseOrder.update({
          where: { id: order.id },
          data: { status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
          include: { items: { include: { product: true } }, supplier: true, branch: true },
        });
        await postAutomaticEntry(tx, {
          establishmentId: user.establishmentId,
          userId: user.id,
          description: `Recepción de compra #${order.number.toString()}`,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: `${order.id}:${input.idempotencyKey}`,
          lines: [
            { code: '143501', debit: receivedSubtotal, description: 'Entrada de inventario' },
            { code: '135517', debit: receivedTax, description: 'IVA descontable' },
            {
              code: '220505',
              credit: receivedSubtotal.plus(receivedTax),
              description: 'Cuenta por pagar a proveedor',
            },
          ],
        });
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        await tx.accountPayable.create({
          data: {
            establishmentId: user.establishmentId,
            supplierId: order.supplierId,
            purchaseOrderId: order.id,
            sourceKey: `${order.id}:${input.idempotencyKey}`,
            originalAmount: receivedSubtotal.plus(receivedTax),
            balance: receivedSubtotal.plus(receivedTax),
            dueDate,
          },
        });
        return { order: updated, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
