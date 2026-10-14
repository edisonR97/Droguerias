import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { serializeBigInts } from './bigint-serializer.interceptor';

describe('serializeBigInts', () => {
  it('convierte bigint a texto sin perder precisión', () => {
    expect(serializeBigInts({ id: 9007199254740993n })).toEqual({ id: '9007199254740993' });
  });

  it('respeta la serialización decimal de Prisma', () => {
    expect(serializeBigInts({ quantity: new Prisma.Decimal('30.125') })).toEqual({
      quantity: '30.125',
    });
  });
});
