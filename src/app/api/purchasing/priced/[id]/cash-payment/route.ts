import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { canUserViewHpp } from '@/lib/capabilities';
import { recordAuditEvent } from '@/lib/audit-event';

// t_purchasepaymentdetail.mrtype of a goods receipt (fn_InvoiceHeader_GetInvoiceID type 23 = material receive)
const MR_INVOICE_TYPE = 23;

/**
 * "Cash Payment" (old PopUp_CashPayment -> sp_SPPurchasePayment_Express): pays the receipt's
 * "Saldo Terhutang" in one cash payment, then marks the receipt paid ("Terbayar").
 * The old SP took the amount from the screen; here it is read from the saved receipt.
 * "Sumber Dana" is not stored: no column holds it (the old SP did not receive it either).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    const { id } = await params;
    if (!/^\d+$/.test(id)) return apiError('BAD_REQUEST', 'ID penerimaan tidak valid.', 400);

    const result = await prisma.$transaction(async (tx) => {
      // Row lock: two clicks / two users cannot both pay the same receipt
      const locked = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM t_materialreceiveheader WHERE id = ${BigInt(id)} FOR UPDATE`;
      if (locked.length === 0) return { error: apiError('NOT_FOUND', 'Penerimaan barang tidak ditemukan.', 404) };
      const mr = await tx.t_materialreceiveheader.findUniqueOrThrow({ where: { id: BigInt(id) } });
      if (mr.isvoid) return { error: apiError('CONFLICT', 'Nota sudah dibatalkan.', 409) };
      const existing = await tx.t_purchasepaymentdetail.findFirst({ where: { mrid: Number(mr.id) }, select: { id: true } });
      if (mr.ispaid || existing) return { error: apiError('CONFLICT', 'Nota sudah lunas.', 409) };
      if (!mr.supplierid) return { error: apiError('BAD_REQUEST', 'Supplier nota kosong.', 400) };

      // "Saldo Terhutang" = Total Keseluruhan - Uang Muka (old CalculateSummary)
      const amount = Number(mr.grandtotal || 0) - Number(mr.downpayment || 0);
      if (!(amount > 0)) return { error: apiError('BAD_REQUEST', 'Saldo Terhutang nota ini 0, tidak ada yang dibayar.', 400) };

      // PP-YYMMDD-NNN on the receipt date, as fn_InvoiceHeader_GetInvoiceNo(25, PMRDate)
      const day = (mr.mrdate ?? new Date()).toISOString().slice(0, 10);
      const prefix = `PP-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-`;
      // Serialize numbering per day: the PK is (ppno, supplierid), so it would not stop a duplicate PP no.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
      const last = await tx.t_purchasepaymentheader.findMany({ where: { ppno: { startsWith: prefix } }, select: { ppno: true } });
      const next = last.reduce((max, r) => Math.max(max, parseInt(r.ppno.slice(prefix.length), 10) || 0), 0) + 1;
      const ppNo = `${prefix}${String(next).padStart(3, '0')}`;
      const now = new Date();

      const header = await tx.t_purchasepaymentheader.create({
        data: {
          ppno: ppNo,
          ppdate: mr.mrdate ?? new Date(`${day}T00:00:00Z`),
          supplierid: mr.supplierid,
          paymenttype: 1,
          description: '',
          grandtotal: amount,
          createduser: user.username,
          createddate: now,
          modifieduser: user.username,
          modifieddate: now,
        },
      });
      await tx.t_purchasepaymentdetail.create({
        data: {
          ppid: Number(header.id),
          mrid: Number(mr.id),
          mrno: mr.mrno,
          mrtype: MR_INVOICE_TYPE,
          mrdate: mr.mrdate,
          balance: amount,
          discount: 0,
          payment: amount,
          createduser: user.username,
          createddate: now,
          modifieduser: user.username,
          modifieddate: now,
        },
      });
      await tx.t_materialreceiveheader.update({
        where: { id: mr.id },
        data: { ispaid: true, modifieduser: user.username, modifieddate: now },
      });
      await recordAuditEvent({
        eventType: 'PURCHASE_RECEIPT_CASH_PAYMENT',
        entityType: 't_materialreceiveheader',
        entityId: String(mr.id),
        actor: user.username,
        afterData: { ppno: ppNo, ppid: Number(header.id), mrno: mr.mrno, payment: amount },
      }, tx);
      return { ppNo, amount };
    });

    if ('error' in result) return result.error;
    // Purchase amounts stay Admin-only
    return apiSuccess(
      { ppNo: result.ppNo, amount: canUserViewHpp(user) ? result.amount : null },
      'Transaksi telah berhasil dilunasi',
    );
  } catch (error: unknown) {
    console.error('POST /api/purchasing/priced/[id]/cash-payment error:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error ? error.message : '') || 'Gagal memproses pembayaran', 500);
  }
}
