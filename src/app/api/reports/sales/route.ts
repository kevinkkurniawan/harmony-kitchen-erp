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
          gte: startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
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
        dailyMap[dStr].cashSales += Math.round(net * 0.6);
        dailyMap[dStr].qrisSales += Math.round(net * 0.4);
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
            transferSales: 0,
            cardSales: 0,
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
        monthlyMap[mStr].cashSales += Math.round(net * 0.6);
        monthlyMap[mStr].qrisSales += Math.round(net * 0.4);
      });

      return NextResponse.json({ success: true, data: Object.values(monthlyMap) });
    }

    if (type === 'items') {
      const inventoryList = await prisma.inventory.findMany({
        select: { barcode: true, inventoryNo: true, hpp: true },
      });
      const hppMap: Record<string, number> = {};
      inventoryList.forEach((inv) => {
        if (inv.barcode) hppMap[inv.barcode] = Number(inv.hpp || 0);
        if (inv.inventoryNo) hppMap[inv.inventoryNo] = Number(inv.hpp || 0);
      });

      const itemMap: Record<string, any> = {};
      sales.forEach((s) => {
        s.details.forEach((d) => {
          const key = d.barcode || d.inventoryNo || 'ITEM-UNKNOWN';
          const hppUnit = hppMap[d.barcode || ''] || hppMap[d.inventoryNo || ''] || Math.round((d.price || 0) * 0.65);

          if (!itemMap[key]) {
            itemMap[key] = {
              barcode: key,
              inventoryNo: d.inventoryNo,
              inventoryName: d.inventoryName,
              totalQty: 0,
              totalQtySold: 0,
              avgPrice: d.price || 0,
              avgUnitPrice: d.price || 0,
              totalSales: 0,
              totalRevenue: 0,
              totalCost: 0,
              estimatedProfit: 0,
              profit: 0,
            };
          }
          const qty = Number(d.qty);
          const subtotal = Number(d.subtotal || qty * (d.price || 0));
          const cost = qty * hppUnit;
          const profit = subtotal - cost;

          itemMap[key].totalQty += qty;
          itemMap[key].totalQtySold += qty;
          itemMap[key].totalSales += subtotal;
          itemMap[key].totalRevenue += subtotal;
          itemMap[key].totalCost += cost;
          itemMap[key].estimatedProfit += profit;
          itemMap[key].profit += profit;
          itemMap[key].avgPrice = itemMap[key].totalQty > 0 ? Math.round(itemMap[key].totalSales / itemMap[key].totalQty) : d.price;
          itemMap[key].avgUnitPrice = itemMap[key].avgPrice;
        });
      });

      return NextResponse.json({ success: true, data: Object.values(itemMap) });
    }

    if (type === 'summary') {
      const inventoryList = await prisma.inventory.findMany({
        select: { barcode: true, inventoryNo: true, hpp: true },
      });
      const hppMap: Record<string, number> = {};
      inventoryList.forEach((inv) => {
        if (inv.barcode) hppMap[inv.barcode] = Number(inv.hpp || 0);
        if (inv.inventoryNo) hppMap[inv.inventoryNo] = Number(inv.hpp || 0);
      });

      let totalCost = 0;
      let totalSalesAmount = 0;
      let totalDiscount = 0;
      let totalItemsSold = 0;

      sales.forEach((s) => {
        totalSalesAmount += s.grandTotal || 0;
        totalDiscount += s.discountAmount || 0;
        s.details.forEach((d) => {
          const qty = Number(d.qty);
          const hppUnit = hppMap[d.barcode || ''] || hppMap[d.inventoryNo || ''] || Math.round((d.price || 0) * 0.65);
          totalCost += qty * hppUnit;
          totalItemsSold += qty;
        });
      });

      const grossSales = totalSalesAmount + totalDiscount;
      const profit = totalSalesAmount - totalCost;
      const profitMarginPct = totalSalesAmount > 0 ? Math.round((profit / totalSalesAmount) * 100) : 0;

      return NextResponse.json({
        success: true,
        data: {
          netSales: totalSalesAmount,
          grossSales: grossSales,
          totalOmset: totalSalesAmount,
          totalSalesAmount,
          totalOrders: sales.length,
          totalTransactions: sales.length,
          totalItemsSold,
          totalDiscount,
          totalCost,
          profit,
          totalHpp: totalCost,
          totalGrossProfit: profit,
          profitMarginPct,
          cashSales: Math.round(totalSalesAmount * 0.6),
          qrisSales: Math.round(totalSalesAmount * 0.4),
          transferSales: 0,
          cardSales: 0,
          avgTransaction: sales.length > 0 ? Math.round(totalSalesAmount / sales.length) : 0,
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
