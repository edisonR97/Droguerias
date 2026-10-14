import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateBranchPayload, validatePassword, validateUserPayload } from './admin.service';

describe('validatePassword', () => {
  it('rechaza contraseñas vacías o cortas', () => {
    expect(() => validatePassword('   ')).toThrow(BadRequestException);
    expect(() => validatePassword('12345678901')).toThrow(BadRequestException);
  });

  it('normaliza espacios y acepta contraseñas válidas', () => {
    expect(validatePassword('  Farmacia2024!  ')).toBe('Farmacia2024!');
  });
});

describe('validateUserPayload', () => {
  it('rechaza nombres vacíos', () => {
    expect(() =>
      validateUserPayload({
        email: '  admin@farmacia.com  ',
        displayName: '   ',
        password: '123456789012',
        roleCodes: ['ADMIN'],
      }),
    ).toThrow(BadRequestException);
  });

  it('normaliza email y nombre', () => {
    expect(() =>
      validateUserPayload({
        email: '  ADMIN@FARMACIA.COM  ',
        displayName: '  Ana Gómez  ',
        password: '123456789012',
        roleCodes: ['ADMIN'],
      }),
    ).not.toThrow();
  });
});

describe('validateBranchPayload', () => {
  it('rechaza código vacío', () => {
    expect(() =>
      validateBranchPayload({
        code: '   ',
        name: 'Sede Norte',
      }),
    ).toThrow(BadRequestException);
  });

  it('normaliza el código y la sede', () => {
    expect(() =>
      validateBranchPayload({
        code: '  sn  ',
        name: '  Sede Norte  ',
      }),
    ).not.toThrow();
  });
});
