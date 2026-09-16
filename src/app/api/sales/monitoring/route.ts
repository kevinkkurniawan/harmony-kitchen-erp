import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {};
    if (q) {
      where.OR = [
        { salesPOSNo: { contains: q, mode: 'insensitive' as const } },
        { customerName: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    if (dateFrom || dateTo) {
      where.salesPOSDate = {};
      if (dateFrom) where.salesPOSDate.gte = new Date(dateFrom);
      if (dateTo) {
        const toD = new Date(dateTo);
        toD.setHours(23, 59, 59, 999);
        where.salesPOSDate.lte = toD;
      }
    }

    const [total, transactions] = await Promise.all([
      prisma.salesPOSHeader.count({ where }),
      prisma.salesPOSHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = transactions.map((s: any) => {
      const txDate = s.salesPOSDate ? new Date(s.salesPOSDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
      const simpleDate = s.salesPOSDate ? new Date(s.salesPOSDate).toLocaleDateString('id-ID') : '-';
      
      return {
        id: s.id,
        invoiceNo: s.salesPOSNo,
        invoice_no: s.salesPOSNo,
        salesPOSNo: s.salesPOSNo,
        sales_pos_no: s.salesPOSNo,
        transactionDate: txDate,
        invoiceDate: simpleDate,
        salesPOSDate: simpleDate,
        sales_pos_date: simpleDate,
        customerName: s.customerName || 'Pelanggan Umum',
        customer_name: s.customerName || 'Pelanggan Umum',
        cashierName: s.cashierName || 'Kasir',
        cashier_name: s.cashierName || 'Kasir',
        paymentMethod: s.paymentMethod || 'Tunai',
        paymentType: s.paymentMethod || 'Tunai',
        payment_method: s.paymentMethod || 'Tunai',
        subtotal: Number(s.totalAmount || 0),
        totalAmount: Number(s.totalAmount || 0),
        total_amount: Number(s.totalAmount || 0),
        discount: Number(s.discountAmount || 0),
        discountAmount: Number(s.discountAmount || 0),
        discValue: Number(s.discountAmount || 0),
        discount_amount: Number(s.discountAmount || 0),
        tax: Number(s.taxAmount || 0),
        taxAmount: Number(s.taxAmount || 0),
        tax_amount: Number(s.taxAmount || 0),
        grandTotal: Number(s.grandTotal || 0),
        grand_total: Number(s.grandTotal || 0),
        amountPaid: Number(s.cashPaid || s.grandTotal || 0),
        amount_paid: Number(s.cashPaid || s.grandTotal || 0),
        changeAmount: Number(s.changeAmount || 0),
        change_amount: Number(s.changeAmount || 0),
        status: s.status || 'COMPLETED',
        items: (s.details || []).map((d: any) => ({
          id: d.id,
          productId: d.barcode,
          product_id: d.barcode,
          barcode: d.barcode,
          productName: d.inventoryName,
          product_name: d.inventoryName,
          uomName: d.uomName || 'Pcs',
          uom_name: d.uomName || 'Pcs',
          qty: Number(d.qty),
          unitPrice: Number(d.price),
          unit_price: Number(d.price),
          subtotal: Number(d.subtotal),
          discount: 0,
        })),
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

