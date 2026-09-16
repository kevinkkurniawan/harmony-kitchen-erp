import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {};
    if (q) {
      where.OR = [
        { usageNo: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, headers] = await Promise.all([
      prisma.inventoryUsageHeader.count({ where }),
      prisma.inventoryUsageHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = headers.map((h) => ({
      id: h.id,
      usage_no: h.usageNo,
      usage_date: h.usageDate,
      wh_name: h.whName || 'Gudang Utama',
      description: h.description || '',
      items: h.details.map((d) => ({
        id: d.id,
        barcode: d.barcode || '',
        inventory_no: d.inventoryNo || '',
        inventory_name: d.inventoryName || '',
        qty: Number(d.qty),
        uom_name: d.uomName || 'PCS',
        notes: d.notes || '',
      })),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/inventory/usage:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { usage_no, usage_date, wh_name, description, items } = body;

    if (!usage_no || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Pemakaian dan detail barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.inventoryUsageHeader.create({
      data: {
        usageNo: usage_no,
        usageDate: usage_date ? new Date(usage_date) : new Date(),
        whName: wh_name || 'Gudang Utama',
        description: description || null,
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode || '',
            inventoryNo: it.inventoryNo || it.inventory_no || '',
            inventoryName: it.inventoryName || it.inventory_name || '',
            uomName: it.uomName || it.uom_name || 'PCS',
            qty: Number(it.qty) || 0,
            notes: it.notes || null,
          })),
        },
      },
      include: { details: true },
    });

    // Decrement stock for inventory items
    for (const it of items) {
      const invNo = it.inventoryNo || it.inventory_no;
      if (invNo) {
        await prisma.inventory.updateMany({
          where: { inventoryNo: invNo },
          data: { stock: { decrement: Number(it.qty) || 0 } },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, message: 'Pemakaian barang berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/usage:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
