import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const noTx = searchParams.get('noTx');

    if (noTx && noTx !== 'undefined') {
      const header = await prisma.opnameHeader.findUnique({
        where: { opnameNo: noTx },
        include: { details: true },
      });

      if (!header) return NextResponse.json({ success: false, error: 'Opname tidak ditemukan' }, { status: 404 });

      return NextResponse.json({
        success: true,
        data: {
          noTransaction: header.opnameNo,
          no_tx: header.opnameNo,
          date: header.opnameDate,
          opnameDate: header.opnameDate,
          wh_name: header.whName,
          warehouse: header.whName,
          items: header.details.map((d) => ({
            id: d.id,
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
            price: 50000,
            qty: d.physicalQty,
            description: 'Opname fisik gudang',
          })),
        },
      });
    }

    const opnames = await prisma.opnameHeader.findMany({
      include: { details: true },
      orderBy: { id: 'desc' },
    });

    const mapped = opnames.map((o) => {
      const totalQty = o.details.reduce((sum, d) => sum + d.physicalQty, 0);
      return {
        id: o.id,
        opname_no: o.opnameNo,
        opnameNo: o.opnameNo,
        noTransaction: o.opnameNo,
        opname_date: o.opnameDate,
        opnameDate: o.opnameDate.toISOString().split('T')[0],
        wh_name: o.whName,
        warehouse: o.whName,
        total_items: o.details.length,
        totalItems: o.details.length,
        totalQty: totalQty || 1,
        remarks: 'Stock Opname Bulanan',
        createdBy: 'Supervisor Gudang',
        created_at: o.createdAt,
      };
    });

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const no_tx = body.noTransaction || body.no_tx || body.opnameNo || `OPN-${Date.now().toString().slice(-6)}`;
    const date = body.opnameDate || body.date || body.opname_date;
    const wh_name = body.warehouse || body.wh_name || 'Gudang Utama';
    const items = body.items;

    if (!no_tx || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Opname dan detail barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.opnameHeader.create({
      data: {
        opnameNo: no_tx,
        opnameDate: date ? new Date(date) : new Date(),
        whName: wh_name,
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode,
            inventoryNo: it.inventoryNo || it.inventory_no || 'INV-001',
            inventoryName: it.inventoryName || it.inventory_name || 'Barang',
            systemQty: Number(it.systemQty || it.system_qty || 0),
            physicalQty: Number(it.physicalQty || it.physical_qty || it.qty || 0),
            diffQty: Number(it.diffQty || it.diff_qty || 0),
          })),
        },
      },
      include: {
        details: true,
      },
    });

    for (const it of items) {
      await prisma.inventory.updateMany({
        where: { barcode: it.barcode },
        data: {
          stock: Number(it.physicalQty || it.physical_qty || it.qty || 0),
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: 'Stock Opname berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
