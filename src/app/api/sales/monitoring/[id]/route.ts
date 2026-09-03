import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sale = await prisma.salesPOSHeader.findUnique({
      where: { id: Number(id) },
      include: { details: true },
    });

    if (!sale) return NextResponse.json({ success: false, error: 'Transaksi penjualan tidak ditemukan' }, { status: 404 });

    const formattedDate = sale.salesPOSDate ? new Date(sale.salesPOSDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

    const printPayload = {
      header: {
        id: String(sale.id),
        invoiceNo: sale.salesPOSNo,
        invoiceDate: formattedDate,
        cashierName: sale.cashierName || 'Kasir Utama POS',
        customerName: sale.customerName || 'Pelanggan Umum',
        paymentType: 'CASH / QRIS',
        bankName: '-',
        subtotal: sale.totalAmount,
        discValue: sale.discountAmount,
        taxValue: 0,
        grandTotal: sale.grandTotal,
        paymentAmount: sale.grandTotal,
        changeAmount: 0,
        isVoid: false,
        description: 'Transaksi Penjualan POS Kasir Dapur',
      },
      items: sale.details.map((d) => ({
        id: String(d.id),
        inventoryNo: d.inventoryNo,
        inventoryName: d.inventoryName,
        uomName: 'Pcs',
        qty: d.qty,
        price: d.price,
        subtotal: d.subtotal,
      })),
    };

    return NextResponse.json({ success: true, data: printPayload });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.salesPOSHeader.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ success: true, message: 'Nota transaksi berhasil di-VOID / dibatalkan' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
