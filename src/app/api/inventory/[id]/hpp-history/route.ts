import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { canViewHpp } from '@/lib/erp-permissions';

interface HppRow {
  id: number;
  mr_no: string | null;
  mr_date: Date | null;
  supplier_name: string | null;
  hpp: number | null;
}

// "Detail Barang" purchase history (old sp_MDInventory_GetHPPHistory): per goods receipt line,
// Harga Beli = Subtotal / Qty plus the line's income-tax %. Purchase prices are Admin-only.
// Differences from the old SP: voided receipts are left out (the ERP can void them) and a receipt
// without a supplier row still shows, with the supplier name stored on the receipt.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canViewHpp())) return NextResponse.json({ success: false, error: 'Anda tidak memiliki hak akses untuk melihat HPP.' }, { status: 403 });
  try {
    const inventoryId = parseInt((await params).id, 10);
    if (isNaN(inventoryId)) return NextResponse.json({ success: false, error: 'Invalid inventory ID' }, { status: 400 });

    const rows = await prisma.$queryRaw<HppRow[]>`
      SELECT th.id::int AS id, th.mrno AS mr_no, th.mrdate AS mr_date,
             COALESCE(ms.suppliername, th.suppliername) AS supplier_name,
             (td.subtotal / NULLIF(td.qty, 0) * (1 + COALESCE(td.incometaxpercentage, 0) / 100))::float8 AS hpp
      FROM t_materialreceivedetail td
      JOIN t_materialreceiveheader th ON th.id = td.mrid
      LEFT JOIN m_supplier ms ON ms.id = th.supplierid
      WHERE td.inventoryid = ${String(inventoryId)} -- text column in this legacy table
        AND COALESCE(th.isvoid, false) = false
      ORDER BY th.mrdate DESC NULLS LAST, th.id DESC
    `;
    const data = rows.map((r) => ({
      id: r.id,
      mrNo: r.mr_no || '',
      mrDate: r.mr_date,
      supplierName: r.supplier_name || '',
      // Null when the receipt has no subtotal (Penerimaan Barang Ekspress has no prices), like the old SP
      hpp: r.hpp === null ? null : Math.round(r.hpp),
    }));
    return NextResponse.json({ success: true, data, items: data });
  } catch (error: unknown) {
    console.error('Error in GET /api/inventory/[id]/hpp-history:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error && error.message) || 'Gagal memuat histori harga beli' }, { status: 500 });
  }
}
export async function POST() {
  return NextResponse.json({ success: true, data: [] });
}
export async function PUT() {
  return NextResponse.json({ success: true, data: [] });
}
export async function DELETE() {
  return NextResponse.json({ success: true });
}
