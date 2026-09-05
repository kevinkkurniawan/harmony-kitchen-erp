import { NextResponse } from 'next/server';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const paginationParams = getPaginationParams(request, 50);

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let paramIndex = 1;

    if (q) {
      conditions.push(`(
        t."invoiceNo" ILIKE $${paramIndex} OR 
        t."cashierName" ILIKE $${paramIndex}
      )`);
      values.push(`%${q}%`);
      paramIndex++;
    }

    if (dateFrom && dateFrom.trim() !== '') {
      const fromD = new Date(dateFrom);
      if (!isNaN(fromD.getTime())) {
        conditions.push(`t."date" >= $${paramIndex}`);
        values.push(fromD);
        paramIndex++;
      }
    }
    
    if (dateTo && dateTo.trim() !== '') {
      const toD = new Date(dateTo);
      if (!isNaN(toD.getTime())) {
        toD.setHours(23, 59, 59, 999);
        conditions.push(`t."date" <= $${paramIndex}`);
        values.push(toD);
        paramIndex++;
      }
    }

    const whereClause = conditions.join(' AND ');

    // Get Total Count
    const countQuery = `SELECT COUNT(*) FROM "Transaction" t WHERE ${whereClause}`;
    const countResult = await posPool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get Transactions
    const query = `
      SELECT t.*
      FROM "Transaction" t
      WHERE ${whereClause}
      ORDER BY t."date" DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const txValues = [...values, paginationParams.limit, paginationParams.skip];
    const txResult = await posPool.query(query, txValues);
    const transactions = txResult.rows;

    // Get Items for these transactions
    let mapped: any[] = [];
    if (transactions.length > 0) {
      const txIds = transactions.map(t => t.id);
      const itemsQuery = `
        SELECT ti.*, p.barcode, p.name as product_name, p.uom as uom_name
        FROM "TransactionItem" ti
        JOIN "Product" p ON ti."productId" = p.id
        WHERE ti."transactionId" = ANY($1)
      `;
      const itemsResult = await posPool.query(itemsQuery, [txIds]);
      const itemsByTx = itemsResult.rows.reduce((acc: any, item: any) => {
        if (!acc[item.transactionId]) acc[item.transactionId] = [];
        acc[item.transactionId].push(item);
        return acc;
      }, {});

      mapped = transactions.map((s) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        invoice_no: s.invoiceNo,
        salesPOSNo: s.invoiceNo,
        sales_pos_no: s.invoiceNo,
        transactionDate: s.date ? new Date(s.date).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
        invoiceDate: s.date ? new Date(s.date).toLocaleDateString('id-ID') : '-',
        salesPOSDate: s.date ? new Date(s.date).toLocaleDateString('id-ID') : '-',
        sales_pos_date: s.date ? new Date(s.date).toLocaleDateString('id-ID') : '-',
        customerName: 'Pelanggan Umum',
        customer_name: 'Pelanggan Umum',
        cashierName: s.cashierName || 'Kasir',
        cashier_name: s.cashierName || 'Kasir',
        paymentMethod: s.paymentMethod || 'Tunai',
        paymentType: s.paymentMethod || 'Tunai',
        payment_method: s.paymentMethod || 'Tunai',
        subtotal: Number(s.subtotal),
        totalAmount: Number(s.subtotal),
        total_amount: Number(s.subtotal),
        discount: Number(s.discountAmount || 0),
        discountAmount: Number(s.discountAmount || 0),
        discValue: Number(s.discountAmount || 0),
        discount_amount: Number(s.discountAmount || 0),
        taxValue: Number(s.taxAmount || 0),
        grandTotal: Number(s.total),
        grand_total: Number(s.total),
        status: 'COMPLETED',
        isVoid: false,
        paymentAmount: Number(s.cashPaid || s.total),
        changeAmount: Number(s.change || 0),
        description: s.notes || '',
        itemsCount: itemsByTx[s.id] ? itemsByTx[s.id].length : 0,
        items_count: itemsByTx[s.id] ? itemsByTx[s.id].length : 0,
        itemCount: itemsByTx[s.id] ? itemsByTx[s.id].length : 0,
        totalQty: itemsByTx[s.id] ? itemsByTx[s.id].reduce((sum: number, it: any) => sum + Number(it.quantity), 0) : 0,
        items: (itemsByTx[s.id] || []).map((d: any) => ({
          id: d.id,
          barcode: d.barcode,
          inventoryNo: d.barcode, // Using barcode as inventoryNo
          inventory_no: d.barcode,
          inventoryName: d.product_name,
          inventory_name: d.product_name,
          uomName: d.uom_name || 'PCS',
          qty: Number(d.quantity),
          price: Number(d.selectedPrice),
          unitPrice: Number(d.selectedPrice),
          unit_price: Number(d.selectedPrice),
          subtotal: Number(d.quantity) * Number(d.selectedPrice),
        })),
      }));
    }

    // Get Summary for All Filtered Sales (Not just paginated)
    const summaryQuery = `
      SELECT 
        SUM(t.total) as "totalRevenue",
        SUM(t."discountAmount") as "totalDiscount",
        SUM(CASE WHEN t."paymentMethod" = 'Tunai' THEN t.total ELSE 0 END) as "cashTotal",
        SUM(CASE WHEN t."paymentMethod" = 'QRIS' THEN t.total ELSE 0 END) as "qrisTotal",
        SUM(CASE WHEN t."paymentMethod" = 'Transfer' THEN t.total ELSE 0 END) as "transferTotal",
        SUM(CASE WHEN t."paymentMethod" = 'Debit' THEN t.total ELSE 0 END) as "debitTotal",
        COUNT(DISTINCT t."cashierName") as "activeCashiers"
      FROM "Transaction" t
      WHERE ${whereClause}
    `;
    const summaryResult = await posPool.query(summaryQuery, values);
    const summaryData = summaryResult.rows[0];

    const totalRevenue = Number(summaryData.totalRevenue || 0);
    const totalDiscount = Number(summaryData.totalDiscount || 0);
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
        activeCashiers: Number(summaryData.activeCashiers || 1),
        paymentBreakdown: {
          CASH: Number(summaryData.cashTotal || 0),
          QRIS: Number(summaryData.qrisTotal || 0),
          TRANSFER: Number(summaryData.transferTotal || 0),
          DEBIT: Number(summaryData.debitTotal || 0),
          TEMPO: 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/sales/monitoring:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
