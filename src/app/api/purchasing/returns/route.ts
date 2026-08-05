import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const returns = await prisma.purchaseReturnHeader.findMany({
      where: q
        ? {
            OR: [
              { returnNo: { contains: q, mode: 'insensitive' } },
              { supplierName: { contains: q, mode: 'insensitive' } },
              { mrNo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { details: true },
      orderBy: { id: 'desc' },
    });

    const mapped = returns.map((r) => ({
      id: r.id,
      return_no: r.returnNo,
      return_date: r.returnDate,
      mr_no: r.mrNo,
      supplier_name: r.supplierName,
      return_reason: r.returnReason || '',
      created_at: r.createdAt,
      items: r.details.map((d) => ({
        id: d.id,
        barcode: d.barcode,
        inventory_no: d.inventoryNo,
        inventory_name: d.inventoryName,
        qty: d.qty,
      })),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { return_no, return_date, mr_no, supplier_name, return_reason, items } = body;

    if (!return_no || !mr_no || !supplier_name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Retur, MR No, Supplier, dan detail item barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.purchaseReturnHeader.create({
      data: {
        returnNo: return_no,
        returnDate: return_date ? new Date(return_date) : new Date(),
        mrNo: mr_no,
        supplierName: supplier_name,
        returnReason: return_reason || null,
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode,
            inventoryNo: it.inventory_no || it.inventoryNo,
            inventoryName: it.inventory_name || it.inventoryName,
            qty: Number(it.qty),
          })),
        },
      },
      include: { details: true },
    });

    for (const it of items) {
      await prisma.inventory.updateMany({
        where: { barcode: it.barcode },
        data: { stock: { decrement: Number(it.qty) } },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Retur Pembelian berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
