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
      mr_no: mr.mrNo,
      mr_date: mr.mrDate,
      po_no: mr.poNo || '-',
      supplier_name: mr.supplierName,
      created_at: mr.createdAt,
      items: mr.details.map((d) => ({
        id: d.id,
        barcode: d.barcode,
        inventory_no: d.inventoryNo,
        inventory_name: d.inventoryName,
        qty: d.qty,
        unit_price: d.unitPrice,
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
    const { mr_no, mr_date, po_no, supplier_name, items } = body;

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
            inventoryNo: it.inventory_no || it.inventoryNo,
            inventoryName: it.inventory_name || it.inventoryName,
            qty: Number(it.qty),
            unitPrice: Number(it.unit_price || it.unitPrice || 0),
            subtotal: Number(it.subtotal || 0),
          })),
        },
      },
      include: { details: true },
    });

    // Update HPP and increment stock
    for (const it of items) {
      await prisma.inventory.updateMany({
        where: { barcode: it.barcode },
        data: {
          hpp: Number(it.unit_price || it.unitPrice || 0),
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
