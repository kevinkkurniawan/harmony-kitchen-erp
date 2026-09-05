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

    const sales = await prisma.t_salesposheader.findMany({
      where: {
        salesposdate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { salesposdate: 'desc' },
    });

    const headerIds = sales.map((s: any) => s.id);
    const details = await prisma.t_salesposdetail.findMany({
      where: { salesposheaderid: { in: headerIds } }
    });

    const detailsByHeader = new Map<number, any[]>();
    details.forEach((d: any) => {
      if (!detailsByHeader.has(d.salesposheaderid)) detailsByHeader.set(d.salesposheaderid, []);
      detailsByHeader.get(d.salesposheaderid)!.push(d);
    });

    if (type === 'daily') {
      const dailyMap: Record<string, any> = {};
      sales.forEach((s: any) => {
        const dStr = s.salesposdate ? new Date(s.salesposdate).toISOString().slice(0, 10) : '2026-09-01';
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
        const net = Number(s.grandtotal) || 0;
        
        let disc = 0;
        let itemsCount = 0;
        const s_details = detailsByHeader.get(s.id) || [];
        s_details.forEach((d: any) => {
          disc += Number(d.disc || 0) + Number(d.disc2 || 0) + Number(d.disc3 || 0);
          itemsCount += Number(d.qty || 0);
        });
        
        const gross = net + disc;

        dailyMap[dStr].totalOrders += 1;
        dailyMap[dStr].totalItems += itemsCount;
        dailyMap[dStr].grossSales += gross;
        dailyMap[dStr].totalDiscount += disc;
        dailyMap[dStr].netSales += net;
        
        const mockMethod = s.remarks || 'Tunai';
        if (mockMethod.toLowerCase().includes('tunai')) dailyMap[dStr].cashSales += net;
        else if (mockMethod.toLowerCase().includes('qris')) dailyMap[dStr].qrisSales += net;
        else if (mockMethod.toLowerCase().includes('transfer')) dailyMap[dStr].transferSales += net;
        else dailyMap[dStr].cardSales += net;
      });

      return NextResponse.json({ success: true, data: Object.values(dailyMap) });
    }

    if (type === 'monthly') {
      const monthlyMap: Record<string, any> = {};
      sales.forEach((s: any) => {
        const mStr = s.salesposdate ? new Date(s.salesposdate).toISOString().slice(0, 7) : '2026-09';
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
        const net = Number(s.grandtotal) || 0;
        
        let disc = 0;
        let itemsCount = 0;
        const s_details = detailsByHeader.get(s.id) || [];
        s_details.forEach((d: any) => {
          disc += Number(d.disc || 0) + Number(d.disc2 || 0) + Number(d.disc3 || 0);
          itemsCount += Number(d.qty || 0);
        });
        
        const gross = net + disc;

        monthlyMap[mStr].totalOrders += 1;
        monthlyMap[mStr].totalItems += itemsCount;
        monthlyMap[mStr].grossSales += gross;
        monthlyMap[mStr].totalDiscount += disc;
        monthlyMap[mStr].netSales += net;
        
        const mockMethod = s.remarks || 'Tunai';
        if (mockMethod.toLowerCase().includes('tunai')) monthlyMap[mStr].cashSales += net;
        else if (mockMethod.toLowerCase().includes('qris')) monthlyMap[mStr].qrisSales += net;
        else if (mockMethod.toLowerCase().includes('transfer')) monthlyMap[mStr].transferSales += net;
        else monthlyMap[mStr].cardSales += net;
      });

      return NextResponse.json({ success: true, data: Object.values(monthlyMap) });
    }

    return NextResponse.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('Error in GET /api/reports/sales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
