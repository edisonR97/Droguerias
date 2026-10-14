import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DashboardSummary } from '@farmacore/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(establishmentId: string): Promise<DashboardSummary> {
    const expiryLimit = new Date();
    expiryLimit.setDate(expiryLimit.getDate() + 30);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [lowStockRows, expiringLots, sales, costRows, openCashSessions] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "branch_inventory" inventory
        INNER JOIN "branches" branch ON branch."id" = inventory."branch_id"
        INNER JOIN "products" product ON product."id" = inventory."product_id"
        WHERE branch."establishment_id" = ${establishmentId}::uuid
          AND product."status" = 'ACTIVE'
          AND (inventory."on_hand" - inventory."reserved") <= COALESCE(inventory."minimum_stock", product."minimum_stock")
      `),
      this.prisma.inventoryBatch.count({
        where: {
          branch: { establishmentId },
          status: 'AVAILABLE',
          quantity: { gt: 0 },
          expiresAt: { lte: expiryLimit },
        },
      }),
      this.prisma.sale.aggregate({
        where: { establishmentId, status: 'COMPLETED', createdAt: { gte: startOfDay } },
        _sum: { total: true },
      }),
      this.prisma.$queryRaw<Array<{ cost: Prisma.Decimal | null }>>(Prisma.sql`
        SELECT SUM(allocation."quantity" * allocation."unit_cost") AS cost
        FROM "sale_item_allocations" allocation
        INNER JOIN "sale_items" item ON item."id" = allocation."sale_item_id"
        INNER JOIN "sales" sale ON sale."id" = item."sale_id"
        WHERE sale."establishment_id" = ${establishmentId}::uuid
          AND sale."status" = 'COMPLETED'
          AND sale."created_at" >= ${startOfDay}
      `),
      this.prisma.cashSession.count({ where: { establishmentId, status: 'OPEN' } }),
    ]);
    const salesToday = sales._sum.total ?? new Prisma.Decimal(0);
    const costToday = costRows[0]?.cost ?? new Prisma.Decimal(0);
    return {
      generatedAt: new Date().toISOString(),
      salesToday: salesToday.toFixed(2),
      grossProfitToday: salesToday.minus(costToday).toFixed(2),
      lowStockItems: Number(lowStockRows[0]?.count ?? 0),
      expiringLots,
      openCashSessions,
    };
  }
}
