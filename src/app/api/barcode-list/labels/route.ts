import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';

const MAX_IDS = 2000;

// Label data (barcode, name, retail price) for given items, used by Stok Opname "Print Barcode"
// (old Rpt_OpnameBarcode). Retail price only: opname line prices can be HPP and stay Admin-only.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ids = Array.from(
      new Set(
        (searchParams.get('ids') || '')
          .split(',')
          .map((s) => Number(s))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    );
    if (ids.length === 0) return apiSuccess([]);
    if (ids.length > MAX_IDS) return apiError('VALIDATION_ERROR', `Maksimal ${MAX_IDS} barang per cetak.`, 400);

    const items = await prisma.m_inventory.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, barcode: true, inventoryno: true, inventoryname: true, price: true },
    });
    return apiSuccess(
      items.map((i) => ({
        inventoryId: Number(i.id),
        barcode: i.barcode || '',
        inventoryNo: i.inventoryno || '',
        inventoryName: i.inventoryname || '',
        price: Number(i.price || 0),
      })),
    );
  } catch (error: unknown) {
    console.error('Error in GET /api/barcode-list/labels:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error && error.message) || 'Gagal memuat data label', 500);
  }
}
