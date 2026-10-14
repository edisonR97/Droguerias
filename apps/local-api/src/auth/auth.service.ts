import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload, RequestUser } from './auth.types';
import type { LoginDto, RefreshTokenDto } from './login.dto';

const userAccess = {
  roles: {
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  },
} as const;
type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userAccess }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginDto) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email }, include: userAccess });
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      (user.lockedUntil && user.lockedUntil > new Date()) ||
      !(await argon2.verify(user.passwordHash, input.password))
    ) {
      if (user) await this.recordFailure(user.id, user.failedLoginCount);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const tokens = await this.issueTokens(user);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      }),
      this.prisma.refreshSession.create({
        data: {
          id: tokens.sessionId,
          userId: user.id,
          tokenHash: await argon2.hash(tokens.refreshToken, { type: argon2.argon2id }),
          expiresAt: tokens.refreshExpiresAt,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          establishmentId: user.establishmentId,
          userId: user.id,
          action: 'auth.login',
          entityType: 'User',
          entityId: user.id,
          outcome: 'SUCCESS',
        },
      }),
    ]);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toSessionUser(user, tokens.sessionId),
    };
  }

  async refresh(input: RefreshTokenDto) {
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(input.refreshToken, {
        secret: this.requiredSecret('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh') throw new UnauthorizedException();
      const session = await this.prisma.refreshSession.findUnique({
        where: { id: payload.sessionId },
        include: { user: { include: userAccess } },
      });
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.user.status !== 'ACTIVE' ||
        session.user.establishmentId !== payload.establishmentId ||
        !(await argon2.verify(session.tokenHash, input.refreshToken))
      )
        throw new UnauthorizedException();
      const tokens = await this.issueTokens(session.user);
      await this.prisma.$transaction([
        this.prisma.refreshSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        }),
        this.prisma.refreshSession.create({
          data: {
            id: tokens.sessionId,
            userId: session.user.id,
            tokenHash: await argon2.hash(tokens.refreshToken, { type: argon2.argon2id }),
            expiresAt: tokens.refreshExpiresAt,
          },
        }),
        this.prisma.auditLog.create({
          data: {
            establishmentId: session.user.establishmentId,
            userId: session.user.id,
            action: 'auth.refresh',
            entityType: 'RefreshSession',
            entityId: tokens.sessionId,
            outcome: 'SUCCESS',
          },
        }),
      ]);
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: this.toSessionUser(session.user, tokens.sessionId),
      };
    } catch {
      throw new UnauthorizedException('Sesión expirada o inválida');
    }
  }

  async logout(user: RequestUser) {
    await this.prisma.$transaction([
      this.prisma.refreshSession.updateMany({
        where: { id: user.sessionId, userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          establishmentId: user.establishmentId,
          userId: user.id,
          action: 'auth.logout',
          entityType: 'RefreshSession',
          entityId: user.sessionId,
          outcome: 'SUCCESS',
        },
      }),
    ]);
    return { loggedOut: true };
  }

  async validateAccessToken(token: string): Promise<RequestUser> {
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.requiredSecret('JWT_ACCESS_SECRET'),
    });
    if (payload.type !== 'access') throw new UnauthorizedException();
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.sub }, include: userAccess }),
      this.prisma.refreshSession.findUnique({ where: { id: payload.sessionId } }),
    ]);
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.establishmentId !== payload.establishmentId ||
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    )
      throw new UnauthorizedException();
    return this.toSessionUser(user, payload.sessionId);
  }

  private async issueTokens(user: { id: string; establishmentId: string }) {
    const sessionId = randomUUID();
    const base = { sub: user.id, establishmentId: user.establishmentId, sessionId };
    const accessToken = await this.jwt.signAsync({ ...base, type: 'access' } satisfies JwtPayload, {
      secret: this.requiredSecret('JWT_ACCESS_SECRET'),
      expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as never,
    });
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh' } satisfies JwtPayload,
      {
        secret: this.requiredSecret('JWT_REFRESH_SECRET'),
        expiresIn: (process.env.JWT_REFRESH_TTL ?? '8h') as never,
      },
    );
    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);
    if (!decoded) throw new UnauthorizedException('No fue posible crear la sesión');
    return {
      sessionId,
      accessToken,
      refreshToken,
      refreshExpiresAt: new Date(decoded.exp * 1000),
    };
  }

  private async recordFailure(userId: string, count: number) {
    const next = count + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: next,
        lockedUntil: next >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
      },
    });
  }

  private requiredSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET') {
    const value = process.env[name];
    if (!value || value.length < 32)
      throw new Error(`${name} debe contener al menos 32 caracteres`);
    return value;
  }

  private toSessionUser(user: UserWithAccess, sessionId: string): RequestUser {
    const roles = user.roles.map((entry) => entry.role.code);
    const permissions: string[] = [
      ...new Set<string>(
        user.roles.flatMap((entry) => entry.role.permissions.map((item) => item.permission.code)),
      ),
    ];
    return {
      id: user.id,
      establishmentId: user.establishmentId,
      email: user.email,
      displayName: user.displayName,
      roles,
      permissions,
      sessionId,
    };
  }
}
