import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function initSalesTablesAndSeed() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.t_pos_order_header (
        id SERIAL PRIMARY KEY,
        order_no VARCHAR(50) UNIQUE NOT NULL,
        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        table_no VARCHAR(20) DEFAULT 'Takeaway',
        customer_name VARCHAR(100) DEFAULT 'Pelanggan POS',
        sub_total NUMERIC(15, 2) DEFAULT 0,
        discount NUMERIC(15, 2) DEFAULT 0,
        tax NUMERIC(15, 2) DEFAULT 0,
        grand_total NUMERIC(15, 2) DEFAULT 0,
        payment_method VARCHAR(50) DEFAULT 'Cash',
        payment_status VARCHAR(20) DEFAULT 'Paid',
        total_items INT DEFAULT 1,
        created_by VARCHAR(100) DEFAULT 'Kasir 1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.t_pos_order_detail (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES public.t_pos_order_header(id) ON DELETE CASCADE,
        order_no VARCHAR(50) NOT NULL,
        inventory_id INT,
        barcode VARCHAR(100),
        inventory_name VARCHAR(255),
        qty INT NOT NULL DEFAULT 1,
        unit_price NUMERIC(15, 2) DEFAULT 0,
        cost_price NUMERIC(15, 2) DEFAULT 0,
        sub_total NUMERIC(15, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if table has seed data
    const countRes = await pool.query(`SELECT COUNT(*) FROM public.t_pos_order_header`);
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      // Seed sample sales transactions for current month and past days
      const sampleOrders = [
        {
          orderNo: 'POS/2026/08/0001',
          date: '2026-08-01 10:15:00',
          customer: 'Ahmad Budi',
          subTotal: 145000,
          discount: 0,
          grandTotal: 145000,
          method: 'Cash',
          items: [
            { invId: 1, barcode: '8991234567890', name: 'Beras Ramos 5kg', qty: 2, price: 65000, cost: 55000 },
            { invId: 3, barcode: '8991234567892', name: 'Gula Pasir Gulaku 1kg', qty: 1, price: 15000, cost: 12000 },
          ],
        },
        {
          orderNo: 'POS/2026/08/0002',
          date: '2026-08-01 14:30:00',
          customer: 'Siti Rahma',
          subTotal: 68000,
          discount: 5000,
          grandTotal: 63000,
          method: 'QRIS',
          items: [
            { invId: 2, barcode: '8991234567891', name: 'Minyak Goreng Sania 2L', qty: 2, price: 34000, cost: 28000 },
          ],
        },
        {
          orderNo: 'POS/2026/08/0003',
          date: '2026-08-02 11:20:00',
          customer: 'Resto Dapur Mama',
          subTotal: 325000,
          discount: 15000,
          grandTotal: 310000,
          method: 'Transfer',
          items: [
            { invId: 1, barcode: '8991234567890', name: 'Beras Ramos 5kg', qty: 5, price: 65000, cost: 55000 },
          ],
        },
        {
          orderNo: 'POS/2026/08/0004',
          date: '2026-08-03 09:45:00',
          customer: 'Dewi Lestari',
          subTotal: 98000,
          discount: 0,
          grandTotal: 98000,
          method: 'Cash',
          items: [
            { invId: 2, barcode: '8991234567891', name: 'Minyak Goreng Sania 2L', qty: 2, price: 34000, cost: 28000 },
            { invId: 3, barcode: '8991234567892', name: 'Gula Pasir Gulaku 1kg', qty: 2, price: 15000, cost: 12000 },
          ],
        },
        {
          orderNo: 'POS/2026/08/0005',
          date: '2026-08-04 16:10:00',
          customer: 'Hendra Wijaya',
          subTotal: 195000,
          discount: 10000,
          grandTotal: 185000,
          method: 'Card',
          items: [
            { invId: 1, barcode: '8991234567890', name: 'Beras Ramos 5kg', qty: 3, price: 65000, cost: 55000 },
          ],
        },
        {
          orderNo: 'POS/2026/08/0006',
          date: '2026-08-05 12:00:00',
          customer: 'Pelanggan Umum',
          subTotal: 147000,
          discount: 7000,
          grandTotal: 140000,
          method: 'QRIS',
          items: [
            { invId: 2, barcode: '8991234567891', name: 'Minyak Goreng Sania 2L', qty: 3, price: 34000, cost: 28000 },
            { invId: 3, barcode: '8991234567892', name: 'Gula Pasir Gulaku 1kg', qty: 3, price: 15000, cost: 12000 },
          ],
        },
      ];

      for (const ord of sampleOrders) {
        const totalItems = ord.items.reduce((sum, item) => sum + item.qty, 0);
        const headRes = await pool.query(`
          INSERT INTO public.t_pos_order_header (
            order_no, order_date, customer_name, sub_total, discount, grand_total, payment_method, total_items, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Kasir 1')
          RETURNING id;
        `, [
          ord.orderNo,
          ord.date,
          ord.customer,
          ord.subTotal,
          ord.discount,
          ord.grandTotal,
          ord.method,
          totalItems,
        ]);

        const orderId = headRes.rows[0].id;

        for (const item of ord.items) {
          const itemSubTotal = item.qty * item.price;
          await pool.query(`
            INSERT INTO public.t_pos_order_detail (
              order_id, order_no, inventory_id, barcode, inventory_name, qty, unit_price, cost_price, sub_total
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
          `, [
            orderId,
            ord.orderNo,
            item.invId,
            item.barcode,
            item.name,
            item.qty,
            item.price,
            item.cost,
            itemSubTotal,
          ]);
        }
      }
    }
  } catch (err) {
    console.error('Error initializing sales tables/seed:', err);
  }
}

export async function GET(request: Request) {
  try {
    await initSalesTablesAndSeed();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'daily'; // 'daily' | 'monthly' | 'items' | 'summary'
    const paymentMethod = searchParams.get('paymentMethod');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let methodFilter = '';
    const queryParams: any[] = [];

    if (paymentMethod && paymentMethod !== 'All') {
      queryParams.push(paymentMethod);
      methodFilter = ` AND h.payment_method = $${queryParams.length} `;
    }

    if (type === 'daily') {
      // 1. Daily Sales Report (Laporan Penjualan Harian)
      const dailyRes = await pool.query(`
        SELECT 
          TO_CHAR(h.order_date, 'YYYY-MM-DD') AS "date",
          COUNT(h.id)::int AS "totalOrders",
          SUM(h.total_items)::int AS "totalItems",
          SUM(h.sub_total)::numeric AS "grossSales",
          SUM(h.discount)::numeric AS "totalDiscount",
          SUM(h.grand_total)::numeric AS "netSales",
          SUM(CASE WHEN h.payment_method = 'Cash' THEN h.grand_total ELSE 0 END)::numeric AS "cashSales",
          SUM(CASE WHEN h.payment_method = 'QRIS' THEN h.grand_total ELSE 0 END)::numeric AS "qrisSales",
          SUM(CASE WHEN h.payment_method = 'Transfer' THEN h.grand_total ELSE 0 END)::numeric AS "transferSales",
          SUM(CASE WHEN h.payment_method = 'Card' THEN h.grand_total ELSE 0 END)::numeric AS "cardSales"
        FROM public.t_pos_order_header h
        WHERE 1=1 ${methodFilter}
        GROUP BY TO_CHAR(h.order_date, 'YYYY-MM-DD')
        ORDER BY "date" DESC;
      `, queryParams);

      return NextResponse.json({ success: true, type: 'daily', data: dailyRes.rows });
    }

    if (type === 'monthly') {
      // 2. Monthly Sales Report (Laporan Penjualan Bulanan)
      const monthlyRes = await pool.query(`
        SELECT 
          TO_CHAR(h.order_date, 'YYYY-MM') AS "month",
          COUNT(h.id)::int AS "totalOrders",
          SUM(h.total_items)::int AS "totalItems",
          SUM(h.sub_total)::numeric AS "grossSales",
          SUM(h.discount)::numeric AS "totalDiscount",
          SUM(h.grand_total)::numeric AS "netSales",
          SUM(CASE WHEN h.payment_method = 'Cash' THEN h.grand_total ELSE 0 END)::numeric AS "cashSales",
          SUM(CASE WHEN h.payment_method = 'QRIS' THEN h.grand_total ELSE 0 END)::numeric AS "qrisSales",
          SUM(CASE WHEN h.payment_method = 'Transfer' THEN h.grand_total ELSE 0 END)::numeric AS "transferSales",
          SUM(CASE WHEN h.payment_method = 'Card' THEN h.grand_total ELSE 0 END)::numeric AS "cardSales"
        FROM public.t_pos_order_header h
        WHERE 1=1 ${methodFilter}
        GROUP BY TO_CHAR(h.order_date, 'YYYY-MM')
        ORDER BY "month" DESC;
      `, queryParams);

      return NextResponse.json({ success: true, type: 'monthly', data: monthlyRes.rows });
    }

    if (type === 'items') {
      // 3. Item Sales Report (Laporan Penjualan Per Barang)
      const itemRes = await pool.query(`
        SELECT 
          d.barcode,
          d.inventory_name AS "inventoryName",
          SUM(d.qty)::int AS "totalQtySold",
          AVG(d.unit_price)::numeric AS "avgUnitPrice",
          SUM(d.sub_total)::numeric AS "totalRevenue",
          SUM(d.qty * d.cost_price)::numeric AS "totalCost",
          SUM(d.sub_total - (d.qty * d.cost_price))::numeric AS "profit"
        FROM public.t_pos_order_detail d
        JOIN public.t_pos_order_header h ON d.order_id = h.id
        WHERE 1=1 ${methodFilter}
        GROUP BY d.barcode, d.inventory_name
        ORDER BY "totalRevenue" DESC;
      `, queryParams);

      return NextResponse.json({ success: true, type: 'items', data: itemRes.rows });
    }

    if (type === 'summary') {
      // 4. Sales Summary & Financials Report (Summary Penjualan & Profit)
      const summaryRes = await pool.query(`
        SELECT 
          COUNT(h.id)::int AS "totalOrders",
          COALESCE(SUM(h.total_items), 0)::int AS "totalItemsSold",
          COALESCE(SUM(h.sub_total), 0)::numeric AS "grossSales",
          COALESCE(SUM(h.discount), 0)::numeric AS "totalDiscount",
          COALESCE(SUM(h.grand_total), 0)::numeric AS "netSales",
          COALESCE(SUM(CASE WHEN h.payment_method = 'Cash' THEN h.grand_total ELSE 0 END), 0)::numeric AS "cashSales",
          COALESCE(SUM(CASE WHEN h.payment_method = 'QRIS' THEN h.grand_total ELSE 0 END), 0)::numeric AS "qrisSales",
          COALESCE(SUM(CASE WHEN h.payment_method = 'Transfer' THEN h.grand_total ELSE 0 END), 0)::numeric AS "transferSales",
          COALESCE(SUM(CASE WHEN h.payment_method = 'Card' THEN h.grand_total ELSE 0 END), 0)::numeric AS "cardSales"
        FROM public.t_pos_order_header h
        WHERE 1=1 ${methodFilter};
      `, queryParams);

      const costRes = await pool.query(`
        SELECT 
          COALESCE(SUM(d.qty * d.cost_price), 0)::numeric AS "totalCost"
        FROM public.t_pos_order_detail d
        JOIN public.t_pos_order_header h ON d.order_id = h.id
        WHERE 1=1 ${methodFilter};
      `, queryParams);

      const summaryData = summaryRes.rows[0] || {};
      const totalCost = parseFloat(costRes.rows[0]?.totalCost || '0');
      const netSales = parseFloat(summaryData.netSales || '0');
      const profit = netSales - totalCost;
      const profitMarginPct = netSales > 0 ? (profit / netSales) * 100 : 0;

      return NextResponse.json({
        success: true,
        type: 'summary',
        data: {
          ...summaryData,
          totalCost,
          profit,
          profitMarginPct: Math.round(profitMarginPct * 10) / 10,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error fetching sales report data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
