import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const sales = await prisma.salesPOSHeader.findMany({
      where: {
        salesPOSDate: {
          gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          lte: endDate ? new Date(endDate) : new Date(),
        },
      },
      include: { details: true },
      orderBy: { id: 'desc' },
    });

    const totalSalesAmount = sales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalTransactions = sales.length;

    return NextResponse.json({
      success: true,
      summary: {
        totalSalesAmount,
        totalTransactions,
      },
      data: sales,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
