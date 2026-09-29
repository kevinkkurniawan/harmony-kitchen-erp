import { prisma } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit-event';

export interface OpnameItemInput {
  inventoryId: number;
  barcode?: string;
  systemQty?: number;
  physicalQty: number;
  unitPrice?: number;
  notes?: string;
}

export interface SaveOpnameParams {
  noTransaction: string;
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
  const { noTransaction, notes, items, actor, action = 'draft', idempotencyKey } = params;
  const opnameDate = params.date ? new Date(params.date) : new Date();

  return prisma.$transaction(async (tx) => {
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

      // At posting time, baseline is current live stock; for draft, baseline is current or provided
      const currentLiveStock = Number(inv.stokupdate || 0);
      const baselineSysQty = action === 'post' ? currentLiveStock : (it.systemQty !== undefined ? Number(it.systemQty) : currentLiveStock);
      const physQty = Number(it.physicalQty || 0);
      const diffQty = physQty - baselineSysQty;
      const unitPrice = it.unitPrice !== undefined ? Number(it.unitPrice) : Number(inv.hpp || inv.price || 0);

      return {
        notransaction: noTransaction,
        inventoryid: Number(it.inventoryId),
        barcode: it.barcode || inv.barcode || '',
        systemqty: baselineSysQty,
        physicalqty: physQty,
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

    // Legacy t_opname table sync
    await tx.t_opname.createMany({
      data: processedItems.map((pi) => ({
        notransaction: pi.notransaction,
        inventoryid: pi.inventoryid,
        barcode: pi.barcode,
        qty: pi.physicalqty,
        price: pi.unitprice,
        description: pi.notes || '',
        opnamedate: opnameDate,
        createduser: actor,
        createddate: new Date(),
        modifieduser: actor,
        modifieddate: new Date(),
        isdone: action === 'post',
      })),
    });

    let header;

    if (action === 'post') {
      // 5. POSTING: Apply stock movements and update stock balance atomically
      for (const pi of processedItems) {
        if (pi.differenceqty !== 0) {
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

          // Set stock balance to EXACT physical quantity
          await tx.m_inventory.update({
            where: { id: BigInt(pi.inventoryid) },
            data: {
              stokupdate: pi.physicalqty,
            },
          });
        }
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
