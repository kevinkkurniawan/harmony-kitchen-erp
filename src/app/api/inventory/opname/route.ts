import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const noTx = searchParams.get('noTx');
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    if (noTx) {
      const header = await prisma.opnameHeader.findUnique({
        where: { opnameNo: noTx },
        include: { details: true },
      });

      if (!header) return NextResponse.json({ success: false, error: 'Opname tidak ditemukan' }, { status: 404 });

      const items = header.details.map((d) => ({
        id: String(d.id),
        inventoryId: d.id,
        barcode: d.barcode,
        inventoryNo: d.inventoryNo,
        inventory_no: d.inventoryNo,
        inventoryName: d.inventoryName,
        inventory_name: d.inventoryName,
        systemQty: d.systemQty,
        system_qty: d.systemQty,
        physicalQty: d.physicalQty,
        physical_qty: d.physicalQty,
        diffQty: d.diffQty,
        diff_qty: d.diffQty,
        qty: d.physicalQty,
        price: 0,
        description: '',
      }));

      return NextResponse.json({
        success: true,
        data: items,
        header: {
          noTransaction: header.opnameNo,
          no_tx: header.opnameNo,
          opnameNo: header.opnameNo,
          date: header.opnameDate,
          whName: header.whName,
          items,
        },
      });
    }

    const where = q
      ? {
          OR: [
            { opnameNo: { contains: q, mode: 'insensitive' as const } },
            { whName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, opnames] = await Promise.all([
      prisma.opnameHeader.count({ where }),
      prisma.opnameHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = opnames.map((o) => ({
      id: String(o.id),
      noTransaction: o.opnameNo,
      opname_no: o.opnameNo,
      opnameNo: o.opnameNo,
      opnameDate: o.opnameDate,
      opname_date: o.opnameDate,
      whName: o.whName,
      wh_name: o.whName,
      totalItems: o.details.length,
      total_items: o.details.length,
      created_at: o.createdAt,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const no_tx = body.no_tx || body.noTransaction || body.opnameNo;
    const date = body.date || body.opnameDate;
    const wh_name = body.wh_name || body.whName || body.warehouse;
    const items = body.items;

    if (!no_tx || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Opname dan detail barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.opnameHeader.create({
      data: {
        opnameNo: no_tx,
        opnameDate: date ? new Date(date) : new Date(),
        whName: wh_name || 'Gudang Utama',
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode,
            inventoryNo: it.inventory_no || it.inventoryNo,
            inventoryName: it.inventory_name || it.inventoryName,
            systemQty: Number(it.system_qty || it.systemQty || 0),
            physicalQty: Number(it.physical_qty || it.physicalQty || 0),
            diffQty: Number(it.diff_qty || it.diffQty || 0),
          })),
        },
      },
      include: {
        details: true,
      },
    });

    // Adjust inventory physical stock
    for (const it of items) {
      await prisma.inventory.updateMany({
        where: { barcode: it.barcode },
        data: {
          stock: Number(it.physical_qty || it.physicalQty || 0),
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Stock Opname berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
