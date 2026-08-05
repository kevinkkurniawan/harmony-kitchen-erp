import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS t_sales_pos_header (
      id SERIAL PRIMARY KEY,
      invoice_no VARCHAR(100) NOT NULL UNIQUE,
      invoice_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      cashier_name VARCHAR(100) DEFAULT 'Kasir Dapur 01',
      customer_name VARCHAR(100) DEFAULT 'Pelanggan Umum',
      payment_type VARCHAR(50) NOT NULL DEFAULT 'CASH',
      bank_name VARCHAR(100) DEFAULT '-',
      subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
      disc_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
      tax_value NUMERIC(15, 2) NOT NULL DEFAULT 0,
      grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
      payment_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
      change_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
      is_void BOOLEAN DEFAULT FALSE,
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS t_sales_pos_detail (
      id SERIAL PRIMARY KEY,
      header_id INT REFERENCES t_sales_pos_header(id) ON DELETE CASCADE,
      inventory_id INT REFERENCES m_inventory(id),
      inventory_no VARCHAR(100),
      inventory_name VARCHAR(255),
      uom_name VARCHAR(50),
      qty INT NOT NULL DEFAULT 1,
      price NUMERIC(15, 2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0
    );
  `);
}

async function autoSeedPosTransactions() {
  const checkRes = await pool.query('SELECT COUNT(*) FROM t_sales_pos_header;');
  if (parseInt(checkRes.rows[0].count) > 0) return;

  console.log('Seeding 10 POS Sales Transactions into PostgreSQL...');

  const sampleTransactions = [
    {
      invoiceNo: 'POS-241110',
      date: '2026-08-05 12:45:00',
      cashier: 'Budi (Kasir 1)',
      customer: 'Meja 04 (Bpk. Agus)',
      paymentType: 'QRIS',
      bankName: 'GoPay / QRIS',
      subtotal: 185000,
      discValue: 15000,
      taxValue: 18700,
      grandTotal: 188700,
      paymentAmount: 188700,
      changeAmount: 0,
      items: [
        { no: 'MSP-KW-01', name: 'Nasi Goreng Spesial Dapur', uom: 'PORSI', qty: 2, price: 35000 },
        { no: 'MSP-KW-02', name: 'Ayam Goreng Lengkuas', uom: 'PORSI', qty: 2, price: 40000 },
        { no: 'MSP-KW-03', name: 'Es Teh Manis Jumbo', uom: 'GELAS', qty: 4, price: 8750 },
      ],
    },
    {
      invoiceNo: 'POS-241109',
      date: '2026-08-05 12:15:00',
      cashier: 'Siti (Kasir 2)',
      customer: 'Takeaway GoFood',
      paymentType: 'TRANSFER',
      bankName: 'BCA Virtual Account',
      subtotal: 240000,
      discValue: 20000,
      taxValue: 24200,
      grandTotal: 244200,
      paymentAmount: 244200,
      changeAmount: 0,
      items: [
        { no: 'MSP-KW-04', name: 'Bebek Goreng Madura', uom: 'PORSI', qty: 3, price: 55000 },
        { no: 'MSP-KW-05', name: 'Soto Ayam Lamongan', uom: 'PORSI', qty: 2, price: 37500 },
      ],
    },
    {
      invoiceNo: 'POS-241108',
      date: '2026-08-05 11:30:00',
      cashier: 'Budi (Kasir 1)',
      customer: 'Meja 12 (Ibu Dewi)',
      paymentType: 'CASH',
      bankName: 'Tunai Kasir',
      subtotal: 95000,
      discValue: 0,
      taxValue: 10450,
      grandTotal: 105450,
      paymentAmount: 150000,
      changeAmount: 44550,
      items: [
        { no: 'MSP-KW-06', name: 'Kwetiau Sapi Goreng', uom: 'PORSI', qty: 2, price: 38000 },
        { no: 'MSP-KW-07', name: 'Es Jeruk Peras', uom: 'GELAS', qty: 2, price: 9500 },
      ],
    },
    {
      invoiceNo: 'POS-241107',
      date: '2026-08-05 10:40:00',
      cashier: 'Siti (Kasir 2)',
      customer: 'Meja 02 (Bpk. Rian)',
      paymentType: 'DEBIT',
      bankName: 'Mandiri EDC',
      subtotal: 310000,
      discValue: 30000,
      taxValue: 30800,
      grandTotal: 310800,
      paymentAmount: 310800,
      changeAmount: 0,
      items: [
        { no: 'MSP-KW-08', name: 'Steak Sapi Ribeye 200g', uom: 'PORSI', qty: 2, price: 125000 },
        { no: 'MSP-KW-09', name: 'Sup Buntut Sapi', uom: 'PORSI', qty: 1, price: 60000 },
      ],
    },
    {
      invoiceNo: 'POS-241106',
      date: '2026-08-04 19:20:00',
      cashier: 'Budi (Kasir 1)',
      customer: 'Catering Kantor PT Maju',
      paymentType: 'TEMPO',
      bankName: 'Invoice Corporate 30 Hari',
      subtotal: 1250000,
      discValue: 100000,
      taxValue: 126500,
      grandTotal: 1276500,
      paymentAmount: 0,
      changeAmount: 0,
      items: [
        { no: 'MSP-KW-01', name: 'Nasi Kotak Ayam Lengkuas', uom: 'BOX', qty: 25, price: 35000 },
        { no: 'MSP-KW-03', name: 'Air Mineral Botol 600ml', uom: 'BOTOL', qty: 25, price: 15000 },
      ],
    },
    {
      invoiceNo: 'POS-241105',
      date: '2026-08-04 18:10:00',
      cashier: 'Siti (Kasir 2)',
      customer: 'Meja 08',
      paymentType: 'QRIS',
      bankName: 'OVO / QRIS',
      subtotal: 145000,
      discValue: 10000,
      taxValue: 14850,
      grandTotal: 149850,
      paymentAmount: 149850,
      changeAmount: 0,
      items: [
        { no: 'MSP-KW-02', name: 'Mie Goreng Seafood', uom: 'PORSI', qty: 3, price: 40000 },
        { no: 'MSP-KW-07', name: 'Es Teh Manis Jumbo', uom: 'GELAS', qty: 3, price: 8333 },
      ],
    },
    {
      invoiceNo: 'POS-241104',
      date: '2026-08-04 14:00:00',
      cashier: 'Budi (Kasir 1)',
      customer: 'Meja 01',
      paymentType: 'CASH',
      bankName: 'Tunai Kasir',
      subtotal: 78000,
      discValue: 0,
      taxValue: 8580,
      grandTotal: 86580,
      paymentAmount: 100000,
      changeAmount: 13420,
      items: [
        { no: 'MSP-KW-05', name: 'Nasi Capcay Kuah', uom: 'PORSI', qty: 2, price: 32000 },
        { no: 'MSP-KW-03', name: 'Es Alpukat Kocok', uom: 'GELAS', qty: 1, price: 14000 },
      ],
    },
    {
      invoiceNo: 'POS-241103',
      date: '2026-08-04 12:30:00',
      cashier: 'Siti (Kasir 2)',
      customer: 'Meja 05',
      paymentType: 'TRANSFER',
      bankName: 'Bank Jatim Transfer',
      subtotal: 420000,
      discValue: 40000,
      taxValue: 41800,
      grandTotal: 421800,
      paymentAmount: 421800,
      changeAmount: 0,
      items: [
        { no: 'MSP-KW-08', name: 'Gurami Bakar Jimbaran', uom: 'PORSI', qty: 3, price: 110000 },
        { no: 'MSP-KW-01', name: 'Nasi Putih Bakul', uom: 'BAKUL', qty: 3, price: 30000 },
      ],
    },
    {
      invoiceNo: 'POS-241102',
      date: '2026-08-03 19:45:00',
      cashier: 'Budi (Kasir 1)',
      customer: 'Meja 10',
      paymentType: 'CASH',
      bankName: 'Tunai Kasir',
      subtotal: 160000,
      discValue: 10000,
      taxValue: 16500,
      grandTotal: 166500,
      paymentAmount: 200000,
      changeAmount: 33500,
      items: [
        { no: 'MSP-KW-04', name: 'Soto Betawi Daging', uom: 'PORSI', qty: 3, price: 45000 },
        { no: 'MSP-KW-07', name: 'Es Cincau Hijau', uom: 'GELAS', qty: 3, price: 8333 },
      ],
    },
    {
      invoiceNo: 'POS-241101',
      date: '2026-08-03 13:15:00',
      cashier: 'Siti (Kasir 2)',
      customer: 'Meja 03',
      paymentType: 'QRIS',
      bankName: 'ShopeePay / QRIS',
      subtotal: 92000,
      discValue: 5000,
      taxValue: 9570,
      grandTotal: 96570,
      paymentAmount: 96570,
      changeAmount: 0,
      items: [
        { no: 'MSP-KW-02', name: 'Fettuccine Carbonara', uom: 'PORSI', qty: 2, price: 41000 },
        { no: 'MSP-KW-03', name: 'Ice Lemon Tea', uom: 'GELAS', qty: 2, price: 5000 },
      ],
    }
  ];

  for (const t of sampleTransactions) {
    const headerRes = await pool.query(`
      INSERT INTO t_sales_pos_header (
        invoice_no, invoice_date, cashier_name, customer_name, payment_type, bank_name,
        subtotal, disc_value, tax_value, grand_total, payment_amount, change_amount, is_void
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE)
      RETURNING id;
    `, [
      t.invoiceNo,
      t.date,
      t.cashier,
      t.customer,
      t.paymentType,
      t.bankName,
      t.subtotal,
      t.discValue,
      t.taxValue,
      t.grandTotal,
      t.paymentAmount,
      t.changeAmount,
    ]);

    const headerId = headerRes.rows[0].id;
    for (const item of t.items) {
      await pool.query(`
        INSERT INTO t_sales_pos_detail (
          header_id, inventory_no, inventory_name, uom_name, qty, price, subtotal
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [headerId, item.no, item.name, item.uom, item.qty, item.price, item.qty * item.price]);
    }
  }

  console.log('Seeding 10 POS Sales Transactions Completed!');
}

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    await autoSeedPosTransactions();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    let whereClause = 'WHERE 1=1';
    const values: string[] = [];
    let paramIdx = 1;

    if (q) {
      whereClause += ` AND (h.invoice_no ILIKE $${paramIdx} OR h.cashier_name ILIKE $${paramIdx} OR h.customer_name ILIKE $${paramIdx} OR h.payment_type ILIKE $${paramIdx})`;
      values.push(`%${q}%`);
      paramIdx++;
    }

    if (dateFrom) {
      whereClause += ` AND h.invoice_date >= $${paramIdx}::timestamp`;
      values.push(`${dateFrom} 00:00:00`);
      paramIdx++;
    }

    if (dateTo) {
      whereClause += ` AND h.invoice_date <= $${paramIdx}::timestamp`;
      values.push(`${dateTo} 23:59:59`);
      paramIdx++;
    }

    // Fetch Transactions List
    const listQuery = `
      SELECT 
        h.id::text AS id,
        h.invoice_no AS "invoiceNo",
        TO_CHAR(h.invoice_date, 'YYYY-MM-DD HH24:MI:SS') AS "invoiceDate",
        h.cashier_name AS "cashierName",
        h.customer_name AS "customerName",
        h.payment_type AS "paymentType",
        h.bank_name AS "bankName",
        h.subtotal::float,
        h.disc_value AS "discValue",
        h.tax_value AS "taxValue",
        h.grand_total AS "grandTotal",
        h.payment_amount AS "paymentAmount",
        h.change_amount AS "changeAmount",
        h.is_void AS "isVoid",
        h.description,
        COUNT(d.id)::int AS "itemCount",
        COALESCE(SUM(d.qty), 0)::int AS "totalQty"
      FROM t_sales_pos_header h
      LEFT JOIN t_sales_pos_detail d ON h.id = d.header_id
      ${whereClause}
      GROUP BY h.id
      ORDER BY h.id DESC;
    `;

    const listRes = await pool.query(listQuery, values);

    // Calculate Summary Metrics
    const validRows = listRes.rows.filter((r) => !r.isVoid);
    const grossSales = validRows.reduce((acc, r) => acc + parseFloat(r.grandTotal || 0), 0);
    const totalCount = validRows.length;
    const avgBasket = totalCount > 0 ? Math.round(grossSales / totalCount) : 0;

    // Payment Method Distribution
    const paymentBreakdown = {
      CASH: validRows.filter((r) => r.paymentType === 'CASH').reduce((acc, r) => acc + parseFloat(r.grandTotal || 0), 0),
      QRIS: validRows.filter((r) => r.paymentType === 'QRIS').reduce((acc, r) => acc + parseFloat(r.grandTotal || 0), 0),
      TRANSFER: validRows.filter((r) => r.paymentType === 'TRANSFER').reduce((acc, r) => acc + parseFloat(r.grandTotal || 0), 0),
      DEBIT: validRows.filter((r) => r.paymentType === 'DEBIT').reduce((acc, r) => acc + parseFloat(r.grandTotal || 0), 0),
      TEMPO: validRows.filter((r) => r.paymentType === 'TEMPO').reduce((acc, r) => acc + parseFloat(r.grandTotal || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: listRes.rows,
      summary: {
        grossSales,
        totalCount,
        avgBasket,
        paymentBreakdown,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
