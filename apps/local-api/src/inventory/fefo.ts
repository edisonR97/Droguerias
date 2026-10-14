import type { Prisma } from '@prisma/client';

export interface FefoBatch {
  id: string;
  lotNumber: string;
  expiresAt: Date;
  receivedAt: Date;
  quantity: Prisma.Decimal;
  reserved: Prisma.Decimal;
  unitCost: Prisma.Decimal;
}

export interface FefoAllocation {
  batchId: string;
  lotNumber: string;
  expiresAt: Date;
  quantity: string;
  unitCost: string;
}

export function allocateFefo(batches: FefoBatch[], requested: Prisma.Decimal) {
  if (requested.lte(0)) return { allocations: [], remaining: requested };

  let remaining = requested;
  const allocations: FefoAllocation[] = [];
  const ordered = [...batches]
    .filter((batch) => batch.expiresAt.getTime() > Date.now())
    .sort(
      (left, right) =>
        left.expiresAt.getTime() - right.expiresAt.getTime() ||
        left.receivedAt.getTime() - right.receivedAt.getTime(),
    );

  for (const batch of ordered) {
    if (remaining.lte(0)) break;
    const available = batch.quantity.minus(batch.reserved);
    if (available.lte(0)) continue;
    const take = available.lessThan(remaining) ? available : remaining;
    allocations.push({
      batchId: batch.id,
      lotNumber: batch.lotNumber,
      expiresAt: batch.expiresAt,
      quantity: take.toString(),
      unitCost: batch.unitCost.toString(),
    });
    remaining = remaining.minus(take);
  }
  return { allocations, remaining };
}
