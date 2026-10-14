import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { validateCashSessionAmount } from './pos.service';

describe('validateCashSessionAmount', () => {
  it('rechaza montos negativos', () => {
    expect(() => validateCashSessionAmount(new Prisma.Decimal(-1))).toThrow(BadRequestException);
  });

  it('rechaza montos iguales a cero para apertura de caja', () => {
    expect(() => validateCashSessionAmount(new Prisma.Decimal(0), true)).toThrow(
      BadRequestException,
    );
  });

  it('acepta montos válidos', () => {
    expect(() => validateCashSessionAmount(new Prisma.Decimal(100), false)).not.toThrow();
    expect(() => validateCashSessionAmount(new Prisma.Decimal(0), false)).not.toThrow();
  });
});
