import type { PrismaService } from './prisma/prisma.service';

export async function checkHealth(prisma: Pick<PrismaService, '$queryRaw'>) {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    return {
      status: 'ok',
      service: 'farmacore-local-api',
      database: 'ok',
      timestamp,
    };
  } catch (error) {
    return {
      status: 'degraded',
      service: 'farmacore-local-api',
      database: 'error',
      timestamp,
      error: error instanceof Error ? error.message : 'database unavailable',
    };
  }
}
