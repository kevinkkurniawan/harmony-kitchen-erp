import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const salesQuery = await posPool.query(`
      SELECT t.*,
             (SELECT json_agg(
                 json_build_object(
                   'barcode', p.barcode,
                   'inventoryNo', p.barcode,
                   'inventoryName', p.name,
                   'qty', ti.quantity,
                   'price', ti."selectedPrice",
                   'subtotal', (ti.quantity * ti."selectedPrice")
                 )
               )
              FROM "TransactionItem" ti 
              JOIN "Product" p ON ti."productId" = p.id
              WHERE ti."transactionId" = t.id AND ti."isVoided" = false) as details
      FROM "Transaction" t
      WHERE t.date >= $1 AND t.date <= $2
      ORDER BY t.date DESC
    `, [startDate, endDate]);

    const sales = salesQuery.rows;

    if (type === 'daily') {
      const dailyMap: Record<string, any> = {};
      sales.forEach((s) => {
        const dStr = s.date ? new Date(s.date).toISOString().slice(0, 10) : '2026-09-01';
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
        const net = Number(s.total) || 0;
        const disc = Number(s.discountAmount) || 0;
        const gross = net + disc;
        const itemsCount = (s.details || []).reduce((sum: number, d: any) => sum + Number(d.qty), 0);

        dailyMap[dStr].totalOrders += 1;
        dailyMap[dStr].totalItems += itemsCount;
        dailyMap[dStr].grossSales += gross;
        dailyMap[dStr].totalDiscount += disc;
        dailyMap[dStr].netSales += net;
        if (s.paymentMethod === 'Tunai') dailyMap[dStr].cashSales += net;
        else if (s.paymentMethod === 'QRIS') dailyMap[dStr].qrisSales += net;
        else if (s.paymentMethod === 'Transfer') dailyMap[dStr].transferSales += net;
        else dailyMap[dStr].cardSales += net;
      });

      return NextResponse.json({ success: true, data: Object.values(dailyMap) });
    }

    if (type === 'monthly') {
      const monthlyMap: Record<string, any> = {};
      sales.forEach((s) => {
        const mStr = s.date ? new Date(s.date).toISOString().slice(0, 7) : '2026-09';
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
        const net = Number(s.total) || 0;
        const disc = Number(s.discountAmount) || 0;
        const gross = net + disc;
        const itemsCount = (s.details || []).reduce((sum: number, d: any) => sum + Number(d.qty), 0);

        monthlyMap[mStr].totalOrders += 1;
        monthlyMap[mStr].totalItems += itemsCount;
        monthlyMap[mStr].grossSales += gross;
        monthlyMap[mStr].totalDiscount += disc;
        monthlyMap[mStr].netSales += net;
        if (s.paymentMethod === 'Tunai') monthlyMap[mStr].cashSales += net;
        else if (s.paymentMethod === 'QRIS') monthlyMap[mStr].qrisSales += net;
        else if (s.paymentMethod === 'Transfer') monthlyMap[mStr].transferSales += net;
        else monthlyMap[mStr].cardSales += net;
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
        (s.details || []).forEach((d: any) => {
          const key = d.barcode || d.inventoryNo || 'ITEM-UNKNOWN';
          const hppUnit = hppMap[key] || Math.round((Number(d.price) || 0) * 0.65);

          if (!itemMap[key]) {
            itemMap[key] = {
              barcode: key,
              inventoryNo: d.inventoryNo || key,
              inventoryName: d.inventoryName,
              totalQty: 0,
              totalQtySold: 0,
              avgPrice: Number(d.price) || 0,
              avgUnitPrice: Number(d.price) || 0,
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
          itemMap[key].avgPrice = itemMap[key].totalQty > 0 ? Math.round(itemMap[key].totalSales / itemMap[key].totalQty) : Number(d.price);
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
      
      let cashSales = 0;
      let qrisSales = 0;
      let transferSales = 0;
      let debitSales = 0;

      sales.forEach((s) => {
        totalSalesAmount += Number(s.total) || 0;
        totalDiscount += Number(s.discountAmount) || 0;
        
        if (s.paymentMethod === 'Tunai') cashSales += Number(s.total);
        else if (s.paymentMethod === 'QRIS') qrisSales += Number(s.total);
        else if (s.paymentMethod === 'Transfer') transferSales += Number(s.total);
        else if (s.paymentMethod === 'Debit') debitSales += Number(s.total);
        
        (s.details || []).forEach((d: any) => {
          const key = d.barcode || d.inventoryNo || '';
          const qty = Number(d.qty);
          const hppUnit = hppMap[key] || Math.round((Number(d.price) || 0) * 0.65);
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
          cashSales: cashSales,
          qrisSales: qrisSales,
          transferSales: transferSales,
          cardSales: debitSales,
          avgTransaction: sales.length > 0 ? Math.round(totalSalesAmount / sales.length) : 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: sales,
    });
  } catch (error: any) {
    console.error('Error in GET /api/reports/sales:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
