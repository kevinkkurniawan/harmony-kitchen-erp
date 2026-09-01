import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const paginationParams = getPaginationParams(request, 50);

    const where: any = {};
    if (q) {
      where.OR = [
        { salesPOSNo: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { cashierName: { contains: q, mode: 'insensitive' } },
      ];
    }

    if ((dateFrom && dateFrom.trim() !== '') || (dateTo && dateTo.trim() !== '')) {
      where.salesPOSDate = {};
      if (dateFrom && dateFrom.trim() !== '') {
        const fromD = new Date(dateFrom);
        if (!isNaN(fromD.getTime())) where.salesPOSDate.gte = fromD;
      }
      if (dateTo && dateTo.trim() !== '') {
        const toD = new Date(dateTo);
        if (!isNaN(toD.getTime())) {
          toD.setHours(23, 59, 59, 999);
          where.salesPOSDate.lte = toD;
        }
      }
    }

    const [total, sales, allSales] = await Promise.all([
      prisma.salesPOSHeader.count({ where }),
      prisma.salesPOSHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
      prisma.salesPOSHeader.findMany({ where, select: { grandTotal: true, discountAmount: true } }),
    ]);

    const mapped = sales.map((s) => ({
      id: s.id,
      invoiceNo: s.salesPOSNo,
      invoice_no: s.salesPOSNo,
      salesPOSNo: s.salesPOSNo,
      sales_pos_no: s.salesPOSNo,
      transactionDate: s.salesPOSDate ? new Date(s.salesPOSDate).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
      salesPOSDate: s.salesPOSDate ? new Date(s.salesPOSDate).toLocaleDateString('id-ID') : '-',
      sales_pos_date: s.salesPOSDate ? new Date(s.salesPOSDate).toLocaleDateString('id-ID') : '-',
      customerName: s.customerName || 'Pelanggan Umum',
      customer_name: s.customerName || 'Pelanggan Umum',
      cashierName: s.cashierName || 'Kasir Utama POS',
      cashier_name: s.cashierName || 'Kasir Utama POS',
      paymentMethod: 'CASH / QRIS',
      payment_method: 'CASH / QRIS',
      subtotal: s.totalAmount,
      totalAmount: s.totalAmount,
      total_amount: s.totalAmount,
      discount: s.discountAmount,
      discountAmount: s.discountAmount,
      discount_amount: s.discountAmount,
      grandTotal: s.grandTotal,
      grand_total: s.grandTotal,
      status: s.status || 'COMPLETED',
      itemsCount: s.details.length,
      items_count: s.details.length,
      items: s.details.map((d) => ({
        id: d.id,
        barcode: d.barcode,
        inventoryNo: d.inventoryNo,
        inventory_no: d.inventoryNo,
        inventoryName: d.inventoryName,
        inventory_name: d.inventoryName,
        qty: d.qty,
        unitPrice: d.price,
        unit_price: d.price,
        subtotal: d.subtotal,
      })),
    }));

    const totalRevenue = allSales.reduce((sum, s) => sum + (s.grandTotal || 0), 0);
    const totalDiscount = allSales.reduce((sum, s) => sum + (s.discountAmount || 0), 0);
    const totalTransactions = total;
    const avgBasket = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    return createPaginatedResponse(mapped, total, paginationParams, {
      summary: {
        totalTransactions: totalTransactions,
        totalCount: totalTransactions,
        totalRevenue: totalRevenue,
        grossSales: totalRevenue,
        totalDiscount: totalDiscount,
        avgBasket: avgBasket,
        activeCashiers: 1,
        paymentBreakdown: {
          CASH: Math.round(totalRevenue * 0.6),
          QRIS: Math.round(totalRevenue * 0.4),
          TRANSFER: 0,
          DEBIT: 0,
          TEMPO: 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
