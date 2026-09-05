import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mr = await prisma.t_materialreceiveheader.findUnique({
      where: { id: Number(id) },
      include: { t_materialreceivedetail: true },
    });
    if (!mr) return NextResponse.json({ success: false }, { status: 404 });

    const inventoryIds = mr.t_materialreceivedetail.map((d: any) => Number(d.inventoryid)).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { id: { in: inventoryIds } } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));
    const totalQty = mr.t_materialreceivedetail.reduce((sum: number, d: any) => sum + Number(d.qty), 0);

    const mapped = {
      id: mr.id,
      mr_no: mr.mrno,
      mr_date: mr.mrdate,
      po_no: '-',
      do_no: mr.dono || '-',
      supplier_name: mr.suppliername,
      driver_name: mr.drivername || '-',
      vehicle_no: mr.vehicleno || '-',
      wh_name: 'Gudang Utama',
      description: mr.description || '-',
      total_qty: totalQty,
      items: mr.t_materialreceivedetail.map((d: any) => {
        const inv = inventoryMap.get(Number(d.inventoryid));
        return {
          id: d.id,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          qty: Number(d.qty),
          description: d.description || '',
        };
      }),
    };

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
