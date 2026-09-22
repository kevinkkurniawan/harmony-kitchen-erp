import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { parseColumnFilters } from '@/lib/column-filter';
import { parseBangkokStartOfDay, parseBangkokEndOfDay } from '@/lib/date-utils';
import { apiError } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('startDate');
    const dateTo = searchParams.get('dateTo') || searchParams.get('endDate');
    const paginationParams = getPaginationParams(req, 50);

    const { where: columnWhere, unsupportedFilters } = parseColumnFilters(searchParams, {
      whitelist: ['salesposno', 'customername', 'paymenttypecode', 'status', 'isvoid', 'createduser', 'dateFrom', 'dateTo', 'startDate', 'endDate', 'page', 'limit'],
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
      ];
    }

    if (dateFrom || dateTo) {
      where.salesposdate = {};
      if (dateFrom) where.salesposdate.gte = parseBangkokStartOfDay(dateFrom);
      if (dateTo) where.salesposdate.lte = parseBangkokEndOfDay(dateTo);
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

    const headerIds = transactions.map((t: any) => Number(t.id));
    const details = await prisma.t_salesposdetail.findMany({
      where: { salesposheaderid: { in: headerIds } }
    });
    
    // Attach details to headers
    const detailsByHeader = new Map<number, any[]>();
    details.forEach((d: any) => {
      if (!detailsByHeader.has(d.salesposheaderid)) detailsByHeader.set(d.salesposheaderid, []);
      detailsByHeader.get(d.salesposheaderid)!.push(d);
    });

    const inventoryIds = Array.from(new Set(
      details.map((d: any) => d.inventoryid)
    )).filter(Boolean) as number[];
    const inventories = await prisma.m_inventory.findMany({ where: { id: { in: inventoryIds } }, include: { m_uom: true } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));

    const mapped = transactions.map((s: any) => {
      const s_details = detailsByHeader.get(s.id) || [];
      const txDate = s.salesposdate ? new Date(s.salesposdate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const simpleDate = s.salesposdate ? new Date(s.salesposdate).toLocaleDateString('id-ID') : '-';
      
      const subtotal = s_details.reduce((acc: number, item: any) => acc + Number(item.subtotal || 0), 0);
      const discount = s_details.reduce((acc: number, item: any) => acc + Number(item.disc || 0) + Number(item.disc2 || 0) + Number(item.disc3 || 0), 0);
      
      return {
        id: s.id,
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
        cashierName: 'Kasir', // Cashier logic could be mapped to cashierid
        cashier_name: 'Kasir',
        paymentMethod: s.paymenttypecode || 'CASH',
        paymentType: s.paymenttypecode || 'CASH',
        payment_method: s.paymenttypecode || 'CASH',
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
        grandTotal: Number(s.grandtotal),
        grand_total: Number(s.grandtotal),
        amountPaid: Number(s.grandtotal),
        amount_paid: Number(s.grandtotal),
        changeAmount: 0,
        change_amount: 0,
        isVoid: Boolean(s.isvoid),
        status: s.isvoid ? 'VOID' : (s.status || 'COMPLETED'),
        items: s_details.map((d: any) => {
          const inv = inventoryMap.get(d.inventoryid);
          return {
            id: d.id,
            productId: d.inventoryid,
            product_id: d.inventoryid,
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

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
