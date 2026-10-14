import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportQueryDto } from './reports.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: RequestUser, query: ReportQueryDto) {
    const range = await this.range(user, query);
    const saleWhere: Prisma.SaleWhereInput = {
      establishmentId: user.establishmentId,
      status: 'COMPLETED',
      createdAt: { gte: range.from, lte: range.to },
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };
    const [sales, returns, purchases, inventory, cashSessions] = await Promise.all([
      this.prisma.sale.findMany({
        where: saleWhere,
        include: {
          items: {
            include: { product: true, allocations: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.saleReturn.findMany({
        where: {
          establishmentId: user.establishmentId,
          createdAt: { gte: range.from, lte: range.to },
          ...(query.branchId ? { sale: { branchId: query.branchId } } : {}),
        },
        include: {
          items: {
            include: { saleItem: { include: { allocations: true } } },
          },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          establishmentId: user.establishmentId,
          status: { not: 'CANCELLED' },
          createdAt: { gte: range.from, lte: range.to },
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        select: { total: true },
      }),
      this.prisma.inventoryBatch.findMany({
        where: {
          branch: { establishmentId: user.establishmentId },
          quantity: { gt: 0 },
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        include: { product: { select: { salePrice: true } } },
      }),
      this.prisma.cashSession.findMany({
        where: {
          establishmentId: user.establishmentId,
          status: 'CLOSED',
          closedAt: { gte: range.from, lte: range.to },
          ...(query.branchId ? { branchId: query.branchId } : {}),
        },
        select: { expectedAmount: true, closingAmount: true },
      }),
    ]);
    const zero = new Prisma.Decimal(0);
    const grossSales = sales.reduce((sum, sale) => sum.plus(sale.total), zero);
    const refunds = returns.reduce((sum, item) => sum.plus(item.total), zero);
    const netSales = grossSales.minus(refunds);
    const saleCost = sales.reduce(
      (sum, sale) =>
        sum.plus(
          sale.items.reduce(
            (itemSum, item) =>
              itemSum.plus(
                item.allocations.reduce(
                  (allocationSum, allocation) =>
                    allocationSum.plus(allocation.quantity.mul(allocation.unitCost)),
                  zero,
                ),
              ),
            zero,
          ),
        ),
      zero,
    );
    const returnedCost = returns.reduce(
      (sum, item) =>
        sum.plus(
          item.items.reduce((itemSum, returnItem) => {
            const originalCost = returnItem.saleItem.allocations.reduce(
              (allocationSum, allocation) =>
                allocationSum.plus(allocation.quantity.mul(allocation.unitCost)),
              zero,
            );
            const unitCost = returnItem.saleItem.quantity.isZero()
              ? zero
              : originalCost.div(returnItem.saleItem.quantity);
            return itemSum.plus(returnItem.quantity.mul(unitCost));
          }, zero),
        ),
      zero,
    );
    const netCost = saleCost.minus(returnedCost);
    const paymentMethods = sales.reduce<Record<string, Prisma.Decimal>>((result, sale) => {
      result[sale.paymentMethod] = (result[sale.paymentMethod] ?? zero).plus(sale.total);
      return result;
    }, {});
    const products = new Map<
      string,
      { name: string; quantity: Prisma.Decimal; total: Prisma.Decimal }
    >();
    for (const sale of sales)
      for (const item of sale.items) {
        const current = products.get(item.productId) ?? {
          name: item.product.commercialName,
          quantity: zero,
          total: zero,
        };
        current.quantity = current.quantity.plus(item.quantity);
        current.total = current.total.plus(item.total);
        products.set(item.productId, current);
      }
    return {
      from: range.from,
      to: range.to,
      salesCount: sales.length,
      grossSales,
      refunds,
      netSales,
      netCost,
      grossProfit: netSales.minus(netCost),
      purchases: purchases.reduce((sum, item) => sum.plus(item.total), zero),
      inventoryCostValue: inventory.reduce(
        (sum, batch) => sum.plus(batch.quantity.mul(batch.unitCost)),
        zero,
      ),
      inventoryRetailValue: inventory.reduce(
        (sum, batch) => sum.plus(batch.quantity.mul(batch.product.salePrice)),
        zero,
      ),
      cashDifference: cashSessions.reduce(
        (sum, session) =>
          sum.plus((session.closingAmount ?? zero).minus(session.expectedAmount ?? zero)),
        zero,
      ),
      paymentMethods: Object.entries(paymentMethods).map(([method, total]) => ({ method, total })),
      topProducts: [...products.values()].sort((a, b) => b.total.comparedTo(a.total)).slice(0, 10),
    };
  }

  async salesCsv(user: RequestUser, query: ReportQueryDto) {
    const range = await this.range(user, query);
    const sales = await this.prisma.sale.findMany({
      where: {
        establishmentId: user.establishmentId,
        createdAt: { gte: range.from, lte: range.to },
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: {
        branch: { select: { name: true } },
        user: { select: { displayName: true } },
        customer: { select: { documentNumber: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const escape = (value: unknown) => {
      let text = '';
      if (typeof value === 'string') text = value;
      else if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean')
        text = value.toString();
      else if (value instanceof Prisma.Decimal) text = value.toString();
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        'Número',
        'Fecha',
        'Sede',
        'Vendedor',
        'Cliente',
        'Documento',
        'Estado',
        'Pago',
        'Subtotal',
        'Impuesto',
        'Descuento',
        'Total',
      ],
      ...sales.map((sale) => [
        sale.number,
        sale.createdAt.toISOString(),
        sale.branch.name,
        sale.user.displayName,
        sale.customer?.name,
        sale.customer?.documentNumber,
        sale.status,
        sale.paymentMethod,
        sale.subtotal,
        sale.tax,
        sale.discount,
        sale.total,
      ]),
    ];
    return '\uFEFF' + rows.map((row) => row.map(escape).join(';')).join('\r\n');
  }

  private async range(user: RequestUser, query: ReportQueryDto) {
    const now = new Date();
    const from = query.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = query.to ?? now;
    if (from > to) throw new BadRequestException('La fecha inicial debe ser anterior a la final');
    if (query.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: query.branchId, establishmentId: user.establishmentId },
      });
      if (!branch) throw new NotFoundException('Sede no encontrada');
    }
    return { from, to };
  }
}
