import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const paginationParams = getPaginationParams(request, 50);

    const where: any = {};
    if (q) {
      where.OR = [
        { salesPOSNo: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { cashierName: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (dateFrom || dateTo) {
      where.salesPOSDate = {};
      if (dateFrom) where.salesPOSDate.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.salesPOSDate.lte = to;
      }
    }

    const [total, sales] = await Promise.all([
      prisma.salesPOSHeader.count({ where }),
      prisma.salesPOSHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

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

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
