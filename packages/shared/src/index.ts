export const APP_NAME = 'FarmaCore ERP';
export const API_VERSION = 'v1';

export enum RoleCode {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  TECHNICAL_DIRECTOR = 'TECHNICAL_DIRECTOR',
  CASHIER = 'CASHIER',
  INVENTORY = 'INVENTORY',
  PURCHASING = 'PURCHASING',
  ACCOUNTANT = 'ACCOUNTANT',
  AUDITOR = 'AUDITOR',
  SUPPORT = 'SUPPORT',
}

export enum PermissionCode {
  DASHBOARD_READ = 'dashboard.read',
  USERS_MANAGE = 'users.manage',
  PRODUCTS_READ = 'products.read',
  PRODUCTS_CREATE = 'products.create',
  PRICES_CHANGE = 'prices.change',
  DISCOUNTS_APPLY = 'discounts.apply',
  INVENTORY_ADJUST = 'inventory.adjust',
  INVENTORY_READ = 'inventory.read',
  INVENTORY_RECEIVE = 'inventory.receive',
  POS_SELL = 'pos.sell',
  CASH_MANAGE = 'cash.manage',
  SALES_VOID = 'sales.void',
  CUSTOMERS_MANAGE = 'customers.manage',
  PURCHASES_READ = 'purchases.read',
  PURCHASES_MANAGE = 'purchases.manage',
  PURCHASES_APPROVE = 'purchases.approve',
  TRANSFERS_READ = 'transfers.read',
  TRANSFERS_MANAGE = 'transfers.manage',
  COUNTS_READ = 'counts.read',
  COUNTS_CREATE = 'counts.create',
  COUNTS_APPROVE = 'counts.approve',
  RETURNS_CREATE = 'returns.create',
  REPORTS_EXPORT = 'reports.export',
  SYSTEM_CONFIGURE = 'system.configure',
  ACCOUNTING_READ = 'accounting.read',
  ACCOUNTING_MANAGE = 'accounting.manage',
  ACCOUNTING_CLOSE = 'accounting.close',
  PORTFOLIO_READ = 'portfolio.read',
  PORTFOLIO_MANAGE = 'portfolio.manage',
  LICENSE_MANAGE = 'license.manage',
  ELECTRONIC_BILLING_MANAGE = 'electronic-billing.manage',
}

export interface SessionUser {
  id: string;
  establishmentId: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

export interface DashboardSummary {
  generatedAt: string;
  salesToday: string;
  grossProfitToday: string;
  lowStockItems: number;
  expiringLots: number;
  openCashSessions: number;
}
