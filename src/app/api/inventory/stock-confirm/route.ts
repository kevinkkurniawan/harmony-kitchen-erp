import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { canUserOpname } from '@/lib/capabilities';
import { buildInventorySearchConditions } from '@/lib/column-filter';
import { saveOpnameTransaction, StockMismatchError } from '@/lib/stock-opname';
import { recordAuditEvent } from '@/lib/audit-event';
import { apiError, apiSuccess } from '@/lib/api-response';

// Konfirmasi Stok (client, 23 Nov): staff count an item and may only confirm a count equal to the system stock.
// A mismatch is refused and logged; only the Admin changes stock (Stok Opname). The system stock is never sent
// to a non-admin here, so staff count blind instead of copying the number.

const EVENT_TYPE = 'STOCK_CONFIRM';
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface ConfirmLog {
  inventoryId: number;
  barcode: string;
  inventoryNo: string;
  inventoryName: string;
  countedQty: number;
  systemQty: number;
  match: boolean;
  noTransaction: string | null;
}

// GET ?q=      item search (no stock in the result)
// GET ?log=1   today's confirmations (WIB): the owner (who fixes the stock) sees everyone's with the system
//              stock; everyone else, other Admins included, only their own and blind
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    const isAdmin = canUserOpname(user);
    const { searchParams } = new URL(req.url);

    if (searchParams.get('log') === '1') {
      const dayStart = new Date(Math.floor((Date.now() + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS);
      const events = await prisma.t_auditevent.findMany({
        where: { eventtype: EVENT_TYPE, actiondate: { gte: dayStart }, ...(isAdmin ? {} : { actor: user.username }) },
        orderBy: { actiondate: 'desc' },
        take: 500,
      });
      return apiSuccess(events.map((e) => {
        const d = (e.afterdata || {}) as Partial<ConfirmLog>;
        return {
          id: String(e.id),
          time: e.actiondate,
          user: e.actor,
          inventoryId: Number(d.inventoryId || e.entityid),
          barcode: d.barcode || '',
          inventoryNo: d.inventoryNo || '',
          inventoryName: d.inventoryName || '',
          countedQty: Number(d.countedQty ?? 0),
          systemQty: isAdmin ? Number(d.systemQty ?? 0) : null,
          match: Boolean(d.match),
          noTransaction: d.noTransaction || null,
        };
      }));
    }

    if (!(searchParams.get('q') || '').trim()) return apiSuccess([]);
    const items = await prisma.m_inventory.findMany({
      where: { isactive: true, AND: buildInventorySearchConditions(searchParams) },
      select: { id: true, barcode: true, inventoryno: true, inventoryname: true, syncdate: true },
      orderBy: { inventoryname: 'asc' },
      take: 20,
    });
    return apiSuccess(items.map((i) => ({
      id: Number(i.id),
      barcode: i.barcode || '',
      inventoryNo: i.inventoryno || '',
      inventoryName: i.inventoryname || '',
      lastSync: i.syncdate,
    })));
  } catch (error: unknown) {
    console.error('Error in GET /api/inventory/stock-confirm:', error);
    return apiError('INTERNAL_ERROR', 'Gagal memuat data konfirmasi stok.', 500);
  }
}

// POST { inventoryId, qty }: equal to the live stock -> SCO count document (stock unchanged, Last Sync = today);
// different -> 409, nothing posted, the attempt is logged for the Admin.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    const body = await req.json().catch(() => ({}));
    const inventoryId = Number(body.inventoryId);
    const qty = Number(body.qty);
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) return apiError('VALIDATION_ERROR', 'Barang wajib dipilih.', 400);
    if (body.qty === '' || body.qty == null || !Number.isInteger(qty) || qty < 0 || qty > 1_000_000) {
      return apiError('VALIDATION_ERROR', 'Qty hitung harus angka bulat 0 atau lebih.', 400);
    }

    const item = await prisma.m_inventory.findUnique({
      where: { id: BigInt(inventoryId) },
      select: { barcode: true, inventoryno: true, inventoryname: true, isactive: true },
    });
    if (!item || item.isactive === false) return apiError('NOT_FOUND', 'Barang tidak ditemukan atau tidak aktif.', 404);
    const info = { inventoryId, barcode: item.barcode || '', inventoryNo: item.inventoryno || '', inventoryName: item.inventoryname || '' };

    let log: ConfirmLog;
    try {
      const saved = await saveOpnameTransaction({
        mode: 'COUNT',
        action: 'post',
        requireMatch: true,
        notes: `Konfirmasi Stok oleh ${user.username}`,
        items: [{ inventoryId, qty }],
        actor: user.username,
      });
      log = { ...info, countedQty: qty, systemQty: qty, match: true, noTransaction: saved.header?.notransaction || null };
    } catch (error) {
      if (!(error instanceof StockMismatchError)) throw error;
      log = { ...info, countedQty: qty, systemQty: error.systemQty, match: false, noTransaction: null };
    }

    await recordAuditEvent({
      eventType: EVENT_TYPE,
      entityType: 'INVENTORY',
      entityId: String(inventoryId),
      actor: user.username,
      reason: log.match ? 'Stok sesuai' : 'Stok tidak sama',
      afterData: log,
    });

    if (!log.match) {
      return apiError('STOCK_MISMATCH', 'Stok tidak sama dengan sistem. Hubungi admin.', 409);
    }
    return apiSuccess({ ...info, noTransaction: log.noTransaction }, 'Stok sesuai, berhasil dikonfirmasi.');
  } catch (error: unknown) {
    console.error('Error in POST /api/inventory/stock-confirm:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error && error.message) || 'Gagal konfirmasi stok.', 500);
  }
}
