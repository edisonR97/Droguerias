import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoleCode } from '@farmacore/shared';
import * as argon2 from 'argon2';
import { createHash, timingSafeEqual } from 'node:crypto';
import { ensureSystemAccess } from '../auth/system-access';
import { PrismaService } from '../prisma/prisma.service';
import type { CompleteProvisioningDto } from './provisioning.dto';

const chart = [
  ['110505', 'Caja general', 'ASSET'],
  ['111005', 'Bancos', 'ASSET'],
  ['130505', 'Clientes nacionales', 'ASSET'],
  ['135517', 'IVA descontable', 'ASSET'],
  ['143501', 'Inventario de mercancias', 'ASSET'],
  ['220505', 'Proveedores nacionales', 'LIABILITY'],
  ['240801', 'IVA generado', 'LIABILITY'],
  ['310505', 'Capital social', 'EQUITY'],
  ['413501', 'Venta de productos farmaceuticos', 'REVENUE'],
  ['417501', 'Devoluciones en ventas', 'REVENUE'],
  ['510506', 'Gastos de personal', 'EXPENSE'],
  ['513525', 'Servicios', 'EXPENSE'],
  ['514010', 'Arrendamientos', 'EXPENSE'],
  ['613501', 'Costo de productos farmaceuticos vendidos', 'EXPENSE'],
] as const;

export function validSetupToken(provided: string, configured: string | undefined) {
  if (!configured || configured.length < 32 || !provided) return false;
  const left = createHash('sha256').update(provided).digest();
  const right = createHash('sha256').update(configured).digest();
  return timingSafeEqual(left, right);
}

@Injectable()
export class ProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async status() {
    const users = await this.prisma.user.count();
    return { required: users === 0, completed: users > 0 };
  }

  async complete(input: CompleteProvisioningDto) {
    if (!validSetupToken(input.setupToken, process.env.PROVISIONING_TOKEN))
      throw new UnauthorizedException('Token de instalacion invalido');
    await ensureSystemAccess(this.prisma);
    return this.prisma.$transaction(
      async (tx) => {
        if ((await tx.user.count()) > 0)
          throw new ConflictException('El aprovisionamiento inicial ya fue completado');
        const ownerRole = await tx.role.findUniqueOrThrow({ where: { code: RoleCode.OWNER } });
        const establishment = await tx.establishment.create({
          data: {
            legalName: input.legalName.trim(),
            tradeName: input.tradeName.trim(),
            taxId: input.taxId.trim(),
            branches: {
              create: {
                code: input.branchCode.trim().toUpperCase(),
                name: input.branchName.trim(),
                terminals: { create: { code: 'CAJA-01', name: 'Caja principal' } },
              },
            },
          },
        });
        await tx.account.createMany({
          data: chart.map(([code, name, type]) => ({
            establishmentId: establishment.id,
            code,
            name,
            type,
          })),
        });
        await tx.productCategory.createMany({
          data: [
            { establishmentId: establishment.id, code: 'MEDICAMENTOS', name: 'Medicamentos' },
            {
              establishmentId: establishment.id,
              code: 'CUIDADO_PERSONAL',
              name: 'Cuidado personal',
            },
          ],
        });
        await tx.expiryAlertRule.createMany({
          data: [7, 15, 30, 60, 90, 180].map((daysBefore) => ({
            establishmentId: establishment.id,
            daysBefore,
          })),
        });
        const owner = await tx.user.create({
          data: {
            establishmentId: establishment.id,
            email: input.ownerEmail.trim().toLowerCase(),
            displayName: input.ownerName.trim(),
            passwordHash: await argon2.hash(input.ownerPassword.trim(), { type: argon2.argon2id }),
            roles: { create: { roleId: ownerRole.id } },
          },
          select: { id: true, email: true, displayName: true },
        });
        await tx.auditLog.create({
          data: {
            establishmentId: establishment.id,
            userId: owner.id,
            action: 'system.provision',
            entityType: 'Establishment',
            entityId: establishment.id,
            outcome: 'SUCCESS',
          },
        });
        return { completed: true, establishmentId: establishment.id, owner };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
