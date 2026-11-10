import { prisma } from '@/lib/db';
import { requireCapability } from '@/lib/capabilities';
import { normalizeInventoryName, validateInventoryName } from '@/lib/inventory-name';
import { recordAuditEvent } from '@/lib/audit-event';
import { apiError, apiSuccess } from '@/lib/api-response';

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// Stok Opname ".:: Detail ::." Submit for a scanned barcode that no item has (old sp_T_Opname_InsUpdInventory):
// creates the item, which the screen then adds to the opname lines. Stock is not touched here; it changes only
// when the opname is posted. Creating an item is master data, so it needs INVENTORY_EDIT like Master Barang.
export async function POST(req: Request) {
  try {
    const auth = await requireCapability('INVENTORY_EDIT');
    if ('errorResponse' in auth) return auth.errorResponse;
    const actor = auth.user.username || 'system';

    const body = await req.json().catch(() => ({}));
    const barcode = text(body.barcode);
    const inventoryNo = text(body.inventoryNo);
    const nameError = validateInventoryName(body.inventoryName);
    if (!barcode) return apiError('VALIDATION_ERROR', 'Barcode wajib diisi.', 400);
    if (!inventoryNo) return apiError('VALIDATION_ERROR', 'Inv No. wajib diisi.', 400);
    if (nameError) return apiError('VALIDATION_ERROR', nameError, 400);

    const created = await prisma.$transaction(async (tx) => {
      // Serialise creates of the same barcode / number so two scanners cannot both pass the check below
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'opname-item:' + barcode.toLowerCase()}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'opname-item:' + inventoryNo.toLowerCase()}))`;

      // Old SP: insert only when no item has this barcode. Scans also match the No. Barang, so neither value
      // may already be a barcode or No. Barang of another item.
      const clash = await tx.$queryRaw<{ inventoryno: string | null; inventoryname: string | null }[]>`
        SELECT inventoryno, inventoryname FROM m_inventory
        WHERE lower(trim(barcode)) IN (lower(${barcode}), lower(${inventoryNo}))
           OR lower(trim(inventoryno)) IN (lower(${barcode}), lower(${inventoryNo}))
        LIMIT 1
      `;
      if (clash.length > 0) {
        return { clash: `${clash[0].inventoryno || ''} - ${clash[0].inventoryname || ''}` };
      }

      const now = new Date();
      const item = await tx.m_inventory.create({
        data: {
          barcode,
          inventoryno: inventoryNo,
          inventoryname: normalizeInventoryName(body.inventoryName),
          // Brand / Category / Satuan were hidden in the old form; the ERP defaults (id 1) keep the FKs valid
          inventorybrandid: 1,
          inventorycategoryid: 1,
          inventoryproductid: 1,
          uomid: 1,
          kodeharga: text(body.kodeHarga) || 'STD',
          description: text(body.description),
          price: 0,
          hpp: 0,
          pricebuy: 0,
          stokawal: 0,
          stokupdate: 0,
          isactive: true,
          createduser: actor,
          createddate: now,
          modifieduser: actor,
          modifieddate: now,
        },
        select: { id: true, barcode: true, inventoryno: true, inventoryname: true, price: true, description: true },
      });
      await recordAuditEvent(
        {
          actor,
          eventType: 'INVENTORY_CREATE',
          entityType: 'INVENTORY',
          entityId: String(item.id),
          afterData: { barcode, inventoryNo, inventoryName: item.inventoryname, source: 'STOK_OPNAME_SCAN' },
          reason: 'Barang baru dari scan Stok Opname',
        },
        tx,
      );
      return { item };
    });

    if ('clash' in created) {
      return apiError('CONFLICT', `Barcode / Inv No. sudah dipakai barang ${created.clash}.`, 409);
    }
    const { item } = created;
    return apiSuccess(
      {
        id: Number(item.id),
        barcode: item.barcode || '',
        inventoryNo: item.inventoryno || '',
        inventoryName: item.inventoryname || '',
        price: Number(item.price || 0),
        description: item.description || '',
      },
      'Barang baru berhasil dibuat.',
      201,
    );
  } catch (error: unknown) {
    console.error('Error in POST /api/inventory/opname/item:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error && error.message) || 'Gagal membuat barang baru', 500);
  }
}
