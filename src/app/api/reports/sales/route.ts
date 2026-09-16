import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const sales = await prisma.salesPOSHeader.findMany({
      where: {
        salesPOSDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { details: true },
      orderBy: { salesPOSDate: 'desc' },
    });

    if (type === 'daily') {
      const dailyMap: Record<string, any> = {};
      sales.forEach((s: any) => {
        const dStr = s.salesPOSDate ? new Date(s.salesPOSDate).toISOString().slice(0, 10) : '2026-09-01';
        if (!dailyMap[dStr]) {
          dailyMap[dStr] = {
            date: dStr,
            totalOrders: 0,
            totalItems: 0,
            grossSales: 0,
            totalDiscount: 0,
            netSales: 0,
            cashSales: 0,
            qrisSales: 0,
            transferSales: 0,
            cardSales: 0,
          };
        }
        const net = Number(s.grandTotal) || 0;
        const disc = Number(s.discountAmount) || 0;
        const gross = Number(s.totalAmount) || (net + disc);
        const itemsCount = (s.details || []).reduce((sum: number, d: any) => sum + Number(d.qty || 0), 0);

        dailyMap[dStr].totalOrders += 1;
        dailyMap[dStr].totalItems += itemsCount;
        dailyMap[dStr].grossSales += gross;
        dailyMap[dStr].totalDiscount += disc;
        dailyMap[dStr].netSales += net;

        const mockMethod = s.paymentMethod || 'CASH';
        if (mockMethod.toUpperCase().includes('CASH') || mockMethod.toUpperCase().includes('TUNAI')) {
          dailyMap[dStr].cashSales += net;
        } else if (mockMethod.toUpperCase().includes('QRIS')) {
          dailyMap[dStr].qrisSales += net;
        } else if (mockMethod.toUpperCase().includes('TRANSFER')) {
          dailyMap[dStr].transferSales += net;
        } else {
          dailyMap[dStr].cardSales += net;
        }
      });

      return NextResponse.json({ success: true, data: Object.values(dailyMap) });
    }

    if (type === 'monthly') {
      const monthlyMap: Record<string, any> = {};
      sales.forEach((s: any) => {
        const mStr = s.salesPOSDate ? new Date(s.salesPOSDate).toISOString().slice(0, 7) : '2026-09';
        if (!monthlyMap[mStr]) {
          monthlyMap[mStr] = {
            month: mStr,
            totalOrders: 0,
            totalItems: 0,
            grossSales: 0,
            totalDiscount: 0,
            netSales: 0,
            cashSales: 0,
            qrisSales: 0,
            transferSales: 0,
            cardSales: 0,
          };
        }
        const net = Number(s.grandTotal) || 0;
        const disc = Number(s.discountAmount) || 0;
        const gross = Number(s.totalAmount) || (net + disc);
        const itemsCount = (s.details || []).reduce((sum: number, d: any) => sum + Number(d.qty || 0), 0);

        monthlyMap[mStr].totalOrders += 1;
        monthlyMap[mStr].totalItems += itemsCount;
        monthlyMap[mStr].grossSales += gross;
        monthlyMap[mStr].totalDiscount += disc;
        monthlyMap[mStr].netSales += net;

        const mockMethod = s.paymentMethod || 'CASH';
        if (mockMethod.toUpperCase().includes('CASH') || mockMethod.toUpperCase().includes('TUNAI')) {
          monthlyMap[mStr].cashSales += net;
        } else if (mockMethod.toUpperCase().includes('QRIS')) {
          monthlyMap[mStr].qrisSales += net;
        } else if (mockMethod.toUpperCase().includes('TRANSFER')) {
          monthlyMap[mStr].transferSales += net;
        } else {
          monthlyMap[mStr].cardSales += net;
        }
      });

      return NextResponse.json({ success: true, data: Object.values(monthlyMap) });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('Error in GET /api/reports/sales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

