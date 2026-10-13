import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit-event';

export interface OpnameItemInput {
  inventoryId: number;
  barcode?: string;
  qty?: number;
  /** Adjustment mode: +/- change to apply to the current stock instead of a counted qty */
  adjustQty?: number;
  systemQty?: number;
  physicalQty?: number;
  unitPrice?: number;
  notes?: string;
}

/**
 * Mirrors the two legacy (Module Manager) stock documents in t_opname:
 * - ADJUST: "OPM-YYMMDD<seq>", qty holds the +/- difference
 * - COUNT:  stock check "SCO-...", qty holds the counted qty and syncdate the check date
 */
export type OpnameMode = 'ADJUST' | 'COUNT';

export function opnameModeOf(noTransaction: string | null | undefined): OpnameMode {
  return (noTransaction || '').toUpperCase().startsWith('OPM-') ? 'ADJUST' : 'COUNT';
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Next legacy-style document number for today (WIB), serialised by an advisory lock. */
async function generateOpnameNo(tx: Prisma.TransactionClient, mode: OpnameMode): Promise<string> {
  const ymd = new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(2, 10).replace(/-/g, '');
  const prefix = `${mode === 'ADJUST' ? 'OPM' : 'SCO'}-${ymd}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))::text`;
  const pattern = `^${prefix}[0-9]+$`;
  const rows = await tx.$queryRaw<{ seq: number | null }[]>`
    SELECT max(substring(notransaction from ${prefix.length + 1}::int)::int) AS seq FROM (
      SELECT notransaction FROM t_opname WHERE notransaction ~ ${pattern}
      UNION ALL
      SELECT notransaction FROM t_opnameheader WHERE notransaction ~ ${pattern}
    ) docs`;
  return `${prefix}${Number(rows[0]?.seq || 0) + 1}`;
}

/** Store calendar date (WIB) for DATE columns such as syncdate. */
function storeDate(date: Date): Date {
  return new Date(new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10));
}

export interface SaveOpnameParams {
  /** Leave empty for a new document: the server assigns OPM-/SCO- numbering */
  noTransaction?: string;
  mode?: OpnameMode;
  date?: string | Date;
  whId?: number;
  notes?: string;
  items: OpnameItemInput[];
  actor: string;
  action?: 'draft' | 'post';
  idempotencyKey?: string;
}

export interface ReverseOpnameParams {
  noTransaction: string;
  reason: string;
  actor: string;
  idempotencyKey?: string;
}

export async function saveOpnameTransaction(params: SaveOpnameParams) {
  const { notes, items, actor, action = 'draft', idempotencyKey } = params;
  const opnameDate = params.date ? new Date(params.date) : new Date();

  return prisma.$transaction(async (tx) => {
    // An existing document keeps its number (and mode); a new one gets the next legacy-style number
    const noTransaction =
      params.noTransaction?.trim() || (await generateOpnameNo(tx, params.mode === 'ADJUST' ? 'ADJUST' : 'COUNT'));
    const mode = opnameModeOf(noTransaction);

    // 1. Check existing header status
    const existingHeader = await tx.t_opnameheader.findUnique({
      where: { notransaction: noTransaction },
    });

    if (existingHeader) {
      if (existingHeader.status === 'POSTED') {
        if (action === 'post' && idempotencyKey && existingHeader.idempotencykey === idempotencyKey) {
          return { header: existingHeader, alreadyPosted: true };
        }
        throw new Error(`Transaksi opname ${noTransaction} sudah diposting dan tidak dapat diubah.`);
      }

      if (existingHeader.status === 'REVERSED') {
        throw new Error(`Transaksi opname ${noTransaction} telah dibatalkan (reversed).`);
      }
    }

    if (items.length === 0) {
      throw new Error('Daftar item stock opname tidak boleh kosong.');
    }

    // 2. Resolve items against current authoritative database stock
    const invIds = items.map((it) => Number(it.inventoryId)).filter(Boolean);
    const inventories = await tx.m_inventory.findMany({
      where: { id: { in: invIds } },
    });
    const invMap = new Map(inventories.map((i) => [Number(i.id), i]));

    const processedItems = items.map((it) => {
      const inv = invMap.get(Number(it.inventoryId));
      if (!inv) {
        throw new Error(`Barang dengan ID ${it.inventoryId} tidak ditemukan.`);
      }

      const currentLiveStock = Number(inv.stokupdate || 0);
      const targetQty =
        mode === 'ADJUST'
          ? currentLiveStock + Number(it.adjustQty ?? it.qty ?? 0)
          : Number(it.qty ?? it.physicalQty ?? 0);
      if (!Number.isFinite(targetQty) || targetQty < 0) {
        throw new Error(
          `Stok "${inv.inventoryname || it.inventoryId}" tidak boleh minus (stok sekarang ${currentLiveStock}, hasil ${targetQty}).`
        );
      }
      const diffQty = targetQty - currentLiveStock;
      const unitPrice = it.unitPrice !== undefined ? Number(it.unitPrice) : Number(inv.hpp || inv.price || 0);

      return {
        notransaction: noTransaction,
        inventoryid: Number(it.inventoryId),
        barcode: it.barcode || inv.barcode || '',
        qty: targetQty,
        systemqty: currentLiveStock,
        physicalqty: targetQty,
        differenceqty: diffQty,
        unitprice: unitPrice,
        notes: it.notes || '',
        currentLiveStock,
      };
    });

    // 3. Clear existing detail records
    await tx.t_opnamedetail.deleteMany({
      where: { notransaction: noTransaction },
    });
    await tx.t_opname.deleteMany({
      where: { notransaction: noTransaction },
    });

    // 4. Create new detail snapshots
    await tx.t_opnamedetail.createMany({
      data: processedItems.map((pi) => ({
        notransaction: pi.notransaction,
        inventoryid: pi.inventoryid,
        barcode: pi.barcode,
        systemqty: pi.systemqty,
        physicalqty: pi.physicalqty,
        differenceqty: pi.differenceqty,
        unitprice: pi.unitprice,
        notes: pi.notes,
      })),
    });

    let header;

    if (action === 'post') {
      // Legacy t_opname rows, written like Module Manager does and only once applied
      // (a draft row here would read as a real adjustment): OPM qty = +/- difference,
      // SCO qty = counted qty with the check date in syncdate.
      await tx.t_opname.createMany({
        data: processedItems.map((pi) => ({
          notransaction: pi.notransaction,
          inventoryid: pi.inventoryid,
          barcode: pi.barcode,
          qty: mode === 'ADJUST' ? pi.differenceqty : pi.qty,
          price: Math.round(pi.unitprice),
          description: pi.notes || '',
          opnamedate: storeDate(opnameDate),
          syncdate: mode === 'COUNT' ? storeDate(opnameDate) : null,
          createduser: actor,
          createddate: new Date(),
          modifieduser: actor,
          modifieddate: new Date(),
          isdone: true,
        })),
      });

      // 5. POSTING: Apply stock movements and update stock balance atomically
      for (const pi of processedItems) {
        // Always record a movement, even when the count matched (qty 0),
        // so the stock card shows the item was checked on this date
        {
          const isQtyIn = pi.differenceqty > 0;
          const qtyDelta = Math.abs(pi.differenceqty);

          // Flow header
          const flow = await tx.s_flowinventory.create({
            data: {
              stockdate: opnameDate,
              invoicecode: noTransaction,
              invoicetype: 3, // Opname Adjustment
              inventoryid: pi.inventoryid,
              whcode: params.whId || 1,
              qty: pi.differenceqty,
              price: pi.unitprice,
              createduser: actor,
              modifieduser: actor,
            },
          });

          // Flow detail
          await tx.s_flowdetailinventory.create({
            data: {
              flowinventoryid: Number(flow.id),
              invoicecode: noTransaction,
              invoicetype: 3,
              invoicedate: opnameDate,
              qtyin: isQtyIn ? qtyDelta : 0,
              qtyout: isQtyIn ? 0 : qtyDelta,
              pricein: isQtyIn ? pi.unitprice : 0,
              priceout: isQtyIn ? 0 : pi.unitprice,
              createduser: actor,
              modifieduser: actor,
            },
          });
        }

        // Set stock balance to EXACT opname quantity; syncdate is the legacy "last sync"
        // (last date the item's stock was checked), updated even when nothing changed
        await tx.m_inventory.update({
          where: { id: BigInt(pi.inventoryid) },
          data: {
            stokupdate: pi.qty,
            syncdate: storeDate(opnameDate),
          },
        });
      }

      // Conditional state transition for existing header
      if (existingHeader) {
        const transition = await tx.t_opnameheader.updateMany({
          where: { notransaction: noTransaction, status: 'DRAFT' },
          data: {
            opnamedate: opnameDate,
            whid: params.whId || 1,
            status: 'POSTED',
            notes: notes || '',
            posteduser: actor,
            posteddate: new Date(),
            idempotencykey: idempotencyKey,
          },
        });

        if (transition.count === 0) {
          throw new Error(`Gagal memposting opname ${noTransaction}: status transaksi telah berubah.`);
        }

        header = await tx.t_opnameheader.findUnique({
          where: { notransaction: noTransaction },
        });
      } else {
        header = await tx.t_opnameheader.create({
          data: {
            notransaction: noTransaction,
            opnamedate: opnameDate,
            whid: params.whId || 1,
            status: 'POSTED',
            notes: notes || '',
            createduser: actor,
            createddate: new Date(),
            posteduser: actor,
            posteddate: new Date(),
            idempotencykey: idempotencyKey,
          },
        });
      }

      await recordAuditEvent(
        {
          eventType: 'OPNAME_POST',
          entityType: 'OPNAME',
          entityId: noTransaction,
          actor,
          reason: notes || 'Posting stock opname transaksi',
          afterData: { noTransaction, itemCount: processedItems.length, status: 'POSTED' },
          idempotencyKey,
        },
        tx
      );
    } else {
      // 6. DRAFT: Save without altering inventory stock balances
      header = await tx.t_opnameheader.upsert({
        where: { notransaction: noTransaction },
        update: {
          opnamedate: opnameDate,
          whid: params.whId || 1,
          status: 'DRAFT',
          notes: notes || '',
        },
        create: {
          notransaction: noTransaction,
          opnamedate: opnameDate,
          whid: params.whId || 1,
          status: 'DRAFT',
          notes: notes || '',
          createduser: actor,
          createddate: new Date(),
        },
      });
    }

    return { header, items: processedItems };
  }, { maxWait: 15000, timeout: 60000 });
}

export async function reverseOpnameTransaction(params: ReverseOpnameParams) {
  const { noTransaction, reason, actor, idempotencyKey } = params;

  return prisma.$transaction(async (tx) => {
    const header = await tx.t_opnameheader.findUnique({
      where: { notransaction: noTransaction },
    });

    if (!header) {
      throw new Error(`Transaksi opname ${noTransaction} tidak ditemukan.`);
    }

    if (header.status === 'REVERSED') {
      return { header, alreadyReversed: true };
    }

    if (header.status !== 'POSTED') {
      throw new Error(`Hanya opname berstatus POSTED yang dapat di-reversal. Status saat ini: ${header.status}`);
    }

    // Atomic conditional transition from POSTED -> REVERSED
    const transition = await tx.t_opnameheader.updateMany({
      where: { notransaction: noTransaction, status: 'POSTED' },
      data: {
        status: 'REVERSED',
        reverseduser: actor,
        reverseddate: new Date(),
        reversedreason: reason,
      },
    });

    if (transition.count === 0) {
      throw new Error(`Gagal membatalkan opname ${noTransaction}: status transaksi telah berubah atau sedang diproses oleh permintaan lain.`);
    }

    const details = await tx.t_opnamedetail.findMany({
      where: { notransaction: noTransaction },
    });

    // Legacy readers treat every t_opname row as applied, so a reversed document must leave it
    await tx.t_opname.deleteMany({
      where: { notransaction: noTransaction },
    });

    // Create compensating movement (negating differenceqty)
    const revInvoiceCode = `${noTransaction}-REV`;
    const revDate = new Date();

    for (const d of details) {
      const diff = Number(d.differenceqty || 0);
      if (diff !== 0) {
        const isQtyIn = diff < 0;
        const qtyDelta = Math.abs(diff);

        const flow = await tx.s_flowinventory.create({
          data: {
            stockdate: revDate,
            invoicecode: revInvoiceCode,
            invoicetype: 3, // Opname Adj
            inventoryid: d.inventoryid,
            whcode: header.whid || 1,
            qty: -diff,
            price: d.unitprice || 0,
            createduser: actor,
            modifieduser: actor,
          },
        });

        await tx.s_flowdetailinventory.create({
          data: {
            flowinventoryid: Number(flow.id),
            invoicecode: revInvoiceCode,
            invoicetype: 3,
            invoicedate: revDate,
            qtyin: isQtyIn ? qtyDelta : 0,
            qtyout: isQtyIn ? 0 : qtyDelta,
            pricein: isQtyIn ? (d.unitprice || 0) : 0,
            priceout: isQtyIn ? 0 : (d.unitprice || 0),
            createduser: actor,
            modifieduser: actor,
          },
        });

        // Restore stock balance by decrementing the posted difference
        await tx.m_inventory.update({
          where: { id: BigInt(d.inventoryid) },
          data: {
            stokupdate: {
              decrement: diff,
            },
          },
        });
      }
    }

    const updatedHeader = await tx.t_opnameheader.findUnique({
      where: { notransaction: noTransaction },
    });

    await recordAuditEvent(
      {
        eventType: 'OPNAME_REVERSE',
        entityType: 'OPNAME',
        entityId: noTransaction,
        actor,
        reason,
        afterData: { noTransaction, status: 'REVERSED', reversedReason: reason },
        idempotencyKey,
      },
      tx
    );

    return { header: updatedHeader };
  }, { maxWait: 15000, timeout: 60000 });
}
