import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validatePortfolioPayment } from './portfolio.service';

describe('validatePortfolioPayment', () => {
  it('rechaza montos menores o iguales a cero', () => {
    expect(() => validatePortfolioPayment(new Prisma.Decimal(0), new Prisma.Decimal(100))).toThrow(
      BadRequestException,
    );
  });

  it('rechaza pagos mayores al saldo pendiente', () => {
    expect(() =>
      validatePortfolioPayment(new Prisma.Decimal(150), new Prisma.Decimal(100)),
    ).toThrow(ConflictException);
  });

  it('acepta pagos válidos', () => {
    expect(() =>
      validatePortfolioPayment(new Prisma.Decimal(75), new Prisma.Decimal(100)),
    ).not.toThrow();
  });
});
