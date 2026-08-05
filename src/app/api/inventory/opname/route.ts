import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const noTx = searchParams.get('noTx');

    if (noTx) {
      const header = await prisma.opnameHeader.findUnique({
        where: { opnameNo: noTx },
        include: { details: true },
      });

      if (!header) return NextResponse.json({ success: false, error: 'Opname tidak ditemukan' }, { status: 404 });

      return NextResponse.json({
        success: true,
        data: {
          no_tx: header.opnameNo,
          date: header.opnameDate,
          wh_name: header.whName,
          items: header.details.map((d) => ({
            barcode: d.barcode,
            inventory_no: d.inventoryNo,
            inventory_name: d.inventoryName,
            system_qty: d.systemQty,
            physical_qty: d.physicalQty,
            diff_qty: d.diffQty,
          })),
        },
      });
    }

    const opnames = await prisma.opnameHeader.findMany({
      include: { details: true },
      orderBy: { id: 'desc' },
    });

    const mapped = opnames.map((o) => ({
      id: o.id,
      opname_no: o.opnameNo,
      opname_date: o.opnameDate,
      wh_name: o.whName,
      total_items: o.details.length,
      created_at: o.createdAt,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { no_tx, date, wh_name, items } = body;

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
