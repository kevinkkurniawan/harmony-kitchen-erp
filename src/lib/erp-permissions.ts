import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { SessionUser } from '@/lib/session';

// Menu keys of ERPDashboard; stored rows with other codes (old 'memo-sync-stok', 'sales-sync-stok') are ignored
export const ERP_MODULE_CODES = [
  'master-barang', 'inventory-stok', 'stok-opname', 'cetak-barcode', 'master-promo', 'master-supplier',
  'penerimaan-barang', 'penerimaan-barang-harga', 'sales-monitoring', 'laporan-penjualan',
] as const;

export interface StoredPermission {
  userId: number;
  moduleCode: string;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPrint: boolean;
}

function defaultPermission(user: SessionUser, moduleCode: string): StoredPermission {
  const isAdmin = user.userLevel === 'Admin';
  return {
    userId: user.id,
    moduleCode,
    canView: true,
    canAdd: isAdmin,
    canEdit: isAdmin,
    canDelete: isAdmin,
    canPrint: isAdmin,
  };
}

export async function getPermissionsForUser(user: SessionUser): Promise<StoredPermission[]> {
  let saved: StoredPermission[] = [];
  try {
    saved = await prisma.$queryRaw<StoredPermission[]>(Prisma.sql`
      SELECT user_id AS "userId", module_code AS "moduleCode", can_view AS "canView",
        can_add AS "canAdd", can_edit AS "canEdit", can_delete AS "canDelete", can_print AS "canPrint"
      FROM erp_user_permission WHERE user_id = ${user.id}
    `);
  } catch {
    // The application remains usable before the included migration is applied.
  }
  const savedByCode = new Map(saved.map((permission) => [permission.moduleCode, permission]));
  return ERP_MODULE_CODES.map((moduleCode) => savedByCode.get(moduleCode) || defaultPermission(user, moduleCode));
}

export async function canViewHpp(): Promise<boolean> {
  const user = await getCurrentUserSafely();
  return user?.userLevel === 'Admin';
}

async function getCurrentUserSafely(): Promise<SessionUser | null> {
  const { getCurrentUser } = await import('@/lib/session');
  return getCurrentUser();
}

export async function savePermissions(userId: number, permissions: StoredPermission[]) {
  const allowed = new Set<string>(ERP_MODULE_CODES);
  // One tick per module (like Module Manager's tree) = canView; the other flags are written equal to it
  await prisma.$transaction(permissions.filter((permission) => allowed.has(permission.moduleCode)).map((permission) => {
    const open = Boolean(permission.canView);
    return prisma.$executeRaw(Prisma.sql`
      INSERT INTO erp_user_permission (user_id, module_code, can_view, can_add, can_edit, can_delete, can_print, updated_at)
      VALUES (${userId}, ${permission.moduleCode}, ${open}, ${open}, ${open}, ${open}, ${open}, NOW())
      ON CONFLICT (user_id, module_code) DO UPDATE SET
        can_view = EXCLUDED.can_view, can_add = EXCLUDED.can_add, can_edit = EXCLUDED.can_edit,
        can_delete = EXCLUDED.can_delete, can_print = EXCLUDED.can_print, updated_at = NOW()
    `);
  }));
}
