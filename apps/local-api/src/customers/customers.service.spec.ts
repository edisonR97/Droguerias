import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateCustomerPayload } from './customers.service';

describe('validateCustomerPayload', () => {
  it('rechaza documentos vacíos', () => {
    expect(() =>
      validateCustomerPayload({
        documentType: 'CC',
        documentNumber: '   ',
        name: 'Ana Gómez',
      }),
    ).toThrow(BadRequestException);
  });

  it('rechaza tipos de documento inválidos', () => {
    expect(() =>
      validateCustomerPayload({
        documentType: 'XYZ',
        documentNumber: '123456',
        name: 'Ana Gómez',
      }),
    ).toThrow(BadRequestException);
  });

  it('acepta una información válida', () => {
    expect(() =>
      validateCustomerPayload({
        documentType: 'cc',
        documentNumber: '123456',
        name: '  Ana Gómez  ',
      }),
    ).not.toThrow();
  });
});
