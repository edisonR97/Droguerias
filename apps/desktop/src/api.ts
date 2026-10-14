import type { DashboardSummary, SessionUser } from '@farmacore/shared';
const configuredBaseUrl = import.meta.env['VITE_API_URL'] as string | undefined;
const baseUrl = configuredBaseUrl ?? 'http://127.0.0.1:4310/api/v1';
let accessToken: string | null = sessionStorage.getItem('farmacore.accessToken');
let refreshToken: string | null = sessionStorage.getItem('farmacore.refreshToken');
let refreshPromise: Promise<boolean> | null = null;

async function renewSession() {
  if (!refreshToken) return false;
  if (!refreshPromise)
    refreshPromise = fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const result = (await response.json()) as {
          accessToken: string;
          refreshToken: string;
        };
        accessToken = result.accessToken;
        refreshToken = result.refreshToken;
        sessionStorage.setItem('farmacore.accessToken', accessToken);
        sessionStorage.setItem('farmacore.refreshToken', refreshToken);
        return true;
      })
      .finally(() => {
        refreshPromise = null;
      });
  return refreshPromise;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (response.status === 401 && !path.startsWith('/auth/') && (await renewSession())) {
    headers.set('Authorization', `Bearer ${accessToken}`);
    response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Error HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
export async function login(email: string, password: string) {
  const result = await request<{ accessToken: string; refreshToken: string; user: SessionUser }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  accessToken = result.accessToken;
  refreshToken = result.refreshToken;
  sessionStorage.setItem('farmacore.accessToken', accessToken);
  sessionStorage.setItem('farmacore.refreshToken', refreshToken);
  return result;
}
export interface ProvisioningInput {
  setupToken: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  branchCode: string;
  branchName: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
}
export const getProvisioningStatus = () =>
  request<{ required: boolean; completed: boolean }>('/provisioning/status');
export const completeProvisioning = (data: ProvisioningInput) =>
  request<{ completed: true }>('/provisioning/complete', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export interface LicenseStatus {
  licensed: boolean;
  reason: 'NOT_ACTIVATED' | 'EXPIRED' | null;
  license?: {
    licenseId: string;
    kind: 'SUBSCRIPTION' | 'PERPETUAL';
    customerName: string;
    issuedAt: string;
    expiresAt: string | null;
    maxBranches: number;
    maxUsers: number;
    features: string[];
    activatedAt: string;
  };
}
export const getLicenseStatus = () => request<LicenseStatus>('/licensing/status');
export const activateLicense = (token: string) =>
  request<LicenseStatus>('/licensing/activate', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
export interface ElectronicDocument {
  id: string;
  saleId: string | null;
  type: string;
  status: string;
  provider: string;
  cufe: string | null;
  xmlUrl: string | null;
  pdfUrl: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
  sale: { id: string; number: string; total: string; createdAt: string } | null;
}
export const getElectronicDocuments = () =>
  request<ElectronicDocument[]>('/electronic-billing/documents');
export const submitElectronicSale = (saleId: string) =>
  request<ElectronicDocument>(`/electronic-billing/sales/${saleId}/submit`, { method: 'POST' });
export const getMe = () => request<SessionUser>('/auth/me');
export const getDashboard = () => request<DashboardSummary>('/dashboard/summary');
export interface ProductListItem {
  id: string;
  internalCode: string;
  barcode: string | null;
  commercialName: string;
  genericName: string | null;
  presentation: string;
  salePrice: string;
  minimumStock: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  category: { name: string };
  laboratory: { name: string } | null;
  branchInventory: Array<{ onHand: string; reserved: string }>;
}
export interface ExpiryBatch {
  id: string;
  lotNumber: string;
  expiresAt: string;
  quantity: string;
  unitCost: string;
  daysRemaining: number;
  inventoryValue: string;
  classification: string;
  product: { commercialName: string; internalCode: string };
  branch: { name: string };
  location: { name: string } | null;
}
export const getProducts = (search = '') =>
  request<{ items: ProductListItem[]; total: number; page: number; limit: number }>(
    `/products?page=1&limit=100&search=${encodeURIComponent(search)}`,
  );
export const getExpiryAlerts = () => request<ExpiryBatch[]>('/inventory/expiry-alerts');
export interface CashSession {
  id: string;
  branchId: string;
  openingAmount: string;
  status: 'OPEN';
}
export interface SaleResult {
  sale: {
    id: string;
    number: string;
    subtotal: string;
    tax: string;
    total: string;
    changeAmount: string;
    items: Array<{ id: string }>;
  };
  idempotent: boolean;
}
export const getPosContext = () =>
  request<{ branches: Array<{ id: string; code: string; name: string }> }>('/pos/context');
export const getOpenCash = (branchId: string) =>
  request<CashSession | null>(`/pos/cash-sessions/open?branchId=${encodeURIComponent(branchId)}`);
export const openCash = (branchId: string, openingAmount: number) =>
  request<CashSession>('/pos/cash-sessions', {
    method: 'POST',
    body: JSON.stringify({ branchId, openingAmount }),
  });
export const checkout = (data: {
  branchId: string;
  cashSessionId: string;
  customerId?: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
  receivedAmount: number;
  idempotencyKey: string;
  items: Array<{ productId: string; quantity: number }>;
}) => request<SaleResult>('/pos/checkout', { method: 'POST', body: JSON.stringify(data) });
export const closeCash = (id: string, closingAmount: number) =>
  request<{ status: 'CLOSED'; expectedAmount: string; closingAmount: string; difference: string }>(
    `/pos/cash-sessions/${id}/close`,
    { method: 'POST', body: JSON.stringify({ closingAmount }) },
  );
export const getReceipt = (id: string) => request<unknown>(`/pos/sales/${id}`);
export const voidSale = (id: string, reason: string) =>
  request<{ sale: { status: 'VOIDED' }; idempotent: boolean }>(`/pos/sales/${id}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
export interface Customer {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  phone: string | null;
  email: string | null;
}
export interface SaleHistory {
  id: string;
  number: string;
  status: 'COMPLETED' | 'VOIDED';
  paymentMethod: string;
  total: string;
  createdAt: string;
  voidReason: string | null;
  branch: { name: string };
  user: { displayName: string };
  customer: Customer | null;
  items: Array<{
    id: string;
    quantity: string;
    product: { commercialName: string; internalCode: string };
  }>;
}
export interface CashHistory {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openingAmount: string;
  expectedAmount: string | null;
  closingAmount: string | null;
  openedAt: string;
  closedAt: string | null;
  branch: { name: string };
  openedBy: { displayName: string };
  closedBy: { displayName: string } | null;
  sales: Array<{ total: string; paymentMethod: string }>;
}
export const getCustomers = (search = '') =>
  request<Customer[]>(`/customers?search=${encodeURIComponent(search)}`);
export const createCustomer = (data: {
  documentType: string;
  documentNumber: string;
  name: string;
  phone?: string;
  email?: string;
}) => request<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) });
export const getSalesHistory = (search = '') =>
  request<SaleHistory[]>(`/pos/sales?search=${encodeURIComponent(search)}`);
export const getCashHistory = () => request<CashHistory[]>('/pos/cash-sessions');
export interface PurchaseOrder {
  id: string;
  number: string;
  status: string;
  total: string;
  createdAt: string;
  branch: { name: string };
  supplier: { id: string; legalName: string };
  items: Array<{
    id: string;
    orderedQuantity: string;
    receivedQuantity: string;
    unitCost: string;
    product: { id: string; commercialName: string };
  }>;
}
export const getPurchaseContext = () =>
  request<{
    branches: Array<{ id: string; name: string }>;
    suppliers: Array<{ id: string; legalName: string }>;
  }>('/purchases/context');
export const getPurchases = () => request<PurchaseOrder[]>('/purchases');
export const createSupplier = (data: {
  taxId: string;
  legalName: string;
  tradeName?: string;
  phone?: string;
}) =>
  request<{ id: string; legalName: string }>('/purchases/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const createPurchase = (data: {
  branchId: string;
  supplierId: string;
  items: Array<{ productId: string; quantity: number; unitCost: number; taxRate: number }>;
}) => request<PurchaseOrder>('/purchases', { method: 'POST', body: JSON.stringify(data) });
export const approvePurchase = (id: string) =>
  request<PurchaseOrder>(`/purchases/${id}/approve`, { method: 'POST' });
export const receivePurchase = (
  id: string,
  data: {
    idempotencyKey: string;
    items: Array<{ itemId: string; quantity: number; lotNumber: string; expiresAt: string }>;
  },
) =>
  request<{ order: PurchaseOrder; idempotent: boolean }>(`/purchases/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
export interface Transfer {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  originBranch: { name: string };
  destinationBranch: { name: string };
  items: Array<{
    id: string;
    quantity: string;
    product: { commercialName: string };
    sourceBatch: { lotNumber: string };
  }>;
}
export interface InventoryCount {
  id: string;
  number: string;
  status: string;
  reason: string;
  createdAt: string;
  branch: { name: string };
  items: Array<{
    id: string;
    expectedQuantity: string;
    countedQuantity: string;
    batch: { lotNumber: string; product: { commercialName: string } };
  }>;
}
export const getTransfers = () => request<Transfer[]>('/transfers');
export const shipTransfer = (id: string) =>
  request<Transfer>(`/transfers/${id}/ship`, { method: 'POST' });
export const receiveTransfer = (id: string) =>
  request<Transfer>(`/transfers/${id}/receive`, { method: 'POST' });
export const cancelTransfer = (id: string) =>
  request<{ transfer: Transfer; idempotent: boolean }>(`/transfers/${id}/cancel`, {
    method: 'POST',
  });
export const getInventoryCounts = () => request<InventoryCount[]>('/inventory-counts');
export const approveInventoryCount = (id: string) =>
  request<InventoryCount>(`/inventory-counts/${id}/approve`, { method: 'POST' });
export const applyInventoryCount = (id: string) =>
  request<InventoryCount>(`/inventory-counts/${id}/apply`, { method: 'POST' });
export const createSaleReturn = (data: {
  saleId: string;
  reason: string;
  idempotencyKey: string;
  items: Array<{ saleItemId: string; quantity: number }>;
}) =>
  request<{ return: { id: string; number: string; total: string }; idempotent: boolean }>(
    '/returns',
    { method: 'POST', body: JSON.stringify(data) },
  );
export interface AdminContext {
  establishment: {
    id: string;
    legalName: string;
    tradeName: string;
    taxId: string;
    timezone: string;
    currency: string;
  };
  branches: Array<{ id: string; code: string; name: string; active: boolean }>;
  roles: Array<{ id: string; code: string; name: string; system: boolean }>;
  users: Array<{
    id: string;
    email: string;
    displayName: string;
    status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
    failedLoginCount: number;
    lockedUntil: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    roles: Array<{ role: { code: string; name: string } }>;
  }>;
}
export const getAdminContext = () => request<AdminContext>('/admin/context');
export const createAdminUser = (data: {
  email: string;
  displayName: string;
  password: string;
  roleCodes: string[];
}) => request('/admin/users', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminUser = (
  id: string,
  data: { displayName?: string; status?: 'ACTIVE' | 'LOCKED' | 'DISABLED'; roleCodes?: string[] },
) => request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const resetAdminPassword = (id: string, password: string) =>
  request(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
export const createAdminBranch = (data: { code: string; name: string }) =>
  request('/admin/branches', { method: 'POST', body: JSON.stringify(data) });
export const updateAdminBranch = (
  id: string,
  data: { code?: string; name?: string; active?: boolean },
) => request(`/admin/branches/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateEstablishment = (data: {
  legalName: string;
  tradeName: string;
  taxId: string;
  timezone: string;
  currency: string;
}) => request('/admin/establishment', { method: 'PATCH', body: JSON.stringify(data) });
export interface ReportSummary {
  from: string;
  to: string;
  salesCount: number;
  grossSales: string;
  refunds: string;
  netSales: string;
  netCost: string;
  grossProfit: string;
  purchases: string;
  inventoryCostValue: string;
  inventoryRetailValue: string;
  cashDifference: string;
  paymentMethods: Array<{ method: string; total: string }>;
  topProducts: Array<{ name: string; quantity: string; total: string }>;
}
export const getReportSummary = (from: string, to: string) =>
  request<ReportSummary>(
    `/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  active: boolean;
  allowEntries: boolean;
}
export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  description: string;
  status: 'POSTED' | 'REVERSED';
  createdBy: { displayName: string };
  lines: Array<{
    id: string;
    debit: string;
    credit: string;
    account: AccountingAccount;
  }>;
  reversal: { id: string; number: string } | null;
}
export interface TrialBalance {
  rows: Array<{
    code: string;
    name: string;
    type: string;
    debit: string;
    credit: string;
    balance: string;
  }>;
  totalDebit: string;
  totalCredit: string;
}
export const getAccountingAccounts = () => request<AccountingAccount[]>('/accounting/accounts');
export const getJournalEntries = () => request<JournalEntry[]>('/accounting/entries');
export const getTrialBalance = (from: string, to: string) =>
  request<TrialBalance>(
    `/accounting/trial-balance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
export const createJournalEntry = (data: {
  date: string;
  description: string;
  lines: Array<{ accountId: string; debit: number; credit: number }>;
}) =>
  request<JournalEntry>('/accounting/entries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
export const reverseJournalEntry = (id: string, reason: string) =>
  request<JournalEntry>(`/accounting/entries/${id}/reverse`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
export interface PortfolioSummary {
  receivableBalance: string;
  payableBalance: string;
  overdueReceivable: number;
  overduePayable: number;
}
export interface Receivable {
  id: string;
  originalAmount: string;
  balance: string;
  dueDate: string;
  status: string;
  customer: { name: string; documentNumber: string };
  sale: { number: string; createdAt: string };
}
export interface Payable {
  id: string;
  originalAmount: string;
  balance: string;
  dueDate: string;
  status: string;
  supplier: { legalName: string; taxId: string };
  purchaseOrder: { number: string; createdAt: string };
}
export const getPortfolioSummary = () => request<PortfolioSummary>('/portfolio/summary');
export const getReceivables = () => request<Receivable[]>('/portfolio/receivables');
export const getPayables = () => request<Payable[]>('/portfolio/payables');
export const payReceivable = (id: string, amount: number, method: string) =>
  request(`/portfolio/receivables/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ amount, method, idempotencyKey: crypto.randomUUID() }),
  });
export const payPayable = (id: string, amount: number, method: string) =>
  request(`/portfolio/payables/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ amount, method, idempotencyKey: crypto.randomUUID() }),
  });
export async function downloadSalesCsv(from: string, to: string) {
  const response = await fetch(
    `${baseUrl}/reports/sales.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  );
  if (!response.ok) throw new Error('No se pudo exportar el reporte');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ventas-farmacore.csv';
  link.click();
  URL.revokeObjectURL(url);
}
export async function logout() {
  if (accessToken)
    await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  accessToken = null;
  refreshToken = null;
  sessionStorage.removeItem('farmacore.accessToken');
  sessionStorage.removeItem('farmacore.refreshToken');
}
