import type { PrismaClient } from '@prisma/client';
import { PermissionCode, RoleCode } from '@farmacore/shared';

export type RolePermissionMap = Record<RoleCode, PermissionCode[]>;

export function getSystemRoleDefinitions(): RolePermissionMap {
  return {
    [RoleCode.OWNER]: Object.values(PermissionCode),
    [RoleCode.ADMIN]: Object.values(PermissionCode),
    [RoleCode.TECHNICAL_DIRECTOR]: [
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
    [RoleCode.CASHIER]: [
      PermissionCode.DASHBOARD_READ,
      PermissionCode.PRODUCTS_READ,
      PermissionCode.POS_SELL,
      PermissionCode.CASH_MANAGE,
      PermissionCode.CUSTOMERS_MANAGE,
    ],
    [RoleCode.INVENTORY]: [
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
    [RoleCode.PURCHASING]: [
      PermissionCode.DASHBOARD_READ,
      PermissionCode.PRODUCTS_READ,
      PermissionCode.INVENTORY_READ,
      PermissionCode.PURCHASES_READ,
      PermissionCode.PURCHASES_MANAGE,
    ],
    [RoleCode.ACCOUNTANT]: [
      PermissionCode.DASHBOARD_READ,
      PermissionCode.PURCHASES_READ,
      PermissionCode.REPORTS_EXPORT,
      PermissionCode.ACCOUNTING_READ,
      PermissionCode.ACCOUNTING_MANAGE,
      PermissionCode.ACCOUNTING_CLOSE,
      PermissionCode.PORTFOLIO_READ,
      PermissionCode.PORTFOLIO_MANAGE,
    ],
    [RoleCode.AUDITOR]: [
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
    [RoleCode.SUPPORT]: [PermissionCode.SYSTEM_CONFIGURE],
  };
}

export function getRolePermissions(roleCode: RoleCode): PermissionCode[] {
  return [...getSystemRoleDefinitions()[roleCode]];
}

export function resolveRoleName(roleCode: RoleCode) {
  return {
    [RoleCode.OWNER]: 'Propietario',
    [RoleCode.ADMIN]: 'Administrador',
    [RoleCode.TECHNICAL_DIRECTOR]: 'Director técnico',
    [RoleCode.CASHIER]: 'Cajero',
    [RoleCode.INVENTORY]: 'Inventario',
    [RoleCode.PURCHASING]: 'Compras',
    [RoleCode.ACCOUNTANT]: 'Contabilidad',
    [RoleCode.AUDITOR]: 'Auditor',
    [RoleCode.SUPPORT]: 'Soporte técnico',
  }[roleCode];
}

export async function ensureSystemAccess(
  prisma: Pick<PrismaClient, 'permission' | 'role' | 'rolePermission'>,
) {
  const permissions = await Promise.all(
    Object.values(PermissionCode).map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: { description: code },
        create: { code, description: code },
      }),
    ),
  );

  const definitions = getSystemRoleDefinitions();

  for (const [roleCode, rolePermissions] of Object.entries(definitions) as [
    RoleCode,
    PermissionCode[],
  ][]) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: resolveRoleName(roleCode), system: true },
      create: { code: roleCode, name: resolveRoleName(roleCode), system: true },
    });

    const allowedPermissionIds = permissions
      .filter((permission) => rolePermissions.includes(permission.code as PermissionCode))
      .map((permission) => permission.id);

    if (allowedPermissionIds.length === 0) {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      continue;
    }

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: allowedPermissionIds } },
    });

    await Promise.all(
      allowedPermissionIds.map((permissionId) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          update: {},
          create: { roleId: role.id, permissionId },
        }),
      ),
    );
  }
}
