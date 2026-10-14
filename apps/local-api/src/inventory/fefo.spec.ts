import { describe, expect, it } from 'vitest';
import { PaymentMethod, Prisma } from '@prisma/client';
import { allocateFefo, type FefoBatch } from './fefo';
import { validateCheckoutAmounts } from '../pos/pos.service';

const batch = (
  id: string,
  expiresAt: string,
  quantity: number,
  reserved = 0,
  receivedAt = '2026-01-01',
): FefoBatch => ({
  id,
  lotNumber: `LOT-${id}`,
  expiresAt: new Date(expiresAt),
  receivedAt: new Date(receivedAt),
  quantity: new Prisma.Decimal(quantity),
  reserved: new Prisma.Decimal(reserved),
  unitCost: new Prisma.Decimal(1000),
});

describe('allocateFefo', () => {
  it('consume primero el lote con vencimiento más cercano', () => {
    const result = allocateFefo(
      [batch('late', '2027-12-01', 10), batch('early', '2027-02-01', 4)],
      new Prisma.Decimal(6),
    );
    expect(result.allocations.map((item) => [item.batchId, item.quantity])).toEqual([
      ['early', '4'],
      ['late', '2'],
    ]);
    expect(result.remaining.toString()).toBe('0');
  });

  it('descuenta las unidades reservadas de la existencia vendible', () => {
    const result = allocateFefo([batch('one', '2027-02-01', 10, 7)], new Prisma.Decimal(4));
    expect(result.allocations[0]?.quantity).toBe('3');
    expect(result.remaining.toString()).toBe('1');
  });

  it('omite lotes sin disponibilidad y desempata por fecha de recepción', () => {
    const result = allocateFefo(
      [
        batch('empty', '2027-01-01', 5, 5),
        batch('newer', '2027-02-01', 5, 0, '2026-02-01'),
        batch('older', '2027-02-01', 5, 0, '2026-01-01'),
      ],
      new Prisma.Decimal(3),
    );
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]?.batchId).toBe('older');
  });

  it('ignora lotes vencidos aunque tengan stock disponible', () => {
    const expired = new Date('2024-01-01T00:00:00.000Z');
    const valid = new Date('2028-01-01T00:00:00.000Z');
    const result = allocateFefo(
      [
        { ...batch('expired', expired.toISOString(), 10), unitCost: new Prisma.Decimal(50) },
        { ...batch('valid', valid.toISOString(), 8), unitCost: new Prisma.Decimal(70) },
      ],
      new Prisma.Decimal(5),
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]?.batchId).toBe('valid');
    expect(result.allocations[0]?.quantity).toBe('5');
    expect(result.remaining.toString()).toBe('0');
  });

  it('valida que ventas a crédito no acepten efectivo y ventas en efectivo cubran el total', () => {
    expect(() =>
      validateCheckoutAmounts(
        PaymentMethod.CREDIT,
        new Prisma.Decimal(25),
        new Prisma.Decimal(100),
      ),
    ).toThrow('Las ventas a crédito no deben incluir efectivo recibido');
    expect(() =>
      validateCheckoutAmounts(PaymentMethod.CASH, new Prisma.Decimal(99), new Prisma.Decimal(100)),
    ).toThrow('El efectivo recibido es inferior al total');
    expect(() =>
      validateCheckoutAmounts(PaymentMethod.CASH, new Prisma.Decimal(100), new Prisma.Decimal(100)),
    ).not.toThrow();
    expect(() =>
      validateCheckoutAmounts(PaymentMethod.CREDIT, new Prisma.Decimal(0), new Prisma.Decimal(100)),
    ).not.toThrow();
  });
});
