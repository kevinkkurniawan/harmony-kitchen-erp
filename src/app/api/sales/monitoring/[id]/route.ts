import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { requireCapability } from '@/lib/capabilities';
import { recordAuditEvent } from '@/lib/audit-event';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headerId = Number(id);

    const header = await prisma.t_salesposheader.findUnique({
      where: { id: headerId },
    });

    if (!header) {
      return apiError('NOT_FOUND', 'Transaksi penjualan tidak ditemukan.', 404);
    }

    const details = await prisma.t_salesposdetail.findMany({
      where: { salesposheaderid: headerId },
      orderBy: { id: 'asc' },
    });

    const inventoryIds = details.map((d: any) => BigInt(d.inventoryid)).filter(Boolean);
    const inventories = await prisma.m_inventory.findMany({
      where: { id: { in: inventoryIds } },
      include: { m_uom: true, m_brand: true },
    });
    const invMap = new Map(inventories.map((i: any) => [Number(i.id), i]));

    const items = details.map((d: any) => {
      const inv = invMap.get(d.inventoryid);
      return {
        id: String(d.id),
        inventoryId: d.inventoryid,
        inventoryNo: inv?.inventoryno || '',
        inventoryName: inv?.inventoryname || 'Barang',
        uomName: inv?.m_uom?.uomname || 'Pcs',
        brandName: inv?.m_brand?.brandname || 'General',
        qty: Number(d.qty || 0),
        price: Number(d.price || 0),
        hpp: Number(d.unithpp || d.hpp || 0),
        disc: Number(d.disc || 0),
        subtotal: Number(d.subtotal || 0),
        wholesalePriceSource: d.pricesource || null,
        wholesaleCategoryVersion: d.wholesaleversion || null,
      };
    });

    return apiSuccess({
      header: {
        id: String(header.id),
        invoiceNo: header.salesposno,
        salesposdate: header.salesposdate,
        customerName: header.customername || 'Pelanggan Umum',
        grandTotal: Number(header.grandtotal || 0),
        isVoid: Boolean(header.isvoid),
        isOverrideGrosir1: Boolean(header.isoverridegrosir),
        manualDiscountAmount: Number(header.manualdiscountamount || 0),
        manualDiscountMode: header.manualdiscountmode || 'NOMINAL',
        manualDiscountValue: Number(header.manualdiscountvalue || 0),
        manualDiscountReason: header.manualdiscountreason || null,
        paymentType: header.paymenttypecode || 'CASH',
      },
      items,
    });
  } catch (err: any) {
    console.error('Error fetching transaction detail:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Gagal memuat detail transaksi', 500);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headerId = Number(id);

    const body = await req.json();
    const { action, reason, paymentType } = body;

    const existingHeader = await prisma.t_salesposheader.findUnique({
      where: { id: headerId },
    });

    if (!existingHeader) {
      return apiError('NOT_FOUND', 'Transaksi tidak ditemukan.', 404);
    }

    // 1. PAYMENT TYPE CORRECTION
    if (action === 'CORRECT_PAYMENT') {
      const auth = await requireCapability('PAYMENT_TYPE_CORRECTION');
      if ('errorResponse' in auth) return auth.errorResponse;
      const actor = auth.user.username || 'system';

      if (!paymentType || !paymentType.trim()) {
        return apiError('VALIDATION_ERROR', 'Tipe pembayaran baru wajib dipilih.', 400);
      }
      if (!reason || !reason.trim()) {
        return apiError('VALIDATION_ERROR', 'Alasan koreksi tipe pembayaran wajib diisi.', 400);
      }

      const oldType = existingHeader.paymenttypecode || 'CASH';
      const newType = paymentType.trim().toUpperCase();

      await prisma.$transaction(async (tx) => {
        await tx.t_salesposheader.update({
          where: { id: headerId },
          data: {
            paymenttypecode: newType,
            modifieduser: actor,
            modifieddate: new Date(),
          },
        });

        await recordAuditEvent({
          actor,
          eventType: 'PAYMENT_TYPE_CORRECTION',
          entityType: 'SALES_POS',
          entityId: String(headerId),
          beforeData: { paymentType: oldType },
          afterData: { paymentType: newType },
          reason: reason.trim(),
        }, tx);
      });

      return apiSuccess({ message: `Tipe pembayaran berhasil diubah ke ${newType}` });
    }

    // 2. VOID TRANSACTION
    if (action === 'VOID') {
      const auth = await requireCapability('SALES_VOID');
      if ('errorResponse' in auth) return auth.errorResponse;
      const actor = auth.user.username || 'system';

      if (existingHeader.isvoid) {
        return apiError('CONFLICT', 'Transaksi ini sudah dalam status VOID.', 409);
      }
      if (!reason || !reason.trim()) {
        return apiError('VALIDATION_ERROR', 'Alasan pembatalan (void) transaksi wajib diisi.', 400);
      }

      const details = await prisma.t_salesposdetail.findMany({
        where: { salesposheaderid: headerId },
      });

      await prisma.$transaction(async (tx) => {
        // Mark header void
        await tx.t_salesposheader.update({
          where: { id: headerId },
          data: {
            isvoid: true,
            status: 'VOID',
            modifieduser: actor,
            modifieddate: new Date(),
          },
        });

        // Compensating stock movement for each item (return to stock)
        for (const item of details) {
          const invId = item.inventoryid;
          const qty = Number(item.qty || 0);

          if (invId && qty > 0) {
            await tx.s_flowinventory.create({
              data: {
                inventoryid: invId,
                stockdate: new Date(),
                invoiceid: headerId,
                invoicetype: 1,
                invoicecode: existingHeader.salesposno,
                qty: qty,
                whcode: 1,
                createduser: actor,
                createddate: new Date(),
                modifieduser: actor,
                modifieddate: new Date(),
              },
            });

            await tx.m_inventory.update({
              where: { id: BigInt(invId) },
              data: {
                stokupdate: { increment: qty },
              },
            });
          }
        }

        await recordAuditEvent({
          actor,
          eventType: 'SALES_VOID',
          entityType: 'SALES_POS',
          entityId: String(headerId),
          beforeData: { isVoid: false },
          afterData: { isVoid: true, itemsCount: details.length },
          reason: reason.trim(),
        }, tx);
      });

      return apiSuccess({ message: `Transaksi ${existingHeader.salesposno} berhasil di-VOID dan stok dikembalikan.` });
    }

    // 3. UNVOID TRANSACTION
    if (action === 'UNVOID') {
      const auth = await requireCapability('SALES_UNVOID');
      if ('errorResponse' in auth) return auth.errorResponse;
      const actor = auth.user.username || 'system';

      if (!existingHeader.isvoid) {
        return apiError('CONFLICT', 'Transaksi ini tidak dalam status VOID.', 409);
      }
      if (!reason || !reason.trim()) {
        return apiError('VALIDATION_ERROR', 'Alasan pengaktifan kembali (unvoid) transaksi wajib diisi.', 400);
      }

      const details = await prisma.t_salesposdetail.findMany({
        where: { salesposheaderid: headerId },
      });

      await prisma.$transaction(async (tx) => {
        // Mark header active
        await tx.t_salesposheader.update({
          where: { id: headerId },
          data: {
            isvoid: false,
            status: 'COMPLETED',
            modifieduser: actor,
            modifieddate: new Date(),
          },
        });

        // Deduct stock again
        for (const item of details) {
          const invId = item.inventoryid;
          const qty = Number(item.qty || 0);

          if (invId && qty > 0) {
            await tx.s_flowinventory.create({
              data: {
                inventoryid: invId,
                stockdate: new Date(),
                invoiceid: headerId,
                invoicetype: 1,
                invoicecode: existingHeader.salesposno,
                qty: -qty,
                whcode: 1,
                createduser: actor,
                createddate: new Date(),
                modifieduser: actor,
                modifieddate: new Date(),
              },
            });

            await tx.m_inventory.update({
              where: { id: BigInt(invId) },
              data: {
                stokupdate: { decrement: qty },
              },
            });
          }
        }

        await recordAuditEvent({
          actor,
          eventType: 'SALES_UNVOID',
          entityType: 'SALES_POS',
          entityId: String(headerId),
          beforeData: { isVoid: true },
          afterData: { isVoid: false },
          reason: reason.trim(),
        }, tx);
      });

      return apiSuccess({ message: `Transaksi ${existingHeader.salesposno} berhasil di-UNVOID.` });
    }

    return apiError('BAD_REQUEST', `Action "${action}" tidak dikenali.`, 400);
  } catch (err: any) {
    console.error('Error updating transaction monitoring:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Gagal memproses transaksi', 500);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headerId = Number(id);

    const body = await req.json();
    const { action, reason } = body;

    if (action === 'REPRINT') {
      const auth = await requireCapability('REPRINT_RECEIPT');
      if ('errorResponse' in auth) return auth.errorResponse;
      const actor = auth.user.username || 'system';

      const header = await prisma.t_salesposheader.findUnique({
        where: { id: headerId },
      });

      if (!header) {
        return apiError('NOT_FOUND', 'Transaksi tidak ditemukan.', 404);
      }

      await recordAuditEvent({
        actor,
        eventType: 'REPRINT_RECEIPT',
        entityType: 'SALES_POS',
        entityId: String(headerId),
        afterData: { invoiceNo: header.salesposno },
        reason: reason?.trim() || 'Cetak ulang nota',
      });

      return apiSuccess({
        invoiceNo: header.salesposno,
        message: 'Reprint marker tercatat dalam audit event.',
      });
    }

    return apiError('BAD_REQUEST', `Action "${action}" tidak dikenali.`, 400);
  } catch (err: any) {
    console.error('Error in POST monitoring action:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Gagal memproses reprint', 500);
  }
}
