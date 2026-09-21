import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
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
    // Check if header already exists
    let header = await tx.t_opnameheader.findUnique({
      where: { notransaction: noTransaction },
    });

    if (header && header.status === 'POSTED') {
      if (action === 'post' && idempotencyKey && header.idempotencykey === idempotencyKey) {
        // Idempotent return of already posted opname
        return { header, alreadyPosted: true };
      }
      throw new Error(`Transaksi opname ${noTransaction} sudah diposting dan tidak dapat diedit.`);
    }

    if (header && header.status === 'REVERSED') {
      throw new Error(`Transaksi opname ${noTransaction} telah dibatalkan (reversed).`);
    }

    // Resolve items and system quantities
    const invIds = items.map((it) => Number(it.inventoryId)).filter(Boolean);
    const inventories = await tx.m_inventory.findMany({
      where: { id: { in: invIds } },
    });
    const invMap = new Map(inventories.map((i) => [Number(i.id), i]));

    const processedItems = items.map((it) => {
      const inv = invMap.get(Number(it.inventoryId));
      const sysQty = it.systemQty !== undefined ? Number(it.systemQty) : Number(inv?.stokupdate || 0);
      const physQty = Number(it.physicalQty || 0);
      const diffQty = physQty - sysQty;
      const unitPrice = it.unitPrice !== undefined ? Number(it.unitPrice) : Number(inv?.hpp || inv?.price || 0);

      return {
        notransaction: noTransaction,
        inventoryid: Number(it.inventoryId),
        barcode: it.barcode || inv?.barcode || '',
        systemqty: sysQty,
        physicalqty: physQty,
        differenceqty: diffQty,
        unitprice: unitPrice,
        notes: it.notes || '',
      };
    });

    // Delete existing draft details
    await tx.t_opnamedetail.deleteMany({
      where: { notransaction: noTransaction },
    });
    await tx.t_opname.deleteMany({
      where: { notransaction: noTransaction },
    });

    // Create details
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

    // Write to legacy t_opname for backwards compatibility
    await tx.t_opname.createMany({
      data: processedItems.map((pi) => ({
        notransaction: pi.notransaction,
        inventoryid: pi.inventoryid,
        barcode: pi.barcode,
        qty: Number(pi.physicalqty),
        price: Number(pi.unitprice),
        description: pi.notes || '',
        opnamedate: opnameDate,
        createduser: actor,
        createddate: new Date(),
        modifieduser: actor,
        modifieddate: new Date(),
        isdone: action === 'post',
      })),
    });

    if (action === 'post') {
      // POST: apply stock movements and update stock balance
      for (const pi of processedItems) {
        if (pi.differenceqty !== 0) {
          const isQtyIn = pi.differenceqty > 0;
          const qtyDelta = Math.abs(pi.differenceqty);

          // Insert into s_flowinventory
          const flow = await tx.s_flowinventory.create({
            data: {
              stockdate: opnameDate,
              invoicecode: noTransaction,
              invoicetype: 3, // Opname Adj
              inventoryid: pi.inventoryid,
              whcode: params.whId || 1,
              qty: pi.differenceqty,
              price: pi.unitprice,
              createduser: actor,
              modifieduser: actor,
            },
          });

          // Insert into s_flowdetailinventory
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

          // Update authoritative stock in m_inventory
          await tx.m_inventory.update({
            where: { id: pi.inventoryid },
            data: {
              stokupdate: {
                increment: pi.differenceqty,
              },
            },
          });
        }
      }

      header = await tx.t_opnameheader.upsert({
        where: { notransaction: noTransaction },
        update: {
          opnamedate: opnameDate,
          whid: params.whId || 1,
          status: 'POSTED',
          notes: notes || '',
          posteduser: actor,
          posteddate: new Date(),
          idempotencykey: idempotencyKey,
        },
        create: {
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
      // DRAFT: no stock change
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

    const details = await tx.t_opnamedetail.findMany({
      where: { notransaction: noTransaction },
    });

    // Create compensating movement (negating differenceqty)
    const revInvoiceCode = `${noTransaction}-REV`;
    const revDate = new Date();

    for (const d of details) {
      const diff = Number(d.differenceqty || 0);
      if (diff !== 0) {
        // Reverse direction: if diff was > 0, we do qtyout = diff. If diff was < 0, we do qtyin = |diff|.
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

        // Restore stock balance by reversing the delta
        await tx.m_inventory.update({
          where: { id: d.inventoryid },
          data: {
            stokupdate: {
              decrement: diff,
            },
          },
        });
      }
    }

    const updatedHeader = await tx.t_opnameheader.update({
      where: { notransaction: noTransaction },
      data: {
        status: 'REVERSED',
        reverseduser: actor,
        reverseddate: revDate,
        reversedreason: reason,
      },
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
