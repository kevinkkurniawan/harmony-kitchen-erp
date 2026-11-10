// Access rules for /api/*, enforced centrally by src/proxy.ts. Kept free of Next/Prisma imports so it is unit-testable.

export interface ModulePermission {
  moduleCode: string;
  canView: boolean;
}

// Reachable without an ERP session: the login form and the session check that decides whether to show it.
// No other app (POS, scanner) calls the ERP API; they have their own API routes.
const PUBLIC_API_PATHS = new Set(['/api/auth/login', '/api/auth/logout', '/api/auth/session']);

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Data-changing API path prefix -> modules whose view tick allows the change (any one is enough).
// Most specific prefix first. A write to a path that matches no rule is Admin-only (fail closed): these are
// endpoints no ERP screen calls (users, banks, customers, employees, inventory/usage, purchasing orders/payments/...).
const WRITE_MODULE_RULES: { prefix: string; modules: string[] }[] = [
  // Master Barang "Tambahkan Stok Opname" posts to the opname API directly
  { prefix: '/api/inventory/opname', modules: ['stok-opname', 'master-barang'] },
  { prefix: '/api/inventory/usage', modules: [] },
  { prefix: '/api/inventory', modules: ['master-barang'] },
  { prefix: '/api/wholesale-categories', modules: ['master-barang'] },
  { prefix: '/api/barcode', modules: ['cetak-barcode'] },
  { prefix: '/api/promos', modules: ['master-promo'] },
  { prefix: '/api/suppliers', modules: ['master-supplier'] },
  { prefix: '/api/purchasing/express', modules: ['penerimaan-barang'] },
  { prefix: '/api/purchasing/priced', modules: ['penerimaan-barang-harga'] },
  { prefix: '/api/sales/monitoring', modules: ['sales-monitoring'] },
  { prefix: '/api/memos', modules: ['memo-sync-stok'] },
  // Own password change, open to every logged-in user: 'own-account' is no ERP module, so it never has a
  // permission row and decideWrite counts it as viewable. The route itself only changes the session user.
  { prefix: '/api/auth/change-password', modules: ['own-account'] },
  // Saved barcode print list: Cetak Barcode screen, and Master Barang right-click "Cetak Barcode"
  { prefix: '/api/barcode-list', modules: ['cetak-barcode', 'master-barang'] },
];

const MODULE_LABELS: Record<string, string> = {
  'memo-sync-stok': 'Memo Sync Stok',
  'stok-opname': 'Stok Opname',
  'master-barang': 'Master Barang',
  'cetak-barcode': 'Cetak Barcode',
  'master-promo': 'Master Promo',
  'master-supplier': 'Master Supplier',
  'penerimaan-barang': 'Penerimaan Barang Ekspress',
  'penerimaan-barang-harga': 'Penerimaan Barang dengan harga',
  'sales-monitoring': 'Sales Monitoring',
};

export function normalizeApiPath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.has(normalizeApiPath(pathname));
}

export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

// Modules that allow a write to this path; [] means Admin only.
export function writeModulesFor(pathname: string): string[] {
  const path = normalizeApiPath(pathname);
  const rule = WRITE_MODULE_RULES.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`));
  return rule ? rule.modules : [];
}

export type WriteDecision = { allowed: true } | { allowed: false; message: string };

// Non-admin write check. A module without a saved row counts as viewable, the same default the menu uses
// (ERPDashboard canView), so users with no saved permission rows keep full access.
export function decideWrite(pathname: string, permissions: ModulePermission[]): WriteDecision {
  const modules = writeModulesFor(pathname);
  if (modules.length === 0) return { allowed: false, message: 'Hanya Admin yang dapat mengubah data ini.' };
  const byCode = new Map(permissions.map((permission) => [permission.moduleCode, permission]));
  if (modules.some((code) => byCode.get(code)?.canView ?? true)) return { allowed: true };
  const names = modules.map((code) => MODULE_LABELS[code] || code).join(' atau ');
  return { allowed: false, message: `Anda tidak memiliki hak akses modul ${names} untuk mengubah data.` };
}
