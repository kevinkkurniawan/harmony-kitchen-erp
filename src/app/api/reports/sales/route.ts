import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';
    const paymentMethod = searchParams.get('paymentMethod');

    const sales = await prisma.salesPOSHeader.findMany({
      include: { details: true },
      orderBy: { salesPOSDate: 'desc' },
    });

    if (type === 'daily') {
      const dailyMap: Record<string, any> = {};

      for (const s of sales) {
        const dateKey = s.salesPOSDate.toISOString().split('T')[0];
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = {
            date: dateKey,
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

        const d = dailyMap[dateKey];
        d.totalOrders += 1;
        d.totalItems += s.details.reduce((sum, item) => sum + item.qty, 0);
        d.grossSales += s.totalAmount;
        d.totalDiscount += s.discountAmount;
        d.netSales += s.grandTotal;
        d.cashSales += s.grandTotal; // Default cash
      }

      const dailyRows = Object.values(dailyMap);
      return NextResponse.json({ success: true, data: dailyRows });
    }

    if (type === 'monthly') {
      const monthlyMap: Record<string, any> = {};

      for (const s of sales) {
        const monthKey = s.salesPOSDate.toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            month: monthKey,
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

        const m = monthlyMap[monthKey];
        m.totalOrders += 1;
        m.totalItems += s.details.reduce((sum, item) => sum + item.qty, 0);
        m.grossSales += s.totalAmount;
        m.totalDiscount += s.discountAmount;
        m.netSales += s.grandTotal;
        m.cashSales += s.grandTotal;
      }

      const monthlyRows = Object.values(monthlyMap);
      return NextResponse.json({ success: true, data: monthlyRows });
    }

    if (type === 'items') {
      const itemMap: Record<string, any> = {};

      for (const s of sales) {
        for (const item of s.details) {
          const key = item.barcode || item.inventoryNo;
          if (!itemMap[key]) {
            itemMap[key] = {
              barcode: item.barcode,
              inventoryName: item.inventoryName,
              totalQtySold: 0,
              avgUnitPrice: item.price,
              totalRevenue: 0,
              totalCost: 0,
              profit: 0,
            };
          }

          const it = itemMap[key];
          it.totalQtySold += item.qty;
          it.totalRevenue += item.subtotal;
          it.totalCost += (item.price * 0.6) * item.qty; // Estimated cost
          it.profit = it.totalRevenue - it.totalCost;
        }
      }

      const itemRows = Object.values(itemMap);
      return NextResponse.json({ success: true, data: itemRows });
    }

    // Default: summary
    const grossSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalDiscount = sales.reduce((acc, s) => acc + s.discountAmount, 0);
    const netSales = sales.reduce((acc, s) => acc + s.grandTotal, 0);
    const totalOrders = sales.length;
    const totalItemsSold = sales.reduce((acc, s) => acc + s.details.reduce((sum, i) => sum + i.qty, 0), 0);

    const summary = {
      totalOrders,
      totalItemsSold,
      grossSales,
      totalDiscount,
      netSales,
      cashSales: netSales,
      qrisSales: 0,
      transferSales: 0,
      cardSales: 0,
      totalCost: Math.round(netSales * 0.6),
      profit: Math.round(netSales * 0.4),
      profitMarginPct: 40,
    };

    return NextResponse.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Error in GET /api/reports/sales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
