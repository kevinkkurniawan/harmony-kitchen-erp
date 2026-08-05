import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS t_purchase_payment_header (
      id SERIAL PRIMARY KEY,
      payment_no VARCHAR(100) UNIQUE NOT NULL,
      payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      supplier_id INT,
      supplier_name VARCHAR(255),
      payment_method VARCHAR(100) DEFAULT 'Transfer Bank BCA',
      bank_name VARCHAR(100) DEFAULT 'Bank BCA',
      account_no VARCHAR(100) DEFAULT '882-901-2231',
      reference_no VARCHAR(100),
      total_amount NUMERIC(15, 2) DEFAULT 0,
      discount_amount NUMERIC(15, 2) DEFAULT 0,
      grand_total NUMERIC(15, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Paid',
      notes TEXT,
      created_by VARCHAR(100) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS t_purchase_payment_detail (
      id SERIAL PRIMARY KEY,
      header_id INT REFERENCES t_purchase_payment_header(id) ON DELETE CASCADE,
      invoice_no VARCHAR(100),
      invoice_date TIMESTAMP,
      invoice_amount NUMERIC(15, 2) DEFAULT 0,
      paid_previously NUMERIC(15, 2) DEFAULT 0,
      payment_amount NUMERIC(15, 2) DEFAULT 0,
      remaining_balance NUMERIC(15, 2) DEFAULT 0,
      notes TEXT
    );
  `);

  // Seed Purchase Payments if count < 4
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM t_purchase_payment_header;`);
  if (countRes.rows[0].count < 4) {
    const supRes = await pool.query(`SELECT id, supplier_name FROM m_supplier WHERE supplier_name != '-' ORDER BY id ASC LIMIT 10;`);
    const sups = supRes.rows.length > 0 ? supRes.rows : [
      { id: 1, supplier_name: 'PT. Maspion Group Indonesia' },
      { id: 2, supplier_name: 'PT. RKM Kitchenware Industries' },
      { id: 3, supplier_name: 'PT. Paramount Kitchen Solutions' }
    ];

    const seedPayments = [
      {
        payment_no: 'PAY-241101-001',
        supplier_id: sups[0]?.id || 1,
        supplier_name: sups[0]?.supplier_name || 'PT. Maspion Group Indonesia',
        payment_method: 'Transfer Bank BCA',
        bank_name: 'Bank BCA',
        account_no: '882-901-2231',
        reference_no: 'TRF-BCA-998123',
        total_amount: 4750000,
        discount_amount: 50000,
        grand_total: 4700000,
        status: 'Paid',
        notes: 'Pelunasan faktur penerimaan barang tanggal 1 November',
        invoices: [
          { invoice_no: 'INV-MSP-9881', invoice_date: '2024-11-01', invoice_amount: 4750000, paid_prev: 0, pay_amt: 4750000, notes: 'Lunas' }
        ]
      },
      {
        payment_no: 'PAY-241102-002',
        supplier_id: sups[1]?.id || sups[0]?.id || 1,
        supplier_name: sups[1]?.supplier_name || 'PT. RKM Kitchenware Industries',
        payment_method: 'Transfer Bank Mandiri',
        bank_name: 'Bank Mandiri',
        account_no: '142-001-99281',
        reference_no: 'TRF-MND-44129',
        total_amount: 2825000,
        discount_amount: 0,
        grand_total: 2825000,
        status: 'Paid',
        notes: 'Pembayaran termin 1 pengadaan sendok garpu cutlery',
        invoices: [
          { invoice_no: 'INV-RKM-4412', invoice_date: '2024-11-02', invoice_amount: 2825000, paid_prev: 0, pay_amt: 2825000, notes: 'Lunas Termin 1' }
        ]
      },
      {
        payment_no: 'PAY-241103-003',
        supplier_id: sups[2]?.id || sups[0]?.id || 1,
        supplier_name: sups[2]?.supplier_name || 'PT. Paramount Kitchen Solutions',
        payment_method: 'Cash / Kasir',
        bank_name: 'Kas Dapur',
        account_no: '-',
        reference_no: 'CASH-KAS-001',
        total_amount: 1500000,
        discount_amount: 0,
        grand_total: 1500000,
        status: 'Draft',
        notes: 'Draft pembayaran tunai kompor resto',
        invoices: [
          { invoice_no: 'INV-PRM-8819', invoice_date: '2024-11-03', invoice_amount: 5000000, paid_prev: 0, pay_amt: 1500000, notes: 'Pembayaran DP' }
        ]
      }
    ];

    for (const pay of seedPayments) {
      const headerIns = await pool.query(
        `INSERT INTO t_purchase_payment_header (
          payment_no, supplier_id, supplier_name, payment_method, bank_name, account_no, reference_no,
          total_amount, discount_amount, grand_total, status, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Admin')
        ON CONFLICT (payment_no) DO NOTHING
        RETURNING id;`,
        [
          pay.payment_no,
          pay.supplier_id,
          pay.supplier_name,
          pay.payment_method,
          pay.bank_name,
          pay.account_no,
          pay.reference_no,
          pay.total_amount,
          pay.discount_amount,
          pay.grand_total,
          pay.status,
          pay.notes
        ]
      );

      const headerId = headerIns.rows[0]?.id;
      if (headerId) {
        for (const inv of pay.invoices) {
          const remaining = Math.max(0, inv.invoice_amount - inv.paid_prev - inv.pay_amt);
          await pool.query(
            `INSERT INTO t_purchase_payment_detail (
              header_id, invoice_no, invoice_date, invoice_amount, paid_previously, payment_amount, remaining_balance, notes
            ) VALUES ($1, $2, $3::timestamp, $4, $5, $6, $7, $8);`,
            [
              headerId,
              inv.invoice_no,
              inv.invoice_date,
              inv.invoice_amount,
              inv.paid_prev,
              inv.pay_amt,
              remaining,
              inv.notes || ''
            ]
          );
        }
      }
    }
  }
}

export async function GET(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status');
    const mode = searchParams.get('mode'); // 'payments' | 'ap_balances' | 'unpaid_invoices'
    const supplierId = searchParams.get('supplierId');

    if (id) {
      const headerRes = await pool.query(`SELECT * FROM t_purchase_payment_header WHERE id = $1;`, [id]);
      if (headerRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Pembayaran Supplier tidak ditemukan' }, { status: 404 });
      }
      const detailRes = await pool.query(`SELECT * FROM t_purchase_payment_detail WHERE header_id = $1 ORDER BY id ASC;`, [id]);
      return NextResponse.json({
        success: true,
        data: {
          header: headerRes.rows[0],
          items: detailRes.rows
        }
      });
    }

    if (mode === 'ap_balances') {
      // Get AP balance summary per supplier
      const apRes = await pool.query(`
        SELECT 
          s.id AS supplier_id,
          s.supplier_name,
          s.phone1,
          COUNT(h.id)::int AS total_invoices,
          COALESCE(SUM(h.grand_total), 0) AS total_receive_amount,
          COALESCE(
            (
              SELECT SUM(d.payment_amount) 
              FROM t_purchase_payment_detail d 
              JOIN t_purchase_payment_header p ON d.header_id = p.id 
              WHERE p.supplier_id = s.id AND p.status = 'Paid'
            ), 0
          ) AS total_paid_amount
        FROM m_supplier s
        LEFT JOIN t_material_receive_header h ON s.id = h.supplier_id AND h.is_void = FALSE
        WHERE s.supplier_name != '-'
        GROUP BY s.id, s.supplier_name, s.phone1
        ORDER BY s.supplier_name ASC;
      `);

      const balances = apRes.rows.map((row: any) => {
        const apBalance = Math.max(0, Number(row.total_receive_amount) - Number(row.total_paid_amount));
        return {
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name,
          phone1: row.phone1,
          total_invoices: row.total_invoices,
          total_receive_amount: Number(row.total_receive_amount),
          total_paid_amount: Number(row.total_paid_amount),
          ap_balance: apBalance
        };
      });

      return NextResponse.json({ success: true, data: balances });
    }

    if (mode === 'unpaid_invoices' && supplierId) {
      // Fetch unpaid or partially paid material receipts for selected supplier
      const mrRes = await pool.query(`
        SELECT 
          h.id,
          h.mr_no AS invoice_no,
          h.mr_date AS invoice_date,
          h.do_no,
          h.grand_total AS invoice_amount,
          COALESCE(
            (
              SELECT SUM(d.payment_amount) 
              FROM t_purchase_payment_detail d 
              JOIN t_purchase_payment_header p ON d.header_id = p.id 
              WHERE d.invoice_no = h.mr_no AND p.status = 'Paid'
            ), 0
          ) AS paid_previously
        FROM t_material_receive_header h
        WHERE h.supplier_id = $1 AND h.is_void = FALSE
        ORDER BY h.id DESC;
      `, [supplierId]);

      const unpaidList = mrRes.rows.map((row: any) => {
        const remaining = Math.max(0, Number(row.invoice_amount) - Number(row.paid_previously));
        return {
          invoice_no: row.invoice_no,
          invoice_date: row.invoice_date,
          do_no: row.do_no,
          invoice_amount: Number(row.invoice_amount),
          paid_previously: Number(row.paid_previously),
          remaining_balance: remaining,
          payment_amount: remaining
        };
      }).filter((inv: any) => inv.remaining_balance > 0);

      return NextResponse.json({ success: true, data: unpaidList });
    }

    // Default: GET payment history list
    let query = `
      SELECT h.*, 
        COUNT(d.id)::int AS item_count
      FROM t_purchase_payment_header h
      LEFT JOIN t_purchase_payment_detail d ON h.id = d.header_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (h.payment_no ILIKE $${params.length} OR h.supplier_name ILIKE $${params.length} OR h.notes ILIKE $${params.length})`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      query += ` AND h.status = $${params.length}`;
    }

    query += ` GROUP BY h.id ORDER BY h.id DESC;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/payments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const {
      payment_no,
      payment_date,
      supplier_id,
      supplier_name,
      payment_method = 'Transfer Bank BCA',
      bank_name = 'Bank BCA',
      account_no = '',
      reference_no = '',
      discount_amount = 0,
      status = 'Paid',
      notes = '',
      created_by = 'Admin',
      invoices = []
    } = body;

    if (!payment_no || !supplier_name || !invoices || invoices.length === 0) {
      return NextResponse.json({ success: false, error: 'Data pembayaran tidak lengkap / invoice kosong' }, { status: 400 });
    }

    let totalAmount = 0;
    for (const inv of invoices) {
      totalAmount += Number(inv.payment_amount || inv.paymentAmount || 0);
    }

    const grandTotal = Math.max(0, totalAmount - Number(discount_amount));

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const headerRes = await client.query(
        `INSERT INTO t_purchase_payment_header (
          payment_no, payment_date, supplier_id, supplier_name, payment_method, bank_name, account_no, reference_no,
          total_amount, discount_amount, grand_total, status, notes, created_by
        ) VALUES ($1, COALESCE($2::timestamp, NOW()), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id;`,
        [
          payment_no,
          payment_date || null,
          supplier_id || null,
          supplier_name,
          payment_method,
          bank_name,
          account_no,
          reference_no,
          totalAmount,
          discount_amount,
          grandTotal,
          status,
          notes,
          created_by
        ]
      );

      const headerId = headerRes.rows[0].id;

      for (const inv of invoices) {
        const invAmt = Number(inv.invoice_amount || inv.invoiceAmount || 0);
        const paidPrev = Number(inv.paid_previously || inv.paidPreviously || 0);
        const payAmt = Number(inv.payment_amount || inv.paymentAmount || 0);
        const remBal = Math.max(0, invAmt - paidPrev - payAmt);

        await client.query(
          `INSERT INTO t_purchase_payment_detail (
            header_id, invoice_no, invoice_date, invoice_amount, paid_previously, payment_amount, remaining_balance, notes
          ) VALUES ($1, $2, $3::timestamp, $4, $5, $6, $7, $8);`,
          [
            headerId,
            inv.invoice_no || inv.invoiceNo || '',
            inv.invoice_date || inv.invoiceDate || null,
            invAmt,
            paidPrev,
            payAmt,
            remBal,
            inv.notes || ''
          ]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Pembayaran Supplier berhasil disimpan', id: headerId });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/payments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTablesExist();
    const body = await req.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Pembayaran diperlukan' }, { status: 400 });
    }

    if (status) {
      await pool.query(`UPDATE t_purchase_payment_header SET status = $1 WHERE id = $2;`, [status, id]);
    } else {
      await pool.query(`UPDATE t_purchase_payment_header SET notes = $1 WHERE id = $2;`, [notes, id]);
    }

    return NextResponse.json({ success: true, message: 'Status pembayaran berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error in PUT /api/purchasing/payments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Pembayaran diperlukan' }, { status: 400 });
    }

    await pool.query(`UPDATE t_purchase_payment_header SET status = 'Cancelled' WHERE id = $1;`, [id]);
    return NextResponse.json({ success: true, message: 'Pembayaran berhasil dibatalkan' });
  } catch (error: any) {
    console.error('Error in DELETE /api/purchasing/payments:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
