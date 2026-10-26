import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { parseColumnFilters } from '@/lib/column-filter';
import { parseBangkokStartOfDay, parseBangkokEndOfDay } from '@/lib/date-utils';
import { apiError } from '@/lib/api-response';
import { isLegacySale, normalizeSale } from '@/lib/sales-normalize';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('startDate');
    const dateTo = searchParams.get('dateTo') || searchParams.get('endDate');
    const paginationParams = getPaginationParams(req, 50);

    const filteredParams = new URLSearchParams(searchParams);
    filteredParams.delete('dateFrom');
    filteredParams.delete('dateTo');
    filteredParams.delete('startDate');
    filteredParams.delete('endDate');
    filteredParams.delete('q');
    filteredParams.delete('page');
    filteredParams.delete('limit');

    const { where: columnWhere, unsupportedFilters } = parseColumnFilters(filteredParams, {
      whitelist: ['salesposno', 'customername', 'paymenttypecode', 'status', 'isvoid', 'createduser'],
      exactMatchFields: ['paymenttypecode', 'status'],
      containsFields: ['salesposno', 'customername', 'createduser'],
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
      ...columnWhere,
    };

    if (q) {
      where.OR = [
        { salesposno: { contains: q, mode: 'insensitive' as const } },
        { customername: { contains: q, mode: 'insensitive' as const } },
        { createduser: { contains: q, mode: 'insensitive' as const } },
        { paymenttypecode: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    if (dateFrom || dateTo) {
      where.salesposdate = {};
      if (dateFrom) where.salesposdate.gte = parseBangkokStartOfDay(dateFrom);
      if (dateTo) where.salesposdate.lte = parseBangkokEndOfDay(dateTo);
    }

    const summaryWhere = {
      ...where,
      isvoid: false,
    };

    const [total, transactions, activeHeadersForSummary] = await Promise.all([
      prisma.t_salesposheader.count({ where }),
      prisma.t_salesposheader.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
      prisma.t_salesposheader.findMany({
        where: summaryWhere,
        select: {
          id: true,
          grandtotal: true,
          paymenttypecode: true,
          status: true,
          manualdiscountamount: true,
        },
      }),
    ]);

    // Legacy sales keep their amount and payment type in t_salespayment / the lines, not on the header
    const legacyIds = [...activeHeadersForSummary, ...transactions]
      .filter((h: any) => isLegacySale(h))
      .map((h: any) => Number(h.id));
    const { detailsByHeader: legacyDetails, paymentsByHeader: legacyPayments } = await loadLinesAndPayments(
      Array.from(new Set(legacyIds)),
    );
    const saleView = (h: any) => {
      if (!isLegacySale(h)) {
        return { amount: Number(h.grandtotal || 0), paymentType: (h.paymenttypecode || 'CASH').toUpperCase() };
      }
      const id = Number(h.id);
      const n = normalizeSale(h, legacyDetails.get(id) || [], legacyPayments.get(id) || []);
      return { amount: n.net, paymentType: n.payGroup === 'CARD' ? 'DEBIT' : n.payGroup };
    };

    let grossSales = 0;
    const paymentBreakdown: Record<string, number> = {
      CASH: 0,
      QRIS: 0,
      TRANSFER: 0,
      DEBIT: 0,
      TEMPO: 0,
    };

    for (const h of activeHeadersForSummary) {
      const { amount: amt, paymentType: pt } = saleView(h);
      grossSales += amt;
      if (paymentBreakdown[pt] !== undefined) {
        paymentBreakdown[pt] += amt;
      } else {
        paymentBreakdown[pt] = amt;
      }
    }

    const totalCount = activeHeadersForSummary.length;
    const avgBasket = totalCount > 0 ? Math.round(grossSales / totalCount) : 0;

    const summary = {
      grossSales,
      totalCount,
      avgBasket,
      paymentBreakdown,
    };

    const headerIds = transactions.map((t: any) => Number(t.id));
    const details = await prisma.t_salesposdetail.findMany({
      where: { salesposheaderid: { in: headerIds } }
    });
    
    // Attach details to headers
    const detailsByHeader = new Map<number, any[]>();
    details.forEach((d: any) => {
      const hId = Number(d.salesposheaderid);
      if (!detailsByHeader.has(hId)) detailsByHeader.set(hId, []);
      detailsByHeader.get(hId)!.push(d);
    });

    const inventoryIds = Array.from(new Set(
      details.map((d: any) => Number(d.inventoryid))
    )).filter(Boolean) as number[];
    const inventories = await prisma.m_inventory.findMany({ where: { id: { in: inventoryIds } }, include: { m_uom: true } });
    const inventoryMap = new Map(inventories.map((i: any) => [Number(i.id), i]));

    const mapped = transactions.map((s: any) => {
      const s_details = detailsByHeader.get(Number(s.id)) || [];
      const txDate = s.salesposdate ? new Date(s.salesposdate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const simpleDate = s.salesposdate ? new Date(s.salesposdate).toLocaleDateString('id-ID') : '-';
      
      const subtotal = s_details.reduce((acc: number, item: any) => acc + Number(item.subtotal || 0), 0);
      const discount = s_details.reduce((acc: number, item: any) => acc + Number(item.disc || 0) + Number(item.disc2 || 0) + Number(item.disc3 || 0), 0);
      const { amount: grandTotal, paymentType } = saleView(s);

      return {
        id: Number(s.id),
        invoiceNo: s.salesposno,
        invoice_no: s.salesposno,
        salesPOSNo: s.salesposno,
        sales_pos_no: s.salesposno,
        transactionDate: txDate,
        invoiceDate: simpleDate,
        salesPOSDate: simpleDate,
        sales_pos_date: simpleDate,
        customerName: s.customername || 'Pelanggan Umum',
        customer_name: s.customername || 'Pelanggan Umum',
        cashierName: s.createduser || 'Kasir',
        cashier_name: s.createduser || 'Kasir',
        paymentMethod: s.paymenttypecode || paymentType,
        paymentType: s.paymenttypecode || paymentType,
        payment_method: s.paymenttypecode || paymentType,
        subtotal: subtotal,
        totalAmount: subtotal,
        total_amount: subtotal,
        discount: discount,
        discountAmount: discount,
        discValue: discount,
        discount_amount: discount,
        tax: 0,
        taxAmount: 0,
        tax_amount: 0,
        grandTotal,
        grand_total: grandTotal,
        amountPaid: grandTotal,
        amount_paid: grandTotal,
        changeAmount: 0,
        change_amount: 0,
        isVoid: Boolean(s.isvoid),
        status: s.isvoid ? 'VOID' : (s.status || 'COMPLETED'),
        items: s_details.map((d: any) => {
          const inv = inventoryMap.get(Number(d.inventoryid));
          return {
            id: Number(d.id),
            productId: Number(d.inventoryid),
            product_id: Number(d.inventoryid),
            barcode: inv?.barcode || '',
            productName: inv?.inventoryname || '',
            product_name: inv?.inventoryname || '',
            uomName: inv?.m_uom?.uomname || 'Pcs',
            uom_name: inv?.m_uom?.uomname || 'Pcs',
            qty: Number(d.qty),
            unitPrice: Number(d.price),
            unit_price: Number(d.price),
            subtotal: Number(d.subtotal),
            discount: Number(d.disc || 0),
          };
        }),
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams, { summary });
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Lines and payments for the given sales, queried in chunks to stay under Postgres's bind-parameter limit.
async function loadLinesAndPayments(headerIds: number[]) {
  const detailsByHeader = new Map<number, any[]>();
  const paymentsByHeader = new Map<number, any[]>();
  for (let i = 0; i < headerIds.length; i += 10000) {
    const ids = headerIds.slice(i, i + 10000);
    const [details, payments] = await Promise.all([
      prisma.t_salesposdetail.findMany({
        where: { salesposheaderid: { in: ids } },
        select: { salesposheaderid: true, qty: true, price: true, subtotal: true, disc: true, disc2: true, disc3: true },
      }),
      prisma.t_salespayment.findMany({
        where: { salesposid: { in: ids } },
        select: { salesposid: true, transactionvalue: true, paymenttypeid: true },
      }),
    ]);
    details.forEach((d: any) => {
      const hid = Number(d.salesposheaderid);
      if (!detailsByHeader.has(hid)) detailsByHeader.set(hid, []);
      detailsByHeader.get(hid)!.push(d);
    });
    payments.forEach((pm: any) => {
      const hid = Number(pm.salesposid);
      if (!paymentsByHeader.has(hid)) paymentsByHeader.set(hid, []);
      paymentsByHeader.get(hid)!.push(pm);
    });
  }
  return { detailsByHeader, paymentsByHeader };
}
