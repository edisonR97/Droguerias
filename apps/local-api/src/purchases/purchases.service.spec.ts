import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validatePurchaseReceiptLine, validateSupplierPayload } from './purchases.service';

describe('validateSupplierPayload', () => {
  it('rechaza identificadores vacíos', () => {
    expect(() =>
      validateSupplierPayload({
        taxId: '   ',
        legalName: 'Distribuidora Alfa',
        tradeName: 'Alfa',
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza nombres legales vacíos', () => {
    expect(() =>
      validateSupplierPayload({
        taxId: '900123456',
        legalName: '   ',
        tradeName: 'Alfa',
      }),
    ).toThrow(BadRequestException);
  });

  it('acepta datos válidos', () => {
    expect(() =>
      validateSupplierPayload({
        taxId: ' 900123456 ',
        legalName: '  Distribuidora Alfa  ',
        tradeName: '  Alfa  ',
      }),
    ).not.toThrow();
  });
});

describe('validatePurchaseReceiptLine', () => {
  it('rechaza lotes vencidos', () => {
    expect(() =>
      validatePurchaseReceiptLine(
        new Prisma.Decimal(1),
        new Prisma.Decimal(2),
        new Date(Date.now() - 60_000),
        'ABC123',
      ),
    ).toThrow(BadRequestException);
  });

  it('rechaza cantidades mayores a la pendiente', () => {
    expect(() =>
      validatePurchaseReceiptLine(
        new Prisma.Decimal(3),
        new Prisma.Decimal(2),
        new Date(Date.now() + 86_400_000),
        'ABC123',
      ),
    ).toThrow(ConflictException);
  });

  it('rechaza cantidades iguales o menores a cero', () => {
    expect(() =>
      validatePurchaseReceiptLine(
        new Prisma.Decimal(0),
        new Prisma.Decimal(2),
        new Date(Date.now() + 86_400_000),
        'ABC123',
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      validatePurchaseReceiptLine(
        new Prisma.Decimal(-1),
        new Prisma.Decimal(2),
        new Date(Date.now() + 86_400_000),
        'ABC123',
      ),
    ).toThrow(BadRequestException);
  });

  it('acepta una recepción válida', () => {
    expect(() =>
      validatePurchaseReceiptLine(
        new Prisma.Decimal(1),
        new Prisma.Decimal(2),
        new Date(Date.now() + 86_400_000),
        ' ABC123 ',
      ),
    ).not.toThrow();
  });
});
