import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadRuntimeEnvironment, validateRuntimeEnvironment } from './runtime-env';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});

describe('loadRuntimeEnvironment', () => {
  it('carga un archivo .env explícito aunque el proceso no esté en la raíz del proyecto', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'farmacore-runtime-'));
    const envFile = path.join(tempDir, '.env');
    const previousCwd = process.cwd();

    fs.writeFileSync(
      envFile,
      [
        'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/farmacore',
        'JWT_ACCESS_SECRET=12345678901234567890123456789012',
        'JWT_REFRESH_SECRET=12345678901234567890123456789012',
        'SEED_OWNER_PASSWORD=SeedOwnerPassword123',
        '',
      ].join('\n'),
    );

    process.chdir(os.tmpdir());
    delete process.env.DATABASE_URL;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.SEED_OWNER_PASSWORD;
    process.env.FARMACORE_ENV_FILE = envFile;

    try {
      loadRuntimeEnvironment();
      expect(process.env.DATABASE_URL).toBe(
        'postgresql://postgres:postgres@localhost:5432/farmacore',
      );
      expect(process.env.SEED_OWNER_PASSWORD).toBe('SeedOwnerPassword123');
    } finally {
      process.chdir(previousCwd);
      delete process.env.FARMACORE_ENV_FILE;
    }
  });
});

describe('validateRuntimeEnvironment', () => {
  it('rechaza variables obligatorias faltantes', () => {
    expect(() =>
      validateRuntimeEnvironment({
        DATABASE_URL: '',
        JWT_ACCESS_SECRET: '12345678901234567890123456789012',
        JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('acepta un entorno mínimo válido', () => {
    expect(() =>
      validateRuntimeEnvironment({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/farmacore',
        JWT_ACCESS_SECRET: '12345678901234567890123456789012',
        JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      }),
    ).not.toThrow();
  });

  it('rechaza reutilizar el mismo secreto para acceso y renovacion', () => {
    expect(() =>
      validateRuntimeEnvironment({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/farmacore',
        JWT_ACCESS_SECRET: '12345678901234567890123456789012',
        JWT_REFRESH_SECRET: '12345678901234567890123456789012',
      }),
    ).toThrow(/deben ser diferentes/);
  });

  it('no exige la clave del usuario semilla durante la ejecucion de la API', () => {
    expect(() =>
      validateRuntimeEnvironment({
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/farmacore',
        JWT_ACCESS_SECRET: '12345678901234567890123456789012',
        JWT_REFRESH_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
      }),
    ).not.toThrow();
  });
});
