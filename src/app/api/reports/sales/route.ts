import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { hasCapability } from '@/lib/capabilities';
import { parseBangkokStartOfDay, parseBangkokEndOfDay, formatBangkokDate, formatBangkokMonth, getTodayBangkok } from '@/lib/date-utils';
import { parseColumnFilters } from '@/lib/column-filter';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const canViewProfit = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'daily';
    const startDateParam = searchParams.get('startDate') || searchParams.get('dateFrom');
    const endDateParam = searchParams.get('endDate') || searchParams.get('dateTo');

    // Parse Bangkok timezone dates (+07:00)
    const startDate = startDateParam
      ? parseBangkokStartOfDay(startDateParam)
      : parseBangkokStartOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const endDate = endDateParam
      ? parseBangkokEndOfDay(endDateParam)
      : parseBangkokEndOfDay(getTodayBangkok());

    const { where: columnWhere, unsupportedFilters } = parseColumnFilters(searchParams, {
      whitelist: ['paymenttypecode', 'createduser', 'customername', 'isvoid', 'startDate', 'endDate', 'dateFrom', 'dateTo', 'type'],
      exactMatchFields: ['paymenttypecode'],
      containsFields: ['createduser', 'customername'],
      booleanFields: ['isvoid'],
    });

    if (unsupportedFilters.length > 0) {
      return apiError(
        'BAD_REQUEST',
        `Filter kolom tidak didukung: ${unsupportedFilters.join(', ')}`,
        400,
        unsupportedFilters.map((f) => ({ field: f, message: 'Filter kolom tidak didukung' }))
      );
    }

    const sales = await prisma.t_salesposheader.findMany({
      where: {
        salesposdate: {
          gte: startDate,
          lte: endDate,
        },
        isvoid: false, // Active non-void transactions for reporting
        ...columnWhere,
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
        const dStr = s.salesposdate ? formatBangkokDate(s.salesposdate) : getTodayBangkok();
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
            otherSales: 0,
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
          const qty = Number(d.qty || 0);
          itemsCount += qty;

          // Use authoritative totalhpp or unithpp * qty (with fallback to legacy hpp)
          const lineHpp = Number(d.totalhpp || (Number(d.unithpp || d.hpp || 0) * qty));
          hppSum += lineHpp;
        });

        const gross = net + disc;
        const entry = dailyMap[dStr];

        entry.totalOrders += 1;
        entry.totalItems += itemsCount;
        entry.grossSales += gross;
        entry.totalDiscount += disc;
        entry.netSales += net;

        // Authoritative payment type categorization
        const payType = (s.paymenttypecode || s.remarks || 'CASH').toUpperCase();
        if (payType === 'CASH' || payType.includes('TUNAI')) {
          entry.cashSales += net;
        } else if (payType === 'QRIS' || payType.includes('QRIS')) {
          entry.qrisSales += net;
        } else if (payType === 'TRANSFER' || payType.includes('TRANSFER')) {
          entry.transferSales += net;
        } else if (payType.includes('EDC') || payType.includes('DEBIT') || payType.includes('CARD') || payType === 'BCA' || payType === 'MANDIRI') {
          entry.cardSales += net;
        } else {
          entry.otherSales += net;
        }

        if (canViewProfit) {
          entry.totalHpp += hppSum;
          entry.netIncome = entry.netSales - entry.totalHpp;
          entry.profitMarginPct = entry.netSales > 0 ? Math.round((entry.netIncome / entry.netSales) * 10000) / 100 : 0;
        }
      });

      const result = Object.values(dailyMap).sort((a: any, b: any) => b.date.localeCompare(a.date));
      return apiSuccess(result);
    }

    if (type === 'monthly') {
      const monthlyMap: Record<string, any> = {};

      sales.forEach((s: any) => {
        const mStr = s.salesposdate ? formatBangkokMonth(s.salesposdate) : getTodayBangkok().slice(0, 7);
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
            otherSales: 0,
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
          const qty = Number(d.qty || 0);
          itemsCount += qty;

          const lineHpp = Number(d.totalhpp || (Number(d.unithpp || d.hpp || 0) * qty));
          hppSum += lineHpp;
        });

        const gross = net + disc;
        const entry = monthlyMap[mStr];

        entry.totalOrders += 1;
        entry.totalItems += itemsCount;
        entry.grossSales += gross;
        entry.totalDiscount += disc;
        entry.netSales += net;

        const payType = (s.paymenttypecode || s.remarks || 'CASH').toUpperCase();
        if (payType === 'CASH' || payType.includes('TUNAI')) {
          entry.cashSales += net;
        } else if (payType === 'QRIS' || payType.includes('QRIS')) {
          entry.qrisSales += net;
        } else if (payType === 'TRANSFER' || payType.includes('TRANSFER')) {
          entry.transferSales += net;
        } else if (payType.includes('EDC') || payType.includes('DEBIT') || payType.includes('CARD') || payType === 'BCA' || payType === 'MANDIRI') {
          entry.cardSales += net;
        } else {
          entry.otherSales += net;
        }

        if (canViewProfit) {
          entry.totalHpp += hppSum;
          entry.netIncome = entry.netSales - entry.totalHpp;
          entry.profitMarginPct = entry.netSales > 0 ? Math.round((entry.netIncome / entry.netSales) * 10000) / 100 : 0;
        }
      });

      const result = Object.values(monthlyMap).sort((a: any, b: any) => b.month.localeCompare(a.month));
      return apiSuccess(result);
    }

    return apiError('BAD_REQUEST', `Tipe laporan "${type}" tidak valid.`, 400);
  } catch (err: any) {
    console.error('Error generating sales report:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Gagal membuat laporan penjualan', 500);
  }
}
