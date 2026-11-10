import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { apiError, apiSuccess } from '@/lib/api-response';

// Saved ".: Barcode Print List :." of the old Frm_InvList (table m_invprintbarcode, SPs
// sp_MDInventory_PrintBarcode*). One shared list for the whole shop, like the old app.

interface ListRow {
  inventory_id: number;
  barcode: string | null;
  inventory_no: string | null;
  inventory_name: string | null;
  price: number | null;
  qty: number;
}

const MAX_QTY = 999;

function parseInventoryId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// sp_MDInventory_PrintBarcodeList: unprinted rows joined to the item (barcode, name and price come from
// m_inventory). Rows are summed per item: the old InsList added a new row per click, so one item can have several.
export async function GET() {
  try {
    const rows = await prisma.$queryRaw<ListRow[]>`
      SELECT p.inventoryid AS inventory_id, i.barcode, i.inventoryno AS inventory_no, i.inventoryname AS inventory_name,
             i.price, SUM(COALESCE(p.qty, 0))::int AS qty
      FROM m_invprintbarcode p
      JOIN m_inventory i ON i.id = p.inventoryid
      WHERE COALESCE(p.isprinted, false) = false
      GROUP BY p.inventoryid, i.barcode, i.inventoryno, i.inventoryname, i.price
      ORDER BY MIN(p.id)
    `;
    return apiSuccess(
      rows.map((r) => ({
        inventoryId: r.inventory_id,
        barcode: r.barcode || '',
        inventoryNo: r.inventory_no || '',
        inventoryName: r.inventory_name || '',
        price: Number(r.price || 0),
        qty: r.qty,
      })),
    );
  } catch (error: unknown) {
    console.error('Error in GET /api/barcode-list:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error && error.message) || 'Gagal memuat list barcode', 500);
  }
}

// sp_MDInventory_PrintBarcodeInsList: one more label for the item. An item already in the list gets qty + n
// instead of a second row, which prints the same labels as the old extra row.
export async function POST(req: Request) {
  try {
    const actor = (await getCurrentUser())?.username || 'system';
    const body = await req.json().catch(() => ({}));
    const inventoryId = parseInventoryId(body.inventoryId);
    const addQty = body.qty === undefined ? 1 : Number(body.qty);
    if (!inventoryId) return apiError('VALIDATION_ERROR', 'Barang wajib dipilih.', 400);
    if (!Number.isInteger(addQty) || addQty < 1 || addQty > MAX_QTY) {
      return apiError('VALIDATION_ERROR', `Qty harus 1 - ${MAX_QTY}.`, 400);
    }

    const item = await prisma.m_inventory.findUnique({
      where: { id: inventoryId },
      select: { id: true, barcode: true, inventoryno: true, inventoryname: true, description: true, price: true },
    });
    if (!item) return apiError('NOT_FOUND', 'Barang tidak ditemukan.', 404);

    const now = new Date();
    // One add at a time per item: two quick scans must both count (read + write under a lock)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'barcode-list:' + inventoryId}))`;
      const existing = await tx.m_invprintbarcode.findFirst({
        where: { inventoryid: inventoryId, OR: [{ isprinted: false }, { isprinted: null }] },
        orderBy: { id: 'asc' },
      });
      if (existing) {
        await tx.m_invprintbarcode.update({
          where: { id: existing.id },
          data: { qty: Math.min(MAX_QTY, (existing.qty || 0) + addQty), modifieduser: actor, modifieddate: now },
        });
      } else {
        await tx.m_invprintbarcode.create({
          data: {
            inventoryid: inventoryId,
            barcode: item.barcode || '',
            inventoryno: item.inventoryno || '',
            price: item.price || 0,
            qty: addQty,
            isprinted: false,
            createduser: actor,
            createddate: now,
            modifieduser: actor,
            modifieddate: now,
          },
        });
      }
    });
    return apiSuccess({
      inventoryId,
      inventoryNo: item.inventoryno || '',
      inventoryName: item.inventoryname || '',
      description: item.description || '',
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/barcode-list:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error && error.message) || 'Perintah Masukan Gagal', 500);
  }
}

// sp_MDInventory_PrintBarcodeUpdList: set the item's qty. Extra rows of the same item are folded into the
// first one so the summed qty in GET equals what was typed.
export async function PUT(req: Request) {
  try {
    const actor = (await getCurrentUser())?.username || 'system';
    const body = await req.json().catch(() => ({}));
    const inventoryId = parseInventoryId(body.inventoryId);
    const qty = Number(body.qty);
    if (!inventoryId) return apiError('VALIDATION_ERROR', 'Barang wajib dipilih.', 400);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return apiError('VALIDATION_ERROR', `Qty harus 1 - ${MAX_QTY}.`, 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.m_invprintbarcode.findMany({
        where: { inventoryid: inventoryId, OR: [{ isprinted: false }, { isprinted: null }] },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (rows.length === 0) return false;
      await tx.m_invprintbarcode.update({
        where: { id: rows[0].id },
        data: { qty, modifieduser: actor, modifieddate: new Date() },
      });
      if (rows.length > 1) {
        await tx.m_invprintbarcode.deleteMany({ where: { id: { in: rows.slice(1).map((r) => r.id) } } });
      }
      return true;
    });
    if (!updated) return apiError('NOT_FOUND', 'Barang tidak ada di list barcode.', 404);
    return apiSuccess({ inventoryId, qty });
  } catch (error: unknown) {
    console.error('Error in PUT /api/barcode-list:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error && error.message) || 'Gagal menyimpan qty', 500);
  }
}

// ?inventoryId=n = sp_MDInventory_PrintBarcodeDelList ("Delete Row"); ?all=1 = sp_MDInventory_PrintBarcodeDelAll
// ("Hapus Data List Barcode"). Clearing everything needs the explicit flag, so a bare DELETE removes nothing.
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('all') === '1') {
      const { count } = await prisma.m_invprintbarcode.deleteMany({});
      return apiSuccess({ deleted: count });
    }
    const inventoryId = parseInventoryId(searchParams.get('inventoryId'));
    if (!inventoryId) return apiError('VALIDATION_ERROR', 'Barang wajib dipilih.', 400);
    const { count } = await prisma.m_invprintbarcode.deleteMany({ where: { inventoryid: inventoryId } });
    return apiSuccess({ deleted: count });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/barcode-list:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error && error.message) || 'Perintah Hapus Gagal', 500);
  }
}
