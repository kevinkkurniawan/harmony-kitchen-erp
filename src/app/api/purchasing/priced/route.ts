import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const receives = await prisma.materialReceiveHeader.findMany({
      where: {
        isPriced: true,
        ...(q
          ? {
              OR: [
                { mrNo: { contains: q, mode: 'insensitive' } },
                { supplierName: { contains: q, mode: 'insensitive' } },
                { poNo: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { details: true },
      orderBy: { id: 'desc' },
    });

    const mapped = receives.map((mr) => ({
      id: mr.id,
      mrNo: mr.mrNo,
      mr_no: mr.mrNo,
      mrDate: mr.mrDate.toISOString().split('T')[0],
      mr_date: mr.mrDate.toISOString(),
      supplierId: '1',
      supplierName: mr.supplierName,
      supplier_name: mr.supplierName,
      poNo: mr.poNo || 'PO-202608-001',
      po_no: mr.poNo || 'PO-202608-001',
      doNo: `DO-${mr.mrNo}`,
      driverName: 'Pak Joko (Kurir Supplier)',
      created_at: mr.createdAt,
      items: mr.details.map((d) => ({
        id: d.id,
        inventoryId: String(d.id),
        barcode: d.barcode,
        inventoryNo: d.inventoryNo,
        inventory_no: d.inventoryNo,
        inventoryName: d.inventoryName,
        inventory_name: d.inventoryName,
        uomName: 'Pcs',
        qty: d.qty,
        price: d.unitPrice,
        unit_price: d.unitPrice,
        discPercentage: 0,
        subtotal: d.subtotal,
      })),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/priced:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mr_no = body.mrNo || body.mr_no || `MR-PRC-${Date.now().toString().slice(-6)}`;
    const mr_date = body.mrDate || body.mr_date;
    const po_no = body.poNo || body.po_no;
    const supplier_name = body.supplierName || body.supplier_name;
    const items = body.items;

    if (!mr_no || !supplier_name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. MR, Supplier, dan detail item barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.materialReceiveHeader.create({
      data: {
        mrNo: mr_no,
        mrDate: mr_date ? new Date(mr_date) : new Date(),
        poNo: po_no || null,
        supplierName: supplier_name,
        isPriced: true,
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode,
            inventoryNo: it.inventoryNo || it.inventory_no || 'INV-001',
            inventoryName: it.inventoryName || it.inventory_name || 'Barang',
            qty: Number(it.qty),
            unitPrice: Number(it.price || it.unitPrice || it.unit_price || 0),
            subtotal: Number(it.subtotal || 0),
          })),
        },
      },
      include: { details: true },
    });

    for (const it of items) {
      await prisma.inventory.updateMany({
        where: { barcode: it.barcode },
        data: {
          hpp: Number(it.price || it.unitPrice || it.unit_price || 0),
          stock: { increment: Number(it.qty) },
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Penerimaan Barang dengan Harga berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/priced:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
