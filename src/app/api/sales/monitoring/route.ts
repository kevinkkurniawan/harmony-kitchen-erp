import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { parseColumnFilters } from '@/lib/column-filter';
import { apiError } from '@/lib/api-response';
import { dateColumnDay } from '@/lib/date-utils';
import { isLegacySale, isUnpaidLegacySale, payGroupFromText, salePaymentType, UNPAID_LABEL } from '@/lib/sales-normalize';

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
    filteredParams.delete('all');

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
      // An open POS draft is a cart still at the till, not a sale (legacy rows have no status)
      AND: [{ OR: [{ status: null }, { status: { not: 'DRAFT' } }] }],
    };

    if (q) {
      where.OR = [
        { salesposno: { contains: q, mode: 'insensitive' as const } },
        { customername: { contains: q, mode: 'insensitive' as const } },
        { createduser: { contains: q, mode: 'insensitive' as const } },
        { paymenttypecode: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    // salesposdate is a DATE column: compare calendar days
    const fromDay = dateColumnDay(dateFrom);
    const toDay = dateColumnDay(dateTo);
    if (fromDay || toDay) {
      where.salesposdate = {};
      if (fromDay) where.salesposdate.gte = fromDay;
      if (toDay) where.salesposdate.lte = toDay;
    }

    const [total, transactions] = await Promise.all([
      prisma.t_salesposheader.count({ where }),
      prisma.t_salesposheader.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    // One t_salespayment row per sale (legacy and new POS both write it); banks for the Bank column
    const paymentsByHeader = await loadPayments(transactions.map((t: any) => Number(t.id)));
    const banks = await prisma.m_bank.findMany({ select: { id: true, bankname: true } });
    const bankName = new Map(banks.map((b: any) => [Number(b.id), b.bankname || '']));

    // Columns of the legacy Bill Opname grid (Frm_BillOpname); the amount lands in one payment column
    const mapped = transactions.map((s: any) => {
      const payments = paymentsByHeader.get(Number(s.id)) || [];
      const pay = payments[0];
      const unpaid = isUnpaidLegacySale(s, payments);
      const paymentType = salePaymentType(s, payments);

      // Legacy: transactionvalue is before the bill discount (voucher + discount), so net = value - discount.
      // New POS: grandtotal is net and the bill discount is on the header (its voucher field holds marketplace payments).
      let transactionValue = 0;
      let finalDiscount = 0;
      if (!unpaid) {
        if (isLegacySale(s)) {
          transactionValue = payments.reduce((sum, p) => sum + Number(p.transactionvalue || 0), 0);
          finalDiscount = payments.reduce((sum, p) => sum + Number(p.voucher || 0) + Number(p.discount || 0), 0);
        } else {
          finalDiscount = Number(s.manualdiscountamount || 0);
          transactionValue = Number(s.grandtotal || 0) + finalDiscount;
        }
      }
      const net = transactionValue - finalDiscount;

      const group = s.paymenttypecode
        ? payGroupFromText(String(s.paymenttypecode))
        : payments.length > 0 ? payGroupFromText(paymentType) : 'CASH';
      const isCreditCard = paymentType === 'CREDIT CARD';
      const amountIn = (match: boolean) => (unpaid || !match ? 0 : net);

      return {
        id: Number(s.id),
        invoiceNo: s.salesposno,
        invoiceDate: s.salesposdate ? new Date(s.salesposdate).toLocaleDateString('id-ID') : '-',
        cashierName: s.createduser || '',
        customerName: s.customername || '',
        paymentType,
        bankName: pay && Number(pay.bankid) > 0 ? bankName.get(Number(pay.bankid)) || '' : '',
        transactionValue,
        finalDiscount,
        paymentValue: unpaid ? 0 : Number(pay?.paymentvalue ?? net),
        changeValue: unpaid ? 0 : Number(pay?.changevalue ?? 0),
        remarks: s.remarks || '',
        tunai: amountIn(group === 'CASH'),
        debit: amountIn(group === 'CARD' && !isCreditCard),
        qris: amountIn(group === 'QRIS'),
        creditCard: amountIn(group === 'CARD' && isCreditCard),
        // Transfer and marketplace payments have no column in the old grid; kept here so the columns add up
        other: amountIn(group === 'TRANSFER' || group === 'OTHER'),
        isVoid: Boolean(s.isvoid),
        isUnpaid: unpaid,
        status: s.isvoid ? 'VOID' : unpaid ? UNPAID_LABEL : (s.status || 'COMPLETED'),
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Payments for the given sales, queried in chunks to stay under Postgres's bind-parameter limit.
async function loadPayments(headerIds: number[]) {
  const paymentsByHeader = new Map<number, any[]>();
  for (let i = 0; i < headerIds.length; i += 10000) {
    const payments = await prisma.t_salespayment.findMany({
      where: { salesposid: { in: headerIds.slice(i, i + 10000) } },
      select: {
        salesposid: true, transactionvalue: true, paymenttypeid: true, bankid: true,
        voucher: true, discount: true, paymentvalue: true, changevalue: true,
      },
    });
    payments.forEach((pm: any) => {
      const hid = Number(pm.salesposid);
      if (!paymentsByHeader.has(hid)) paymentsByHeader.set(hid, []);
      paymentsByHeader.get(hid)!.push(pm);
    });
  }
  return paymentsByHeader;
}
