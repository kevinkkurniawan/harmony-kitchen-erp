import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { canUserViewHpp } from '@/lib/capabilities';
import { dateColumnDay, formatBangkokDate, formatBangkokDateTime, formatBangkokMonth, getTodayBangkok } from '@/lib/date-utils';
import { parseColumnFilters } from '@/lib/column-filter';
import { isCreditCardSale, isLegacySale, normalizeSaleTotals, saleCashierName, salePaymentName, type NormalizedSale, type SaleTotals } from '@/lib/sales-normalize';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const canViewProfit = canUserViewHpp(user);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'daily';
    const startDateParam = searchParams.get('startDate') || searchParams.get('dateFrom');
    const endDateParam = searchParams.get('endDate') || searchParams.get('dateTo');
    const paymentMethodParam = searchParams.get('paymentMethod');

    // salesposdate is a DATE column: compare calendar days (default: last 30 days up to today, Bangkok)
    const startDate =
      dateColumnDay(startDateParam) ??
      dateColumnDay(formatBangkokDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))!;
    const endDate = dateColumnDay(endDateParam) ?? dateColumnDay(getTodayBangkok())!;

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
      select: { id: true, salesposdate: true, grandtotal: true, paymenttypecode: true, status: true, manualdiscountamount: true },
    });

    // Sum each sale's lines and payments in the database instead of loading every row (a year is ~35k lines).
    // The ids go as one array parameter, so no chunking for Postgres's bind-parameter limit.
    const headerIds = allSales.map((s) => Number(s.id));
    const totalsById = await loadSaleTotals(headerIds);

    // Legacy sales without a payment were never paid; the old app leaves them out of its totals too
    const emptyTotals: SaleTotals = { lineDisc: 0, lineTotal: 0, items: 0, hpp: 0, payCount: 0, paidValue: 0, payDisc: 0, payDiscount: 0, firstPayTypeId: null };
    const paidSales = allSales.filter((s) => {
      const t = totalsById.get(Number(s.id)) ?? emptyTotals;
      return !(isLegacySale(s) && t.payCount === 0);
    });

    const normalized = new Map<number, NormalizedSale>();
    // Card sales paid by credit card: the old report splits card totals into Debit and Kredit
    const creditCardIds = new Set<number>();
    paidSales.forEach((s) => {
      const totals = totalsById.get(Number(s.id)) ?? emptyTotals;
      normalized.set(Number(s.id), normalizeSaleTotals(s, totals));
      if (isCreditCardSale(s, totals)) creditCardIds.add(Number(s.id));
    });

    const pmFilter = paymentMethodParam && paymentMethodParam !== 'All' ? paymentMethodParam.toUpperCase() : null;
    const sales = pmFilter
      ? paidSales.filter((s: any) => normalized.get(Number(s.id))!.payGroup === pmFilter)
      : paidSales;

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
            debitSales: 0,
            creditSales: 0,
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
        else if (payGroup === 'CARD') {
          entry.cardSales += net;
          if (creditCardIds.has(Number(s.id))) entry.creditSales += net;
          else entry.debitSales += net;
        } else entry.otherSales += net;

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
            debitSales: 0,
            creditSales: 0,
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
        else if (payGroup === 'CARD') {
          entry.cardSales += net;
          if (creditCardIds.has(Number(s.id))) entry.creditSales += net;
          else entry.debitSales += net;
        } else entry.otherSales += net;

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
      const saleIds = sales.map((s) => Number(s.id));
      const itemRows = saleIds.length === 0 ? [] : await prisma.$queryRaw<{ inventoryid: number; qty: unknown; revenue: unknown; cost: unknown }[]>`
        SELECT d.inventoryid,
               SUM(COALESCE(d.qty, 0)) AS qty,
               SUM(COALESCE(d.subtotal, 0)) AS revenue,
               SUM(COALESCE(d.totalhpp, COALESCE(d.unithpp, 0) * COALESCE(d.qty, 0))) AS cost
        FROM t_salesposdetail d
        WHERE d.salesposheaderid = ANY(${saleIds}::int[]) AND d.inventoryid IS NOT NULL AND d.inventoryid <> 0
        GROUP BY d.inventoryid`;
      const itemMap = new Map(itemRows.map((r) => [Number(r.inventoryid), {
        inventoryId: Number(r.inventoryid),
        totalQtySold: Number(r.qty),
        totalRevenue: Number(r.revenue),
        totalCost: Number(r.cost),
      }]));

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
          inventoryId: it.inventoryId,
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
      let debitSales = 0;
      let creditSales = 0;
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
        else if (payGroup === 'CARD') {
          cardSales += net;
          if (creditCardIds.has(Number(s.id))) creditSales += net;
          else debitSales += net;
        }
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
        debitSales: String(debitSales),
        creditSales: String(creditSales),
        totalCost: canViewProfit ? totalCost : 0,
        profit: canViewProfit ? profit : 0,
        profitMarginPct: canViewProfit ? profitMarginPct : 0,
      };

      return apiSuccess(result);
    }

    // 5. NOTA LIST: one row per sale for the old daily reports (Rpt_SalesDaily / Rpt_SalesDailyPerCashier) and the
    // Bill Opname "Laporan Bulanan / Harian" (Rpt_Monthly). Same sales and net as the daily rows above, so a day's
    // notas add up to that day's Laporan Summary total. The old SPs group by payment date; the ERP reports use the
    // sale date. No HPP here: the old reports show only the amount.
    if (type === 'nota') {
      const saleIds = sales.map((s) => Number(s.id));
      // Nota no., cashier and time are read here, not in the shared query above, so the other reports' queries stay as they were
      const [payTypes, noteRows] = await Promise.all([
        prisma.m_paymenttype.findMany({ select: { id: true, name: true } }),
        saleIds.length === 0 ? [] : prisma.$queryRaw<{ id: number; salesposno: string; createduser: string; paidat: Date | null }[]>`
          SELECT h.id, h.salesposno, h.createduser, COALESCE(MIN(p.paymentdate), h.createddate) AS paidat
          FROM t_salesposheader h
          LEFT JOIN t_salespayment p ON p.salesposid = h.id
          WHERE h.id = ANY(${saleIds}::int[])
          GROUP BY h.id`,
      ]);
      // Old SP: M_PaymentType.ID - 1 = T_SalesPayment.PaymentTypeID
      const typeNameByCode = new Map(payTypes.filter((t) => t.name).map((t) => [Number(t.id) - 1, t.name!]));
      const noteById = new Map(noteRows.map((r) => [Number(r.id), r]));

      const result = sales.map((s) => {
        const id = Number(s.id);
        const totals = totalsById.get(id) ?? emptyTotals;
        // "Jam" of Rpt_Monthly is the payment time; a sale without a payment row falls back to its creation time
        const note = noteById.get(id);
        return {
          id,
          date: s.salesposdate ? formatBangkokDate(s.salesposdate) : getTodayBangkok(),
          salesPosNo: note?.salesposno ?? '',
          time: note?.paidat ? formatBangkokDateTime(note.paidat).slice(11, 19) : '',
          paymentName: salePaymentName(s, totals, typeNameByCode),
          cashier: saleCashierName(note?.createduser),
          amount: normalized.get(id)!.net,
        };
      }).sort((a, b) => a.date.localeCompare(b.date) || a.salesPosNo.localeCompare(b.salesPosNo));

      return apiSuccess(result);
    }

    return apiError('BAD_REQUEST', `Tipe laporan "${type}" tidak valid.`, 400);
  } catch (err: any) {
    console.error('Error generating sales report:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Gagal membuat laporan penjualan', 500);
  }
}

/**
 * Per-sale sums of lines and payments, matching saleTotals() in sales-normalize.
 * Line HPP falls back to unithpp * qty only when totalhpp is NULL (a stored 0 stays 0), like the JS version.
 */
async function loadSaleTotals(headerIds: number[]): Promise<Map<number, SaleTotals>> {
  const totals = new Map<number, SaleTotals>();
  if (headerIds.length === 0) return totals;
  const [lines, pays] = await Promise.all([
    prisma.$queryRaw<{ id: number; linedisc: unknown; linetotal: unknown; items: unknown; hpp: unknown }[]>`
      SELECT d.salesposheaderid AS id,
             SUM(COALESCE(d.disc, 0) + COALESCE(d.disc2, 0) + COALESCE(d.disc3, 0)) AS linedisc,
             SUM(COALESCE(d.subtotal, COALESCE(d.price, 0) * COALESCE(d.qty, 0))) AS linetotal,
             SUM(COALESCE(d.qty, 0)) AS items,
             SUM(COALESCE(d.totalhpp, COALESCE(d.unithpp, 0) * COALESCE(d.qty, 0))) AS hpp
      FROM t_salesposdetail d
      WHERE d.salesposheaderid = ANY(${headerIds}::int[])
      GROUP BY d.salesposheaderid`,
    prisma.$queryRaw<{ id: number; paycount: unknown; paidvalue: unknown; paydisc: unknown; paydiscount: unknown; firstpaytypeid: number | null }[]>`
      SELECT p.salesposid AS id,
             COUNT(*) AS paycount,
             SUM(COALESCE(p.transactionvalue, 0)) AS paidvalue,
             SUM(COALESCE(p.voucher, 0) + COALESCE(p.discount, 0)) AS paydisc,
             SUM(COALESCE(p.discount, 0)) AS paydiscount,
             MIN(p.paymenttypeid) AS firstpaytypeid
      FROM t_salespayment p
      WHERE p.salesposid = ANY(${headerIds}::int[])
      GROUP BY p.salesposid`,
  ]);
  const get = (id: number) => {
    let t = totals.get(id);
    if (!t) {
      t = { lineDisc: 0, lineTotal: 0, items: 0, hpp: 0, payCount: 0, paidValue: 0, payDisc: 0, payDiscount: 0, firstPayTypeId: null };
      totals.set(id, t);
    }
    return t;
  };
  lines.forEach((r) => {
    const t = get(Number(r.id));
    t.lineDisc = Number(r.linedisc);
    t.lineTotal = Number(r.linetotal);
    t.items = Number(r.items);
    t.hpp = Number(r.hpp);
  });
  pays.forEach((r) => {
    const t = get(Number(r.id));
    t.payCount = Number(r.paycount);
    t.paidValue = Number(r.paidvalue);
    t.payDisc = Number(r.paydisc);
    t.payDiscount = Number(r.paydiscount);
    t.firstPayTypeId = r.firstpaytypeid === null ? null : Number(r.firstpaytypeid);
  });
  return totals;
}
