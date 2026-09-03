import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mr = await prisma.materialReceiveHeader.findUnique({
      where: { id: Number(id) },
      include: { details: true },
    });

    if (!mr) return NextResponse.json({ success: false, error: 'Penerimaan barang tidak ditemukan' }, { status: 404 });

    const formattedDate = mr.mrDate ? new Date(mr.mrDate).toISOString().replace('T', ' ').slice(0, 19) : '-';

    const items = mr.details.map((d) => ({
      inventoryId: String(d.id),
      barcode: d.barcode,
      inventoryNo: d.inventoryNo,
      inventoryName: d.inventoryName,
      uomName: 'Pcs',
      qty: d.qty,
      description: '-',
    }));

    const printPayload = {
      header: {
        id: String(mr.id),
        mrNo: mr.mrNo,
        mrDate: formattedDate,
        supplierId: '1',
        supplierName: mr.supplierName,
        doNo: mr.poNo || '-',
        driverName: 'Sopir Ekspedisi',
        vehicleNo: '-',
        whName: 'Gudang Utama Dapur',
        description: 'Penerimaan barang fisik ekspress',
        isExpress: true,
        isVoid: false,
      },
      items,
    };

    return NextResponse.json({ success: true, data: printPayload });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.materialReceiveHeader.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true, message: 'Penerimaan barang berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
