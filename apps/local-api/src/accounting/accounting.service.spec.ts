import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { validateJournalLine } from './accounting.service';

describe('validateJournalLine', () => {
  it('rechaza líneas con monto cero', () => {
    expect(() => validateJournalLine(new Prisma.Decimal(0), new Prisma.Decimal(0))).toThrow(
      BadRequestException,
    );
  });

  it('rechaza líneas con débito y crédito simultáneamente', () => {
    expect(() => validateJournalLine(new Prisma.Decimal(100), new Prisma.Decimal(50))).toThrow(
      BadRequestException,
    );
  });

  it('rechaza valores negativos', () => {
    expect(() => validateJournalLine(new Prisma.Decimal(-10), new Prisma.Decimal(0))).toThrow(
      BadRequestException,
    );
  });

  it('acepta líneas balanceadas válidas', () => {
    expect(() => validateJournalLine(new Prisma.Decimal(100), new Prisma.Decimal(0))).not.toThrow();
    expect(() => validateJournalLine(new Prisma.Decimal(0), new Prisma.Decimal(100))).not.toThrow();
  });
});
