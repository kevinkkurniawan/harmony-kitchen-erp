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
      id: s.id,
      sales_pos_no: s.salesPOSNo,
      sales_pos_date: s.salesPOSDate,
      customer_name: s.customerName,
      total_amount: s.totalAmount,
      discount_amount: s.discountAmount,
      grand_total: s.grandTotal,
      cashier_name: s.cashierName,
      status: s.status,
      items_count: s.details.length,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
