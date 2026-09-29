import { prisma } from '@/lib/db';
import { getCurrentUser, SessionUser } from '@/lib/session';
import { ApiErrors } from '@/lib/api-response';
import { NextResponse } from 'next/server';

export interface CapabilityDefinition {
  code: string;
  name: string;
  description: string;
  category: 'Inventory' | 'Sales' | 'POS' | 'Barcode' | 'Reporting';
}

export const SENSITIVE_CAPABILITIES: CapabilityDefinition[] = [
  {
    code: 'OPNAME_POST',
    name: 'Posting Stock Opname',
    description: 'Posting draft opname menjadi pergerakan stok transaksi',
    category: 'Inventory',
  },
  {
    code: 'OPNAME_REVERSE',
    name: 'Reversal Stock Opname',
    description: 'Membatalkan opname yang sudah diposting dengan pergerakan kompensasi',
    category: 'Inventory',
  },
  {
    code: 'INVENTORY_EDIT',
    name: 'Edit Master Barang',
    description: 'Menambah dan mengubah data barang di Master Barang',
    category: 'Inventory',
  },
  {
    code: 'PAYMENT_TYPE_CORRECTION',
    name: 'Koreksi Tipe Pembayaran',
    description: 'Mengubah tipe pembayaran nota penjualan di Sales Monitoring',
    category: 'Sales',
  },
  {
    code: 'REPRINT_RECEIPT',
    name: 'Reprint Struk Penjualan',
    description: 'Mencetak ulang struk penjualan bertanda reprint',
    category: 'Sales',
  },
  {
    code: 'SALES_VOID',
    name: 'Void Penjualan',
    description: 'Membatalkan nota penjualan dan mengembalikan stok',
    category: 'Sales',
  },
  {
    code: 'SALES_UNVOID',
    name: 'Unvoid Penjualan',
    description: 'Memulihkan status nota yang sebelumnya divoid (otoritas tinggi)',
    category: 'Sales',
  },
  {
    code: 'OVERRIDE_GROSIR_1',
    name: 'Override Grosir 1 POS',
    description: 'Menerapkan Harga Grosir 1 ke seluruh item aktif keranjang POS',
    category: 'POS',
  },
  {
    code: 'MANUAL_DISCOUNT',
    name: 'Diskon Manual POS',
    description: 'Memberikan diskon nominal atau persentase manual per nota POS',
    category: 'POS',
  },
  {
    code: 'BARCODE_MANAGE',
    name: 'Akses Halaman Barcode',
    description: 'Membuka dan memilih batch barang pada halaman Create Barcode',
    category: 'Barcode',
  },
  {
    code: 'BARCODE_PRINT',
    name: 'Cetak Label Barcode',
    description: 'Mencetak label barcode dari browser',
    category: 'Barcode',
  },
  {
    code: 'VIEW_HPP_PROFIT',
    name: 'Lihat HPP & Net Income',
    description: 'Melihat data HPP, laba kotor, dan margin pada laporan dan transaksi',
    category: 'Reporting',
  },
];

export async function hasCapability(user: SessionUser | null, capabilityCode: string): Promise<boolean> {
  if (!user) return false;
  if (user.userLevel === 'Admin') return true;

  try {
    const grant = await prisma.t_usercapability.findUnique({
      where: {
        userid_capabilitycode: {
          userid: user.id,
          capabilitycode: capabilityCode,
        },
      },
    });
    return grant?.isgranted === true;
  } catch (error) {
    console.error(`Error checking capability ${capabilityCode} for user ${user.id}:`, error);
    return false;
  }
}

export async function requireCapability(
  capabilityCode: string
): Promise<{ user: SessionUser } | { errorResponse: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { errorResponse: ApiErrors.unauthorized('Sesi login diperlukan.') };
  }

  const allowed = await hasCapability(user, capabilityCode);
  if (!allowed) {
    return {
      errorResponse: ApiErrors.forbidden(
        `Anda tidak memiliki izin untuk aksi: ${capabilityCode}`
      ),
    };
  }

  return { user };
}

export async function getUserCapabilities(userId: number): Promise<Record<string, boolean>> {
  const grants = await prisma.t_usercapability.findMany({
    where: { userid: userId },
  });

  const result: Record<string, boolean> = {};
  for (const cap of SENSITIVE_CAPABILITIES) {
    const found = grants.find((g) => g.capabilitycode === cap.code);
    result[cap.code] = found ? found.isgranted : false;
  }
  return result;
}
