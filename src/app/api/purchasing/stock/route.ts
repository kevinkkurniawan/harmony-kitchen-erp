import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';

/** "Lihat Stok": current stock (m_inventory.stokupdate) of the items on a receipt, ?ids=1,2,3 (max 500). */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);

    const ids = (new URL(req.url).searchParams.get('ids') || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s))
      .slice(0, 500);
    if (ids.length === 0) return apiSuccess([]);

    const rows = await prisma.m_inventory.findMany({
      where: { id: { in: ids.map((s) => BigInt(s)) } },
      select: { id: true, barcode: true, inventoryno: true, inventoryname: true, stokupdate: true, m_uom: { select: { uomname: true, uomcode: true } } },
    });
    return apiSuccess(rows.map((r) => ({
      id: String(r.id),
      barcode: r.barcode || '',
      inventoryNo: r.inventoryno || '',
      inventoryName: r.inventoryname || '',
      uomName: r.m_uom?.uomname || r.m_uom?.uomcode || 'PCS',
      stock: Number(r.stokupdate || 0),
    })));
  } catch (error: unknown) {
    console.error('GET /api/purchasing/stock error:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error ? error.message : '') || 'Gagal memuat stok', 500);
  }
}
