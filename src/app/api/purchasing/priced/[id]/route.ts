import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mr = await prisma.materialReceiveHeader.findUnique({
      where: { id: Number(id) },
      include: { details: true },
    });

    if (!mr) return NextResponse.json({ success: false, error: 'Penerimaan barang dengan harga tidak ditemukan' }, { status: 404 });

    const formattedDate = mr.mrDate ? new Date(mr.mrDate).toISOString().replace('T', ' ').slice(0, 19) : '-';
    const grandTotal = mr.details.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);

    const items = mr.details.map((d) => ({
      inventoryId: String(d.id),
      barcode: d.barcode,
      inventoryNo: d.inventoryNo,
      inventoryName: d.inventoryName,
      uomName: 'Pcs',
      qty: d.qty,
      price: Number(d.unitPrice || 0),
      discPercentage: 0,
      subtotal: Number(d.subtotal || 0),
      description: '-',
    }));

    const printPayload = {
      header: {
        id: String(mr.id),
        mrNo: mr.mrNo,
        mrDate: formattedDate,
        supplierId: String(mr.supplierId || 1),
        supplierName: mr.supplierName,
        poNo: mr.poNo || '-',
        doNo: mr.doNo || '-',
        driverName: mr.driverName || '-',
        vehicleNo: mr.vehicleNo || '-',
        whName: mr.whName || '-',
        paymentType: mr.paymentType || '-',
        dueDate: mr.dueDate ? new Date(mr.dueDate).toISOString().replace('T', ' ').slice(0, 19) : '-',
        downPayment: mr.downPayment || 0,
        discPercentage: mr.discPercentage || 0,
        discValue: (mr.subtotal || grandTotal) * (mr.discPercentage || 0) / 100,
        ppnPercentage: mr.ppnPercentage || 0,
        ppnValue: mr.tax || 0,
        subtotal: mr.subtotal || grandTotal,
        grandTotal: mr.grandTotal && mr.grandTotal > 0 ? mr.grandTotal : grandTotal,
        description: mr.description || '-',
        isExpress: mr.isExpress,
        isVoid: mr.isVoid,
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

    return NextResponse.json({ success: true, message: 'Penerimaan barang dengan harga berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
