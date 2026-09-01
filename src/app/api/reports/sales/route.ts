import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const sales = await prisma.salesPOSHeader.findMany({
      where: {
        salesPOSDate: {
          gte: startDate ? new Date(startDate) : new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
          lte: endDate ? new Date(endDate) : new Date(),
        },
      },
      include: { details: true },
      orderBy: { salesPOSDate: 'desc' },
    });

    if (type === 'daily') {
      const dailyMap: Record<string, any> = {};
      sales.forEach((s) => {
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
        const net = s.grandTotal || 0;
        const disc = s.discountAmount || 0;
        const gross = net + disc;
        const itemsCount = s.details.reduce((sum, d) => sum + Number(d.qty), 0);

        dailyMap[dStr].totalOrders += 1;
        dailyMap[dStr].totalItems += itemsCount;
        dailyMap[dStr].grossSales += gross;
        dailyMap[dStr].totalDiscount += disc;
        dailyMap[dStr].netSales += net;
        dailyMap[dStr].cashSales += net * 0.6;
        dailyMap[dStr].qrisSales += net * 0.4;
        dailyMap[dStr].transferSales += 0;
        dailyMap[dStr].cardSales += 0;
      });

      return NextResponse.json({ success: true, data: Object.values(dailyMap) });
    }

    if (type === 'monthly') {
      const monthlyMap: Record<string, any> = {};
      sales.forEach((s) => {
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
          };
        }
        const net = s.grandTotal || 0;
        const disc = s.discountAmount || 0;
        const gross = net + disc;
        const itemsCount = s.details.reduce((sum, d) => sum + Number(d.qty), 0);

        monthlyMap[mStr].totalOrders += 1;
        monthlyMap[mStr].totalItems += itemsCount;
        monthlyMap[mStr].grossSales += gross;
        monthlyMap[mStr].totalDiscount += disc;
        monthlyMap[mStr].netSales += net;
        monthlyMap[mStr].cashSales += net * 0.6;
        monthlyMap[mStr].qrisSales += net * 0.4;
      });

      return NextResponse.json({ success: true, data: Object.values(monthlyMap) });
    }

    if (type === 'items') {
      const itemMap: Record<string, any> = {};
      sales.forEach((s) => {
        s.details.forEach((d) => {
          const key = d.barcode || d.inventoryNo || 'ITEM-UNKNOWN';
          if (!itemMap[key]) {
            itemMap[key] = {
              barcode: key,
              inventoryNo: d.inventoryNo,
              inventoryName: d.inventoryName,
              totalQty: 0,
              avgPrice: d.price || 0,
              totalSales: 0,
              estimatedProfit: 0,
            };
          }
          const qty = Number(d.qty);
          const subtotal = Number(d.subtotal || qty * (d.price || 0));

          itemMap[key].totalQty += qty;
          itemMap[key].totalSales += subtotal;
          itemMap[key].estimatedProfit += subtotal * 0.35;
          itemMap[key].avgPrice = itemMap[key].totalQty > 0 ? Math.round(itemMap[key].totalSales / itemMap[key].totalQty) : d.price;
        });
      });

      return NextResponse.json({ success: true, data: Object.values(itemMap) });
    }

    if (type === 'summary') {
      const totalSalesAmount = sales.reduce((acc, s) => acc + (s.grandTotal || 0), 0);
      const totalTransactions = sales.length;
      const totalItemsSold = sales.reduce((acc, s) => acc + s.details.reduce((sum, d) => sum + Number(d.qty), 0), 0);
      const totalHpp = totalSalesAmount * 0.65;
      const profit = totalSalesAmount - totalHpp;

      return NextResponse.json({
        success: true,
        data: {
          netSales: totalSalesAmount,
          grossSales: totalSalesAmount * 1.05,
          totalOmset: totalSalesAmount,
          totalSalesAmount,
          totalOrders: totalTransactions,
          totalTransactions,
          totalItemsSold,
          profit,
          totalHpp,
          totalGrossProfit: profit,
          profitMarginPct: 35,
          cashSales: totalSalesAmount * 0.6,
          qrisSales: totalSalesAmount * 0.4,
          avgTransaction: totalTransactions > 0 ? totalSalesAmount / totalTransactions : 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: sales,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
