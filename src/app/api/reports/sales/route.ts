import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { hasCapability } from '@/lib/capabilities';
import { parseBangkokStartOfDay, parseBangkokEndOfDay, formatBangkokDate, formatBangkokMonth, getTodayBangkok } from '@/lib/date-utils';
import { parseColumnFilters } from '@/lib/column-filter';
import { normalizeSale, type NormalizedSale } from '@/lib/sales-normalize';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const canViewProfit = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'daily';
    const startDateParam = searchParams.get('startDate') || searchParams.get('dateFrom');
    const endDateParam = searchParams.get('endDate') || searchParams.get('dateTo');
    const paymentMethodParam = searchParams.get('paymentMethod');

    // Parse Bangkok timezone dates (+07:00)
    const startDate = startDateParam
      ? parseBangkokStartOfDay(startDateParam)
      : parseBangkokStartOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const endDate = endDateParam
      ? parseBangkokEndOfDay(endDateParam)
      : parseBangkokEndOfDay(getTodayBangkok());

    const filteredParams = new URLSearchParams(searchParams);
    filteredParams.delete('startDate');
    filteredParams.delete('endDate');
    filteredParams.delete('dateFrom');
    filteredParams.delete('dateTo');
    filteredParams.delete('type');
    filteredParams.delete('paymentMethod');
    filteredParams.delete('page');
    filteredParams.delete('limit');

    const { where: columnWhere, unsupportedFilters } = parseColumnFilters(filteredParams, {
      whitelist: ['paymenttypecode', 'createduser', 'customername', 'isvoid'],
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

    const where: any = {
      salesposdate: {
        gte: startDate,
        lte: endDate,
      },
      isvoid: false, // Active non-void transactions for reporting
      // Unpaid POS drafts are not sales (legacy rows have no status)
      ...columnWhere,
      AND: [{ OR: [{ status: null }, { status: { not: 'DRAFT' } }] }],
    };

    const allSales = await prisma.t_salesposheader.findMany({
      where,
      orderBy: { salesposdate: 'desc' },
    });

    // A long period covers tens of thousands of sales; query their lines and payments in chunks
    // to stay under Postgres's bind-parameter limit.
    const headerIds = allSales.map((s: any) => Number(s.id));
    const idChunks: number[][] = [];
    for (let i = 0; i < headerIds.length; i += 10000) idChunks.push(headerIds.slice(i, i + 10000));
    const [details, payments] = await Promise.all([
      Promise.all(idChunks.map((ids) => prisma.t_salesposdetail.findMany({ where: { salesposheaderid: { in: ids } } }))).then((r) => r.flat()),
      Promise.all(idChunks.map((ids) => prisma.t_salespayment.findMany({ where: { salesposid: { in: ids } } }))).then((r) => r.flat()),
    ]);

    const detailsByHeader = new Map<number, any[]>();
    details.forEach((d: any) => {
      const hid = Number(d.salesposheaderid);
      if (!detailsByHeader.has(hid)) detailsByHeader.set(hid, []);
      detailsByHeader.get(hid)!.push(d);
    });
    const paymentsByHeader = new Map<number, any[]>();
    payments.forEach((pm: any) => {
      const hid = Number(pm.salesposid);
      if (!paymentsByHeader.has(hid)) paymentsByHeader.set(hid, []);
      paymentsByHeader.get(hid)!.push(pm);
    });

    const normalized = new Map<number, NormalizedSale>();
    allSales.forEach((s: any) => {
      normalized.set(
        Number(s.id),
        normalizeSale(s, detailsByHeader.get(Number(s.id)) || [], paymentsByHeader.get(Number(s.id)) || [])
      );
    });

    const pmFilter = paymentMethodParam && paymentMethodParam !== 'All' ? paymentMethodParam.toUpperCase() : null;
    const sales = pmFilter
      ? allSales.filter((s: any) => normalized.get(Number(s.id))!.payGroup === pmFilter)
      : allSales;

    // 1. DAILY REPORT
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

        const { net, disc, items: itemsCount, hpp: hppSum, payGroup } = normalized.get(Number(s.id))!;
        const gross = net + disc;
        const entry = dailyMap[dStr];

        entry.totalOrders += 1;
        entry.totalItems += itemsCount;
        entry.grossSales += gross;
        entry.totalDiscount += disc;
        entry.netSales += net;

        if (payGroup === 'CASH') entry.cashSales += net;
        else if (payGroup === 'QRIS') entry.qrisSales += net;
        else if (payGroup === 'TRANSFER') entry.transferSales += net;
        else if (payGroup === 'CARD') entry.cardSales += net;
        else entry.otherSales += net;

        if (canViewProfit) {
          entry.totalHpp += hppSum;
          entry.netIncome = entry.netSales - entry.totalHpp;
          entry.profitMarginPct = entry.netSales > 0 ? Math.round((entry.netIncome / entry.netSales) * 10000) / 100 : 0;
        }
      });

      const result = Object.values(dailyMap).sort((a: any, b: any) => b.date.localeCompare(a.date));
      return apiSuccess(result);
    }

    // 2. MONTHLY REPORT
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

        const { net, disc, items: itemsCount, hpp: hppSum, payGroup } = normalized.get(Number(s.id))!;
        const gross = net + disc;
        const entry = monthlyMap[mStr];

        entry.totalOrders += 1;
        entry.totalItems += itemsCount;
        entry.grossSales += gross;
        entry.totalDiscount += disc;
        entry.netSales += net;

        if (payGroup === 'CASH') entry.cashSales += net;
        else if (payGroup === 'QRIS') entry.qrisSales += net;
        else if (payGroup === 'TRANSFER') entry.transferSales += net;
        else if (payGroup === 'CARD') entry.cardSales += net;
        else entry.otherSales += net;

        if (canViewProfit) {
          entry.totalHpp += hppSum;
          entry.netIncome = entry.netSales - entry.totalHpp;
          entry.profitMarginPct = entry.netSales > 0 ? Math.round((entry.netIncome / entry.netSales) * 10000) / 100 : 0;
        }
      });

      const result = Object.values(monthlyMap).sort((a: any, b: any) => b.month.localeCompare(a.month));
      return apiSuccess(result);
    }

    // 3. ITEM SALES REPORT
    if (type === 'items') {
      const itemMap = new Map<number, {
        inventoryId: number;
        totalQtySold: number;
        totalRevenue: number;
        totalCost: number;
      }>();

      sales.forEach((s: any) => {
        const s_details = detailsByHeader.get(Number(s.id)) || [];
        s_details.forEach((d: any) => {
          const invId = Number(d.inventoryid);
          if (!invId) return;

          if (!itemMap.has(invId)) {
            itemMap.set(invId, {
              inventoryId: invId,
              totalQtySold: 0,
              totalRevenue: 0,
              totalCost: 0,
            });
          }

          const entry = itemMap.get(invId)!;
          const qty = Number(d.qty || 0);
          const revenue = Number(d.subtotal || 0);
          const lineHpp = Number(d.totalhpp || (Number(d.unithpp || d.hpp || 0) * qty));

          entry.totalQtySold += qty;
          entry.totalRevenue += revenue;
          entry.totalCost += lineHpp;
        });
      });

      const invIds = Array.from(itemMap.keys());
      const inventories = await prisma.m_inventory.findMany({
        where: { id: { in: invIds } },
        select: { id: true, barcode: true, inventoryname: true },
      });
      const invMap = new Map(inventories.map((i: any) => [Number(i.id), i]));

      const result = Array.from(itemMap.values()).map((it) => {
        const inv = invMap.get(it.inventoryId);
        const avgPrice = it.totalQtySold > 0 ? Math.round(it.totalRevenue / it.totalQtySold) : 0;
        const profit = it.totalRevenue - it.totalCost;

        return {
          barcode: inv?.barcode || '-',
          inventoryName: inv?.inventoryname || 'Barang Persediaan',
          totalQtySold: it.totalQtySold,
          avgUnitPrice: String(avgPrice),
          totalRevenue: String(it.totalRevenue),
          totalCost: canViewProfit ? String(it.totalCost) : '0',
          profit: canViewProfit ? String(profit) : '0',
        };
      }).sort((a, b) => b.totalQtySold - a.totalQtySold);

      return apiSuccess(result);
    }

    // 4. SUMMARY REPORT
    if (type === 'summary') {
      let totalOrders = sales.length;
      let totalItemsSold = 0;
      let grossSales = 0;
      let totalDiscount = 0;
      let netSales = 0;
      let cashSales = 0;
      let qrisSales = 0;
      let transferSales = 0;
      let cardSales = 0;
      let totalCost = 0;

      sales.forEach((s: any) => {
        const { net, disc, items: s_items, hpp: s_hpp, payGroup } = normalized.get(Number(s.id))!;
        const gross = net + disc;
        totalItemsSold += s_items;
        grossSales += gross;
        totalDiscount += disc;
        netSales += net;
        totalCost += s_hpp;

        if (payGroup === 'CASH') cashSales += net;
        else if (payGroup === 'QRIS') qrisSales += net;
        else if (payGroup === 'TRANSFER') transferSales += net;
        else if (payGroup === 'CARD') cardSales += net;
      });

      const profit = netSales - totalCost;
      const profitMarginPct = netSales > 0 ? Math.round((profit / netSales) * 10000) / 100 : 0;

      const result = {
        totalOrders,
        totalItemsSold,
        grossSales: String(grossSales),
        totalDiscount: String(totalDiscount),
        netSales: String(netSales),
        cashSales: String(cashSales),
        qrisSales: String(qrisSales),
        transferSales: String(transferSales),
        cardSales: String(cardSales),
        totalCost: canViewProfit ? totalCost : 0,
        profit: canViewProfit ? profit : 0,
        profitMarginPct: canViewProfit ? profitMarginPct : 0,
      };

      return apiSuccess(result);
    }

    return apiError('BAD_REQUEST', `Tipe laporan "${type}" tidak valid.`, 400);
  } catch (err: any) {
    console.error('Error generating sales report:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Gagal membuat laporan penjualan', 500);
  }
}
