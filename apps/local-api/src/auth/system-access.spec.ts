import { describe, expect, it } from 'vitest';
import { PermissionCode, RoleCode } from '@farmacore/shared';
import { getRolePermissions, getSystemRoleDefinitions } from './system-access';

describe('system-access bootstrap', () => {
  it('genera los permisos completos del administrador', () => {
    expect(getRolePermissions(RoleCode.ADMIN)).toContain(PermissionCode.USERS_MANAGE);
    expect(getRolePermissions(RoleCode.ADMIN)).toContain(PermissionCode.POS_SELL);
    expect(getRolePermissions(RoleCode.ADMIN)).toContain(PermissionCode.REPORTS_EXPORT);
  });

  it('limita el rol soporte a su permiso funcional', () => {
    expect(getRolePermissions(RoleCode.SUPPORT)).toEqual([PermissionCode.SYSTEM_CONFIGURE]);
  });

  it('expone una definición consistente para todas las funciones del sistema', () => {
    const definitions = getSystemRoleDefinitions();
    expect(Object.keys(definitions)).toHaveLength(Object.values(RoleCode).length);
    expect(definitions[RoleCode.OWNER]).toContain(PermissionCode.ACCOUNTING_MANAGE);
    expect(definitions[RoleCode.AUDITOR]).toContain(PermissionCode.PORTFOLIO_READ);
  });
});
