import { config } from 'dotenv';

export type RuntimeEnvironment = Record<string, string | undefined>;

export const requiredEnvironmentVariables = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

export function loadRuntimeEnvironment(envFilePath?: string) {
  const explicitPath = envFilePath?.trim() || process.env.FARMACORE_ENV_FILE?.trim();
  const candidatePaths = explicitPath
    ? [explicitPath, '.env.local', '.env']
    : ['.env.local', '.env'];
  config({ path: candidatePaths, override: false });
  return process.env;
}

export function validateRuntimeEnvironment(env: RuntimeEnvironment) {
  for (const key of requiredEnvironmentVariables) {
    const value = env[key]?.trim();
    if (!value) {
      throw new Error(`Falta la variable de entorno obligatoria: ${key}`);
    }
  }

  const accessSecret = env.JWT_ACCESS_SECRET?.trim();
  const refreshSecret = env.JWT_REFRESH_SECRET?.trim();
  if (accessSecret && accessSecret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET debe tener al menos 32 caracteres');
  }
  if (refreshSecret && refreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET debe tener al menos 32 caracteres');
  }
  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser diferentes');
  }
  if (accessSecret?.includes('GENERATE_') || refreshSecret?.includes('GENERATE_')) {
    throw new Error('Los secretos JWT de ejemplo deben reemplazarse');
  }

  if (env.DATABASE_URL && !/^postgres(ql)?:\/\//i.test(env.DATABASE_URL.trim())) {
    throw new Error('DATABASE_URL debe apuntar a PostgreSQL');
  }

  return true;
}
