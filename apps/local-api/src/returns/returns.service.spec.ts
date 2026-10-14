import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validateReturnRequest } from './returns.service';

describe('validateReturnRequest', () => {
  it('rechaza cantidades mayores a lo vendido', () => {
    expect(() =>
      validateReturnRequest(
        new Prisma.Decimal(5),
        new Prisma.Decimal(4),
        'Devolución por daño',
        'idempotency-1',
      ),
    ).toThrow(ConflictException);
  });

  it('rechaza razones vacías', () => {
    expect(() =>
      validateReturnRequest(new Prisma.Decimal(1), new Prisma.Decimal(2), '   ', 'idempotency-2'),
    ).toThrow(BadRequestException);
  });

  it('rechaza cantidades iguales o menores a cero', () => {
    expect(() =>
      validateReturnRequest(
        new Prisma.Decimal(0),
        new Prisma.Decimal(2),
        'Devolución por daño',
        'idempotency-4',
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validateReturnRequest(
        new Prisma.Decimal(-1),
        new Prisma.Decimal(2),
        'Devolución por daño',
        'idempotency-5',
      ),
    ).toThrow(BadRequestException);
  });

  it('acepta una devolución válida', () => {
    expect(() =>
      validateReturnRequest(
        new Prisma.Decimal(1),
        new Prisma.Decimal(3),
        'Falla de empaquetado',
        'idempotency-3',
      ),
    ).not.toThrow();
  });
});
