import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const sales = await prisma.salesPOSHeader.findMany({
      include: { details: true },
      orderBy: { id: 'desc' },
      take: 50,
    });

    const mapped = sales.map((s) => ({
      id: String(s.id),
      invoiceNo: s.salesPOSNo,
      sales_pos_no: s.salesPOSNo,
      invoiceDate: s.salesPOSDate.toISOString().split('T')[0],
      sales_pos_date: s.salesPOSDate.toISOString(),
      customerName: s.customerName,
      customer_name: s.customerName,
      cashierName: s.cashierName,
      cashier_name: s.cashierName,
      paymentType: 'CASH',
      bankName: 'BCA',
      totalAmount: s.totalAmount,
      total_amount: s.totalAmount,
      discountAmount: s.discountAmount,
      discount_amount: s.discountAmount,
      subtotal: s.totalAmount,
      grandTotal: s.grandTotal,
      grand_total: s.grandTotal,
      status: s.status,
      items_count: s.details.length,
      itemsCount: s.details.length,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
