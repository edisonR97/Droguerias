import { describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { validateTransferDraft } from './transfers.service';

describe('validateTransferDraft', () => {
  it('rechaza origen y destino iguales', () => {
    expect(() =>
      validateTransferDraft('branch-a', 'branch-a', [
        { productId: 'p1', sourceBatchId: 'b1', quantity: 1 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rechaza lotes duplicados', () => {
    expect(() =>
      validateTransferDraft('branch-a', 'branch-b', [
        { productId: 'p1', sourceBatchId: 'b1', quantity: 1 },
        { productId: 'p2', sourceBatchId: 'b1', quantity: 1 },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rechaza cantidades no positivas', () => {
    expect(() =>
      validateTransferDraft('branch-a', 'branch-b', [
        { productId: 'p1', sourceBatchId: 'b1', quantity: 0 },
      ]),
    ).toThrow(ConflictException);
  });

  it('acepta una transferencia válida', () => {
    expect(() =>
      validateTransferDraft('branch-a', 'branch-b', [
        { productId: 'p1', sourceBatchId: 'b1', quantity: 2 },
      ]),
    ).not.toThrow();
  });
});
