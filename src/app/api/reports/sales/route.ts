import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { hasCapability } from '@/lib/capabilities';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const canViewProfit = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'daily';
    const startDateParam = searchParams.get('startDate') || searchParams.get('dateFrom');
    const endDateParam = searchParams.get('endDate') || searchParams.get('dateTo');

    // Bangkok / WIB timezone: UTC+7
    const startDate = startDateParam ? new Date(startDateParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const sales = await prisma.t_salesposheader.findMany({
      where: {
        salesposdate: {
          gte: startDate,
          lte: endDate,
        },
        isvoid: false, // Active non-void transactions for reporting
      },
      orderBy: { salesposdate: 'desc' },
    });

    const headerIds = sales.map((s: any) => s.id);
    const details = await prisma.t_salesposdetail.findMany({
      where: { salesposheaderid: { in: headerIds } },
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
            ...(canViewProfit ? { totalHpp: 0, netIncome: 0, profitMarginPct: 0 } : {}),
          };
        }

        const net = Number(s.grandtotal) || 0;
        let disc = Number(s.manualdiscountamount || 0);
        let itemsCount = 0;
        let hppSum = 0;

        const s_details = detailsByHeader.get(s.id) || [];
        s_details.forEach((d: any) => {
          disc += Number(d.disc || 0) + Number(d.disc2 || 0) + Number(d.disc3 || 0);
          itemsCount += Number(d.qty || 0);
          hppSum += Number(d.hpp || 0) * Number(d.qty || 0);
        });

        const gross = net + disc;
        const entry = dailyMap[dStr];

        entry.totalOrders += 1;
        entry.totalItems += itemsCount;
        entry.grossSales += gross;
        entry.totalDiscount += disc;
        entry.netSales += net;

        const payType = (s.paymenttype || s.remarks || 'CASH').toUpperCase();
        if (payType.includes('CASH') || payType.includes('TUNAI')) entry.cashSales += net;
        else if (payType.includes('QRIS')) entry.qrisSales += net;
        else if (payType.includes('TRANSFER')) entry.transferSales += net;
        else entry.cardSales += net;

        if (canViewProfit) {
          entry.totalHpp += hppSum;
          entry.netIncome = entry.netSales - entry.totalHpp;
          entry.profitMarginPct = entry.netSales > 0 ? Math.round((entry.netIncome / entry.netSales) * 10000) / 100 : 0;
        }
      });

      return apiSuccess(Object.values(dailyMap));
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
            ...(canViewProfit ? { totalHpp: 0, netIncome: 0, profitMarginPct: 0 } : {}),
          };
        }

        const net = Number(s.grandtotal) || 0;
        let disc = Number(s.manualdiscountamount || 0);
        let itemsCount = 0;
        let hppSum = 0;

        const s_details = detailsByHeader.get(s.id) || [];
        s_details.forEach((d: any) => {
          disc += Number(d.disc || 0) + Number(d.disc2 || 0) + Number(d.disc3 || 0);
          itemsCount += Number(d.qty || 0);
          hppSum += Number(d.hpp || 0) * Number(d.qty || 0);
        });

        const gross = net + disc;
        const entry = monthlyMap[mStr];

        entry.totalOrders += 1;
        entry.totalItems += itemsCount;
        entry.grossSales += gross;
        entry.totalDiscount += disc;
        entry.netSales += net;

        const payType = (s.paymenttype || s.remarks || 'CASH').toUpperCase();
        if (payType.includes('CASH') || payType.includes('TUNAI')) entry.cashSales += net;
        else if (payType.includes('QRIS')) entry.qrisSales += net;
        else if (payType.includes('TRANSFER')) entry.transferSales += net;
        else entry.cardSales += net;

        if (canViewProfit) {
          entry.totalHpp += hppSum;
          entry.netIncome = entry.netSales - entry.totalHpp;
          entry.profitMarginPct = entry.netSales > 0 ? Math.round((entry.netIncome / entry.netSales) * 10000) / 100 : 0;
        }
      });

      return apiSuccess(Object.values(monthlyMap));
    }

    // Default item detail breakdown
    return apiSuccess({
      canViewProfit,
      salesCount: sales.length,
    });
  } catch (error: any) {
    console.error('Error generating sales profit report:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal memuat laporan penjualan & profit', 500);
  }
}
