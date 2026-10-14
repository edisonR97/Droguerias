import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from './prisma/prisma.service';
import { checkHealth } from './health';

type HealthClient = Pick<PrismaService, '$queryRaw'>;

describe('checkHealth', () => {
  it('marca la base como ok cuando responde', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as HealthClient;

    const status = await checkHealth(prisma);

    expect(status.status).toBe('ok');
    expect(status.database).toBe('ok');
  });

  it('marca la base como error cuando falla', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as HealthClient;

    const status = await checkHealth(prisma);

    expect(status.status).toBe('degraded');
    expect(status.database).toBe('error');
    expect(status.error).toMatch(/db down/i);
  });
});
