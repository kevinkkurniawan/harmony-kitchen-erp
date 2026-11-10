import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { canUserViewHpp } from '@/lib/capabilities';
import { recordAuditEvent } from '@/lib/audit-event';
import { receiptHeaderAmounts, dueDateFromTerm } from '@/lib/receipt-totals';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    }

    const canViewPrice = canUserViewHpp(user);

    const { id } = await params;
    const mr = await prisma.t_materialreceiveheader.findUnique({
      where: { id: BigInt(id) },
      include: { t_materialreceivedetail: true },
    });

    if (!mr) return apiError('NOT_FOUND', 'Penerimaan barang tidak ditemukan.', 404);

    const inventoryIds = mr.t_materialreceivedetail
      .map((d: any) => Number(d.inventoryid))
      .filter((n) => !isNaN(n) && n > 0);
    const inventories = inventoryIds.length > 0
      ? await prisma.m_inventory.findMany({
          where: { id: { in: inventoryIds.map((invId) => BigInt(invId)) } },
          include: { m_uom: true },
        })
      : [];
    const inventoryMap = new Map(inventories.map((i: any) => [Number(i.id), i]));
    // A Cash Payment row means the receipt was settled from this screen
    const payment = await prisma.t_purchasepaymentdetail.findFirst({ where: { mrid: Number(mr.id) }, select: { id: true } });

    const mapped = {
      id: Number(mr.id),
      mr_no: mr.mrno || '-',
      mr_date: mr.mrdate ? new Date(mr.mrdate).toISOString().slice(0, 10) : '-',
      po_no: mr.pono || '-',
      do_no: mr.dono || '-',
      supplier_name: mr.suppliername || '-',
      supplier_id: mr.supplierid,
      wh_id: mr.whid,
      driver_name: mr.drivername || '-',
      vehicle_no: mr.vehicleno || '-',
      wh_name: 'Gudang Utama Dapur',
      payment_type: mr.paymenttype === 1 ? 'CASH' : 'TEMPO',
      long_term: Number(mr.longterm || 0),
      due_date: mr.duedate ? new Date(mr.duedate).toISOString().slice(0, 10) : '-',
      // Uang Muka is purchase money: Admin only, like the totals
      down_payment: canViewPrice ? Number(mr.downpayment || 0) : null,
      is_paid: Boolean(mr.ispaid),
      has_payment: Boolean(payment),
      is_multi_disc: Boolean(mr.ismultidisc),
      disc2: Number(mr.disc2 || 0),
      disc3: Number(mr.disc3 || 0),
      disc_percentage: Number(mr.discpercentage || 0),
      disc_value: canViewPrice ? Number(mr.discvalue || 0) : null,
      ppn_percentage: Number(mr.ppnpercentage || 0),
      description: mr.description || '-',
      ...(canViewPrice
        ? {
            subtotal: Number(mr.grandtotal || 0) - Number(mr.ppnvalue || 0),
            tax: Number(mr.ppnvalue || 0),
            grand_total: Number(mr.grandtotal || 0),
          }
        : {
            subtotal: null,
            tax: null,
            grand_total: null,
          }),
      items: mr.t_materialreceivedetail.map((d: any) => {
        const inv = inventoryMap.get(Number(d.inventoryid));
        return {
          id: Number(d.id),
          inventory_id: d.inventoryid,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          uom_name: inv?.m_uom?.uomname || inv?.m_uom?.uomcode || 'PCS',
          qty: Number(d.qty || 0),
          unit_price: canViewPrice ? Number(d.price || 0) : null,
          price: canViewPrice ? Number(d.price || 0) : null,
          disc_percentage: Number(d.discpersen1 || 0),
          disc2: Number(d.discpersen2 || 0),
          disc3: Number(d.discpersen3 || 0),
          // Rupiah discount on the purchase price: Admin-only like the price
          disc_rp: canViewPrice ? Number(d.disc || 0) : null,
          subtotal: canViewPrice ? Number(d.subtotal || 0) : null,
          description: d.description || '',
        };
      }),
    };

    return apiSuccess(mapped);
  } catch (error: any) {
    console.error('Error fetching priced receiving detail:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal memuat detail penerimaan', 500);
  }
}

// Clamp a percentage input to 0..100 (bad input counts as 0)
const pct = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));

/**
 * "Apply  Changes": save the header of a saved receipt (old SB_Apply_Click updates only the header row).
 * Lines are not edited here, so stock and HPP do not change; the totals are recomputed from the stored line subtotals.
 * A receipt settled by Cash Payment is locked, so its payment row keeps matching the receipt's balance.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);

    const { id } = await params;
    if (!/^\d+$/.test(id)) return apiError('BAD_REQUEST', 'ID penerimaan tidak valid.', 400);
    const body = await req.json();

    const mr = await prisma.t_materialreceiveheader.findUnique({
      where: { id: BigInt(id) },
      include: { t_materialreceivedetail: { select: { subtotal: true } } },
    });
    if (!mr) return apiError('NOT_FOUND', 'Penerimaan barang tidak ditemukan.', 404);
    if (mr.isvoid) return apiError('CONFLICT', 'Nota sudah dibatalkan, tidak bisa diubah.', 409);
    const payment = await prisma.t_purchasepaymentdetail.findFirst({ where: { mrid: Number(mr.id) }, select: { id: true } });
    if (payment) return apiError('CONFLICT', 'Nota sudah dibayar (Cash Payment), tidak bisa diubah.', 409);

    const mrDay = /^\d{4}-\d{2}-\d{2}$/.test(String(body.mrDate || '')) ? String(body.mrDate) : null;
    if (!mrDay) return apiError('BAD_REQUEST', 'Tanggal wajib diisi.', 400);
    const supplierIdNum = Number(body.supplierId);
    const supplier = supplierIdNum ? await prisma.m_supplier.findUnique({ where: { id: BigInt(supplierIdNum) } }) : null;
    if (!supplier) return apiError('BAD_REQUEST', 'Supplier tidak ditemukan.', 400);

    const paymentType = body.paymentType === 'CASH' ? 1 : 2;
    const longTerm = paymentType === 2 ? Math.max(0, Math.trunc(Number(body.longTerm) || 0)) : 0;
    const discPercentage = pct(body.discPercentage);
    const isMultiDisc = Boolean(body.isMultiDisc);
    const disc2 = isMultiDisc ? pct(body.disc2) : 0;
    const disc3 = isMultiDisc ? pct(body.disc3) : 0;
    const ppnPercentage = Math.max(0, Number(body.ppnPercentage) || 0);
    // A non-admin never sees Uang Muka, so their Apply Changes keeps the stored value
    const downPayment = canUserViewHpp(user) ? Math.max(0, Number(body.downPayment) || 0) : Number(mr.downpayment || 0);

    const subtotal = mr.t_materialreceivedetail.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);
    const { discValue, ppnValue, grandTotal } = receiptHeaderAmounts({
      subtotal, disc1: discPercentage, isMultiDisc, disc2, disc3, ppnPercentage, downPayment,
    });

    const before = {
      mrdate: mr.mrdate, whid: mr.whid, supplierid: mr.supplierid, paymenttype: mr.paymenttype, longterm: mr.longterm,
      duedate: mr.duedate, discpercentage: Number(mr.discpercentage || 0), ismultidisc: mr.ismultidisc,
      disc2: Number(mr.disc2 || 0), disc3: Number(mr.disc3 || 0), ppnpercentage: Number(mr.ppnpercentage || 0),
      downpayment: Number(mr.downpayment || 0), grandtotal: Number(mr.grandtotal || 0), ispaid: mr.ispaid, description: mr.description,
    };
    const data = {
      mrdate: new Date(`${mrDay}T00:00:00Z`),
      whid: Number(body.whId) || null,
      supplierid: Number(supplier.id),
      suppliername: supplier.suppliername,
      paymenttype: paymentType,
      longterm: longTerm,
      duedate: paymentType === 2 ? new Date(`${dueDateFromTerm(mrDay, longTerm)}T00:00:00Z`) : null,
      discpercentage: discPercentage,
      disc1: discPercentage,
      disc2,
      disc3,
      ismultidisc: isMultiDisc,
      discvalue: discValue,
      ppnpercentage: ppnPercentage,
      ppnvalue: ppnValue,
      downpayment: downPayment,
      grandtotal: grandTotal,
      // Same rule as a new receipt: cash is paid on entry; switching back to credit makes it unpaid again
      ispaid: paymentType === 1,
      description: typeof body.description === 'string' && body.description.trim() ? body.description : null,
      modifieduser: user.username,
      modifieddate: new Date(),
    };

    // Lock the row and re-check under it: a Cash Payment committed meanwhile must not be overwritten
    const conflict = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ isvoid: boolean | null }[]>`SELECT isvoid FROM t_materialreceiveheader WHERE id = ${mr.id} FOR UPDATE`;
      if (locked[0]?.isvoid) return apiError('CONFLICT', 'Nota sudah dibatalkan, tidak bisa diubah.', 409);
      const paid = await tx.t_purchasepaymentdetail.findFirst({ where: { mrid: Number(mr.id) }, select: { id: true } });
      if (paid) return apiError('CONFLICT', 'Nota sudah dibayar (Cash Payment), tidak bisa diubah.', 409);
      await tx.t_materialreceiveheader.update({ where: { id: mr.id }, data });
      await recordAuditEvent({
        eventType: 'PURCHASE_RECEIPT_HEADER_UPDATED',
        entityType: 't_materialreceiveheader',
        entityId: String(mr.id),
        actor: user.username,
        beforeData: JSON.parse(JSON.stringify(before)),
        afterData: JSON.parse(JSON.stringify({ ...data, modifieddate: undefined })),
      }, tx);
      return null;
    });
    if (conflict) return conflict;

    return apiSuccess({ id: Number(mr.id) }, `Perubahan nota ${mr.mrno} berhasil disimpan`);
  } catch (error: unknown) {
    console.error('PUT /api/purchasing/priced/[id] error:', error);
    return apiError('INTERNAL_ERROR', (error instanceof Error ? error.message : '') || 'Gagal menyimpan perubahan', 500);
  }
}
