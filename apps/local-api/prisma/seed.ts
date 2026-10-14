import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PermissionCode, RoleCode } from '@farmacore/shared';

const prisma = new PrismaClient();

async function main() {
  const permissions = await Promise.all(
    Object.values(PermissionCode).map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      }),
    ),
  );
  const owner = await prisma.role.upsert({
    where: { code: RoleCode.OWNER },
    update: {},
    create: { code: RoleCode.OWNER, name: 'Propietario' },
  });
  await Promise.all(
    permissions.map((permission) =>
      prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: owner.id, permissionId: permission.id } },
        update: {},
        create: { roleId: owner.id, permissionId: permission.id },
      }),
    ),
  );
  const roleDefinitions: Array<{ code: RoleCode; name: string; permissions: PermissionCode[] }> = [
    { code: RoleCode.ADMIN, name: 'Administrador', permissions: Object.values(PermissionCode) },
    {
      code: RoleCode.TECHNICAL_DIRECTOR,
      name: 'Director técnico',
      permissions: [
        PermissionCode.DASHBOARD_READ,
        PermissionCode.PRODUCTS_READ,
        PermissionCode.PRODUCTS_CREATE,
        PermissionCode.INVENTORY_READ,
        PermissionCode.INVENTORY_RECEIVE,
        PermissionCode.INVENTORY_ADJUST,
        PermissionCode.TRANSFERS_READ,
        PermissionCode.TRANSFERS_MANAGE,
        PermissionCode.COUNTS_READ,
        PermissionCode.COUNTS_CREATE,
        PermissionCode.COUNTS_APPROVE,
        PermissionCode.RETURNS_CREATE,
        PermissionCode.REPORTS_EXPORT,
      ],
    },
    {
      code: RoleCode.CASHIER,
      name: 'Cajero',
      permissions: [
        PermissionCode.DASHBOARD_READ,
        PermissionCode.PRODUCTS_READ,
        PermissionCode.POS_SELL,
        PermissionCode.CASH_MANAGE,
        PermissionCode.CUSTOMERS_MANAGE,
      ],
    },
    {
      code: RoleCode.INVENTORY,
      name: 'Inventario',
      permissions: [
        PermissionCode.DASHBOARD_READ,
        PermissionCode.PRODUCTS_READ,
        PermissionCode.INVENTORY_READ,
        PermissionCode.INVENTORY_RECEIVE,
        PermissionCode.INVENTORY_ADJUST,
        PermissionCode.TRANSFERS_READ,
        PermissionCode.TRANSFERS_MANAGE,
        PermissionCode.COUNTS_READ,
        PermissionCode.COUNTS_CREATE,
      ],
    },
    {
      code: RoleCode.PURCHASING,
      name: 'Compras',
      permissions: [
        PermissionCode.DASHBOARD_READ,
        PermissionCode.PRODUCTS_READ,
        PermissionCode.INVENTORY_READ,
        PermissionCode.PURCHASES_READ,
        PermissionCode.PURCHASES_MANAGE,
      ],
    },
    {
      code: RoleCode.ACCOUNTANT,
      name: 'Contabilidad',
      permissions: [
        PermissionCode.DASHBOARD_READ,
        PermissionCode.PURCHASES_READ,
        PermissionCode.REPORTS_EXPORT,
        PermissionCode.ACCOUNTING_READ,
        PermissionCode.ACCOUNTING_MANAGE,
        PermissionCode.ACCOUNTING_CLOSE,
        PermissionCode.PORTFOLIO_READ,
        PermissionCode.PORTFOLIO_MANAGE,
      ],
    },
    {
      code: RoleCode.AUDITOR,
      name: 'Auditor',
      permissions: [
        PermissionCode.DASHBOARD_READ,
        PermissionCode.PRODUCTS_READ,
        PermissionCode.INVENTORY_READ,
        PermissionCode.PURCHASES_READ,
        PermissionCode.TRANSFERS_READ,
        PermissionCode.COUNTS_READ,
        PermissionCode.REPORTS_EXPORT,
        PermissionCode.ACCOUNTING_READ,
        PermissionCode.PORTFOLIO_READ,
      ],
    },
    {
      code: RoleCode.SUPPORT,
      name: 'Soporte técnico',
      permissions: [PermissionCode.SYSTEM_CONFIGURE],
    },
  ];
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: { name: definition.name },
      create: { code: definition.code, name: definition.name },
    });
    const allowed = permissions.filter((permission) =>
      definition.permissions.includes(permission.code as PermissionCode),
    );
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: allowed.map((item) => item.id) } },
    });
    await Promise.all(
      allowed.map((permission) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        }),
      ),
    );
  }
  const establishment = await prisma.establishment.upsert({
    where: { taxId: '900000000-0' },
    update: {},
    create: {
      legalName: 'FarmaCore Demostración S.A.S.',
      tradeName: 'Droguería Central',
      taxId: '900000000-0',
      branches: {
        create: {
          code: 'PRINCIPAL',
          name: 'Sucursal principal',
          terminals: { create: { code: 'CAJA-01', name: 'Caja principal' } },
        },
      },
    },
  });
  await prisma.branch.upsert({
    where: { establishmentId_code: { establishmentId: establishment.id, code: 'BODEGA' } },
    update: { active: true },
    create: { establishmentId: establishment.id, code: 'BODEGA', name: 'Bodega central' },
  });
  const chart = [
    { code: '110505', name: 'Caja general', type: 'ASSET' as const },
    { code: '111005', name: 'Bancos', type: 'ASSET' as const },
    { code: '130505', name: 'Clientes nacionales', type: 'ASSET' as const },
    { code: '135517', name: 'IVA descontable', type: 'ASSET' as const },
    { code: '143501', name: 'Inventario de mercancías', type: 'ASSET' as const },
    { code: '220505', name: 'Proveedores nacionales', type: 'LIABILITY' as const },
    { code: '240801', name: 'IVA generado', type: 'LIABILITY' as const },
    { code: '310505', name: 'Capital social', type: 'EQUITY' as const },
    { code: '413501', name: 'Venta de productos farmacéuticos', type: 'REVENUE' as const },
    { code: '417501', name: 'Devoluciones en ventas', type: 'REVENUE' as const },
    { code: '510506', name: 'Gastos de personal', type: 'EXPENSE' as const },
    { code: '513525', name: 'Servicios', type: 'EXPENSE' as const },
    { code: '514010', name: 'Arrendamientos', type: 'EXPENSE' as const },
    { code: '613501', name: 'Costo de productos farmacéuticos vendidos', type: 'EXPENSE' as const },
  ];
  await Promise.all(
    chart.map((account) =>
      prisma.account.upsert({
        where: { establishmentId_code: { establishmentId: establishment.id, code: account.code } },
        update: { name: account.name, type: account.type, active: true },
        create: { establishmentId: establishment.id, ...account },
      }),
    ),
  );
  await Promise.all([
    prisma.productCategory.upsert({
      where: { establishmentId_code: { establishmentId: establishment.id, code: 'MEDICAMENTOS' } },
      update: {},
      create: { establishmentId: establishment.id, code: 'MEDICAMENTOS', name: 'Medicamentos' },
    }),
    prisma.productCategory.upsert({
      where: {
        establishmentId_code: { establishmentId: establishment.id, code: 'CUIDADO_PERSONAL' },
      },
      update: {},
      create: {
        establishmentId: establishment.id,
        code: 'CUIDADO_PERSONAL',
        name: 'Cuidado personal',
      },
    }),
    ...[7, 15, 30, 60, 90, 180].map((daysBefore) =>
      prisma.expiryAlertRule.upsert({
        where: { establishmentId_daysBefore: { establishmentId: establishment.id, daysBefore } },
        update: { active: true },
        create: { establishmentId: establishment.id, daysBefore },
      }),
    ),
  ]);
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('SEED_OWNER_PASSWORD debe tener al menos 12 caracteres');
  const user = await prisma.user.upsert({
    where: {
      establishmentId_email: { establishmentId: establishment.id, email: 'owner@farmacore.local' },
    },
    update: {},
    create: {
      establishmentId: establishment.id,
      email: 'owner@farmacore.local',
      displayName: 'Propietario',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      roles: { create: { roleId: owner.id } },
    },
  });
  console.info(`Seed completado para ${user.email}`);
}

main().finally(() => prisma.$disconnect());
