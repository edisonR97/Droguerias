import { describe, expect, it } from 'vitest';
import { normalizeProviderResponse } from './electronic-billing.service';

describe('normalizeProviderResponse', () => {
  it('normaliza una factura aceptada con CUFE', () => {
    expect(normalizeProviderResponse({ status: 'ACCEPTED', documentId: '1', cufe: 'abc' })).toEqual(
      {
        status: 'ACCEPTED',
        documentId: '1',
        cufe: 'abc',
      },
    );
  });

  it('conserva el motivo de rechazo', () => {
    expect(
      normalizeProviderResponse({ status: 'REJECTED', message: 'Rango agotado' }).message,
    ).toBe('Rango agotado');
  });

  it('rechaza estados desconocidos', () => {
    expect(() => normalizeProviderResponse({ status: 'OK' })).toThrow(/desconocido/);
  });
});
