import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { canUserViewHpp } from '@/lib/capabilities';
import { dateColumnDay } from '@/lib/date-utils';

/**
 * "Daily Report" data, as sp_SPPurchaseReceivement_GetReportDaily: every receipt of one MR date with its lines
 * (no void filter, like the SP), supplier name from the supplier master. Prices / totals are Admin-only.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    const canViewPrice = canUserViewHpp(user);

    const date = new URL(req.url).searchParams.get('date') || '';
    const day = dateColumnDay(date);
    if (!day) return apiError('BAD_REQUEST', 'Tanggal tidak valid (YYYY-MM-DD).', 400);

    const receipts = await prisma.t_materialreceiveheader.findMany({
      where: { mrdate: day },
      include: { t_materialreceivedetail: { orderBy: { id: 'asc' } } },
      orderBy: { mrno: 'asc' },
    });
    const supplierIds = Array.from(new Set(receipts.map((r) => r.supplierid).filter((n): n is number => n != null)));
    const inventoryIds = Array.from(new Set(receipts.flatMap((r) => r.t_materialreceivedetail.map((d) => Number(d.inventoryid)))))
      .filter((n) => Number.isInteger(n) && n > 0);
    const [suppliers, inventories] = await Promise.all([
      supplierIds.length ? prisma.m_supplier.findMany({ where: { id: { in: supplierIds.map((n) => BigInt(n)) } }, select: { id: true, suppliername: true } }) : [],
      inventoryIds.length ? prisma.m_inventory.findMany({ where: { id: { in: inventoryIds.map((n) => BigInt(n)) } }, select: { id: true, inventoryname: true } }) : [],
    ]);
    const supplierName = new Map(suppliers.map((s) => [Number(s.id), s.suppliername]));
    const inventoryName = new Map(inventories.map((i) => [Number(i.id), i.inventoryname]));
    const money = (v: unknown) => (canViewPrice ? Number(v || 0) : null);

    const data = receipts.map((r) => ({
      id: Number(r.id),
      mrNo: r.mrno || '',
      description: r.description || '',
      supplierName: (r.supplierid != null && supplierName.get(r.supplierid)) || r.suppliername || '',
      // Old report: PaymentType 0 (cash) = "Pembayaran Tunai", anything else "Pembayaran Kredit"; the ERP stores cash as 1
      isCash: r.paymenttype === 1,
      isPaid: Boolean(r.ispaid),
      disc1: Number(r.disc1 ?? r.discpercentage ?? 0),
      disc2: Number(r.disc2 || 0),
      disc3: Number(r.disc3 || 0),
      discValue: money(r.discvalue),
      ppnPercentage: Number(r.ppnpercentage || 0),
      ppnValue: money(r.ppnvalue),
      grandTotal: money(r.grandtotal),
      items: r.t_materialreceivedetail.map((d) => {
        const qty = Number(d.qty || 0);
        const price = Number(d.price || 0);
        const subtotal = Number(d.subtotal || 0);
        return {
          id: Number(d.id),
          inventoryName: inventoryName.get(Number(d.inventoryid)) || '',
          qty,
          price: money(price),
          // Rows saved before disctotal was stored: per-unit discount = price - subtotal / qty
          discTotal: money(d.disctotal ?? (qty ? price - subtotal / qty : 0)),
          subtotal: money(subtotal),
        };
      }),
    }));

    return apiSuccess({ date, receipts: data });
  } catch (error: unknown) {
    console.error('GET /api/purchasing/daily-report error:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error ? error.message : '') || 'Gagal memuat laporan', 500);
  }
}
