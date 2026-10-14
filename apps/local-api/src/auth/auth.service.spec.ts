import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';

vi.mock('argon2', () => ({
  verify: vi.fn(),
  hash: vi.fn(),
  argon2id: 'argon2id',
}));

const createService = () => {
  const prisma = {
    user: { findFirst: vi.fn(), update: vi.fn() },
    refreshSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn<(input: { data: { userId: string } }) => unknown>(),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn((operations: unknown[]) => Promise.resolve(operations)),
  };

  const jwt = {
    verifyAsync: vi.fn(),
    signAsync: vi.fn(),
    decode: vi.fn(),
  };

  const service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
  return { service, prisma, jwt };
};

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = '12345678901234567890123456789012';
    process.env.JWT_REFRESH_SECRET = '12345678901234567890123456789012';
  });

  it('rotación de refresh token revoca la sesión anterior y crea una nueva', async () => {
    const { service, prisma, jwt } = createService();
    vi.mocked(argon2.verify).mockResolvedValue(true);
    vi.mocked(argon2.hash).mockResolvedValue('hashed-token');
    vi.spyOn(jwt, 'verifyAsync').mockResolvedValue({
      type: 'refresh',
      sessionId: 'old-session',
      establishmentId: 'est-1',
      sub: 'user-1',
    });
    vi.spyOn(jwt, 'signAsync').mockResolvedValue('new-access-token');
    vi.spyOn(jwt, 'signAsync').mockResolvedValueOnce('new-access-token');
    vi.spyOn(jwt, 'signAsync').mockResolvedValueOnce('new-refresh-token');
    vi.spyOn(jwt, 'decode').mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });

    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'old-session',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1',
        establishmentId: 'est-1',
        status: 'ACTIVE',
        roles: [],
      },
      tokenHash: 'hashed-token',
    });

    const result = await service.refresh({ refreshToken: 'old-refresh-token' });

    expect(jwt.verifyAsync).toHaveBeenCalledWith('old-refresh-token', expect.any(Object));
    expect(prisma.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old-session' } }),
    );
    expect(prisma.refreshSession.create).toHaveBeenCalled();
    expect(prisma.refreshSession.create.mock.calls[0]?.[0].data.userId).toBe('user-1');
    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
  });

  it('logout revoca la sesión actual del usuario', async () => {
    const { service, prisma } = createService();

    const result = await service.logout({
      id: 'user-1',
      establishmentId: 'est-1',
      email: 'user@test.com',
      displayName: 'User Test',
      roles: [],
      permissions: [],
      sessionId: 'session-1',
    });

    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1', userId: 'user-1', revokedAt: null },
      }),
    );
    expect(result).toEqual({ loggedOut: true });
  });

  it('rechaza refresh tokens inválidos o expirados', async () => {
    const { service, jwt } = createService();
    vi.spyOn(jwt, 'verifyAsync').mockRejectedValue(new Error('invalid'));

    await expect(service.refresh({ refreshToken: 'invalid-refresh' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
