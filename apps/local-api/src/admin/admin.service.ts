import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateBranchDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateBranchDto,
  UpdateEstablishmentDto,
  UpdateUserDto,
} from './admin.dto';

export function validatePassword(password: string) {
  const normalized = password.trim();

  if (!normalized) throw new BadRequestException('La contraseña es obligatoria');
  if (normalized.length < 12)
    throw new BadRequestException('La contraseña debe tener al menos 12 caracteres');

  return normalized;
}

export function validateUserPayload(
  input: Pick<CreateUserDto, 'email' | 'displayName' | 'password' | 'roleCodes'>,
) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const password = validatePassword(input.password);
  const roleCodes = input.roleCodes.map((code) => code.trim());

  if (!email) throw new BadRequestException('El correo es obligatorio');
  if (!displayName) throw new BadRequestException('El nombre del usuario es obligatorio');
  if (roleCodes.length === 0 || roleCodes.some((code) => !code))
    throw new BadRequestException('Debe asignar al menos un rol');

  return { email, displayName, password, roleCodes };
}

export function validateBranchPayload(input: Pick<CreateBranchDto, 'code' | 'name'>) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();

  if (!code || code.length < 2)
    throw new BadRequestException('El código de la sede es obligatorio');
  if (!name || name.length < 2)
    throw new BadRequestException('El nombre de la sede es obligatorio');

  return { code, name };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async context(user: RequestUser) {
    const [establishment, branches, users, roles] = await Promise.all([
      this.prisma.establishment.findUniqueOrThrow({ where: { id: user.establishmentId } }),
      this.prisma.branch.findMany({
        where: { establishmentId: user.establishmentId },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.user.findMany({
        where: { establishmentId: user.establishmentId },
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          failedLoginCount: true,
          lockedUntil: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: { select: { code: true, name: true } } } },
        },
        orderBy: { displayName: 'asc' },
      }),
      this.prisma.role.findMany({
        select: { id: true, code: true, name: true, system: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { establishment, branches, users, roles };
  }

  async createUser(actor: RequestUser, input: CreateUserDto) {
    const normalized = validateUserPayload(input);
    return this.prisma.$transaction(async (tx) => {
      await this.assertLicenseCapacity(tx, actor.establishmentId, 'users');
      const roles = await tx.role.findMany({ where: { code: { in: normalized.roleCodes } } });
      if (roles.length !== new Set(normalized.roleCodes).size)
        throw new BadRequestException('Uno o más roles no existen');
      const existing = await tx.user.findFirst({
        where: { establishmentId: actor.establishmentId, email: normalized.email },
      });
      if (existing) throw new ConflictException('El correo ya está registrado');
      const created = await tx.user.create({
        data: {
          establishmentId: actor.establishmentId,
          email: normalized.email,
          displayName: normalized.displayName,
          passwordHash: await argon2.hash(normalized.password, { type: argon2.argon2id }),
          roles: { create: roles.map((role) => ({ roleId: role.id })) },
        },
        select: { id: true, email: true, displayName: true, status: true },
      });
      await this.audit(tx, actor, 'user.create', 'User', created.id);
      return created;
    });
  }

  async updateUser(actor: RequestUser, id: string, input: UpdateUserDto) {
    if (id === actor.id && input.status && input.status !== UserStatus.ACTIVE)
      throw new BadRequestException('No puede bloquear o desactivar su propio usuario');
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id, establishmentId: actor.establishmentId },
      });
      if (!target) throw new NotFoundException('Usuario no encontrado');
      let roleIds: string[] | undefined;
      if (input.roleCodes) {
        const roles = await tx.role.findMany({ where: { code: { in: input.roleCodes } } });
        if (roles.length !== new Set(input.roleCodes).size)
          throw new BadRequestException('Uno o más roles no existen');
        roleIds = roles.map((role) => role.id);
        await tx.userRole.deleteMany({ where: { userId: id } });
      }
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
          ...(input.status === 'ACTIVE'
            ? { status: input.status, failedLoginCount: 0, lockedUntil: null }
            : input.status
              ? { status: input.status }
              : {}),
          ...(roleIds ? { roles: { create: roleIds.map((roleId) => ({ roleId })) } } : {}),
        },
        select: { id: true, email: true, displayName: true, status: true },
      });
      if (input.status && input.status !== 'ACTIVE')
        await tx.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await this.audit(tx, actor, 'user.update', 'User', id);
      return updated;
    });
  }

  async resetPassword(actor: RequestUser, id: string, input: ResetPasswordDto) {
    const password = validatePassword(input.password);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findFirst({
        where: { id, establishmentId: actor.establishmentId },
      });
      if (!target) throw new NotFoundException('Usuario no encontrado');
      await tx.user.update({
        where: { id },
        data: {
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.refreshSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit(tx, actor, 'user.password_reset', 'User', id);
      return { updated: true };
    });
  }

  async createBranch(actor: RequestUser, input: CreateBranchDto) {
    const normalized = validateBranchPayload(input);
    return this.prisma.$transaction(async (tx) => {
      await this.assertLicenseCapacity(tx, actor.establishmentId, 'branches');
      const branch = await tx.branch.create({
        data: {
          establishmentId: actor.establishmentId,
          code: normalized.code,
          name: normalized.name,
        },
      });
      await this.audit(tx, actor, 'branch.create', 'Branch', branch.id);
      return branch;
    });
  }

  async updateBranch(actor: RequestUser, id: string, input: UpdateBranchDto) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id, establishmentId: actor.establishmentId },
      });
      if (!branch) throw new NotFoundException('Sede no encontrada');
      if (input.active === false) {
        const openCash = await tx.cashSession.count({ where: { branchId: id, status: 'OPEN' } });
        if (openCash) throw new ConflictException('No puede desactivar una sede con caja abierta');
      }
      const normalized =
        input.code || input.name
          ? validateBranchPayload({
              code: input.code ?? branch.code,
              name: input.name ?? branch.name,
            })
          : null;
      const updated = await tx.branch.update({
        where: { id },
        data: {
          ...(normalized ? { code: normalized.code } : {}),
          ...(normalized ? { name: normalized.name } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      });
      await this.audit(tx, actor, 'branch.update', 'Branch', id);
      return updated;
    });
  }

  async updateEstablishment(actor: RequestUser, input: UpdateEstablishmentDto) {
    try {
      const updated = await this.prisma.establishment.update({
        where: { id: actor.establishmentId },
        data: {
          legalName: input.legalName.trim(),
          tradeName: input.tradeName.trim(),
          taxId: input.taxId.trim(),
          timezone: input.timezone.trim(),
          currency: input.currency.trim().toUpperCase(),
        },
      });
      await this.prisma.auditLog.create({
        data: {
          establishmentId: actor.establishmentId,
          userId: actor.id,
          action: 'establishment.update',
          entityType: 'Establishment',
          entityId: actor.establishmentId,
          outcome: 'SUCCESS',
        },
      });
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('La identificación tributaria ya está registrada');
      throw error;
    }
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    return tx.auditLog.create({
      data: {
        establishmentId: actor.establishmentId,
        userId: actor.id,
        action,
        entityType,
        entityId,
        outcome: 'SUCCESS',
      },
    });
  }

  private async assertLicenseCapacity(
    tx: Prisma.TransactionClient,
    establishmentId: string,
    resource: 'users' | 'branches',
  ) {
    const license = await tx.commercialLicense.findFirst({
      where: {
        establishmentId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { activatedAt: 'desc' },
    });
    if (!license) return;
    const current =
      resource === 'users'
        ? await tx.user.count({ where: { establishmentId, status: { not: 'DISABLED' } } })
        : await tx.branch.count({ where: { establishmentId, active: true } });
    const limit = resource === 'users' ? license.maxUsers : license.maxBranches;
    if (current >= limit)
      throw new ConflictException(
        resource === 'users'
          ? `La licencia permite un maximo de ${limit} usuarios activos`
          : `La licencia permite un maximo de ${limit} sedes activas`,
      );
  }
}
