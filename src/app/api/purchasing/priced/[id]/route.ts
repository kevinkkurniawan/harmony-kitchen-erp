import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mr = await prisma.materialReceiveHeader.findUnique({
      where: { id: Number(id) },
      include: { details: true },
    });
    if (!mr) return NextResponse.json({ success: false }, { status: 404 });

    const mapped = {
      id: mr.id,
      mr_no: mr.mrNo,
      mr_date: mr.mrDate,
      po_no: mr.poNo || '-',
      do_no: mr.doNo || '-',
      supplier_name: mr.supplierName,
      driver_name: mr.driverName || '-',
      vehicle_no: mr.vehicleNo || '-',
      wh_name: mr.whName || 'Gudang Utama',
      description: mr.description || '-',
      subtotal: Number(mr.subtotal || 0),
      tax: Number(mr.tax || 0),
      grand_total: Number(mr.grandTotal || 0),
      items: mr.details.map((d: any) => ({
        id: d.id,
        barcode: d.barcode || '',
        inventory_no: d.inventoryNo || '',
        inventory_name: d.inventoryName || '',
        qty: Number(d.qty),
        unit_price: Number(d.unitPrice || 0),
        subtotal: Number(d.subtotal || 0),
        description: d.description || '',
      })),
    };

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

