import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = {
      isPriced: false,
      ...(q
        ? {
            OR: [
              { mrNo: { contains: q, mode: 'insensitive' as const } },
              { supplierName: { contains: q, mode: 'insensitive' as const } },
              { poNo: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, receives] = await Promise.all([
      prisma.materialReceiveHeader.count({ where }),
      prisma.materialReceiveHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

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
      })),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/express:', error);
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
        isPriced: false,
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode,
            inventoryNo: it.inventory_no || it.inventoryNo,
            inventoryName: it.inventory_name || it.inventoryName,
            qty: Number(it.qty),
            unitPrice: 0,
            subtotal: 0,
          })),
        },
      },
      include: { details: true },
    });

    // Increment stock for received items
    for (const it of items) {
      await prisma.inventory.updateMany({
        where: { barcode: it.barcode },
        data: { stock: { increment: Number(it.qty) } },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Penerimaan Barang Ekspress berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/express:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
