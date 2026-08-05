import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m_customer (
      id SERIAL PRIMARY KEY,
      customer_code VARCHAR(50) UNIQUE NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_type VARCHAR(100) DEFAULT 'Reguler',
      phone VARCHAR(50),
      email VARCHAR(100),
      address TEXT,
      special_discount_pct NUMERIC(5, 2) DEFAULT 0,
      credit_limit NUMERIC(15, 2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE m_customer ADD COLUMN IF NOT EXISTS special_discount_pct NUMERIC(5, 2) DEFAULT 0;
    ALTER TABLE m_customer ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15, 2) DEFAULT 0;
  `);

  // Seed customers if count < 4
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_customer;`);
  if (countRes.rows[0].count < 4) {
    const seedCustomers = [
      {
        customer_code: 'CUST-001',
        customer_name: 'Hendra Wijaya (Depot Surabaya)',
        customer_type: 'Restaurant & Hotel Client (B2B)',
        phone: '081299887766',
        email: 'hendra@depotsurabaya.com',
        address: 'Jl. Kertajaya No. 102, Surabaya',
        special_discount_pct: 5,
        credit_limit: 25000000.0,
        is_active: true
      },
      {
        customer_code: 'CUST-002',
        customer_name: 'Ratna Dewi',
        customer_type: 'Member VIP Gold',
        phone: '081822334455',
        email: 'ratna.dewi@gmail.com',
        address: 'Jl. Manyar Kertoarjo No. 44, Surabaya',
        special_discount_pct: 7.5,
        credit_limit: 0,
        is_active: true
      },
      {
        customer_code: 'CUST-003',
        customer_name: 'CV. Sinar Abadi Kitchenware',
        customer_type: 'Wholesale / Toko Grosir',
        phone: '0315348899',
        email: 'procurement@sinarabadi.co.id',
        address: 'Komplek Pergudangan Margomulyo Indah Blok C-12, Surabaya',
        special_discount_pct: 12,
        credit_limit: 150000000.0,
        is_active: true
      },
      {
        customer_code: 'CUST-004',
        customer_name: 'Budi Santoso',
        customer_type: 'Retail Store Customer',
        phone: '085677889900',
        email: 'budi.santoso@yahoo.com',
        address: 'Jl. Ngagel Jaya Selatan No. 18, Surabaya',
        special_discount_pct: 0,
        credit_limit: 0,
        is_active: true
      }
    ];

    for (const c of seedCustomers) {
      await pool.query(
        `INSERT INTO m_customer (customer_code, customer_name, customer_type, phone, email, address, special_discount_pct, credit_limit, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (customer_code) DO NOTHING;`,
        [c.customer_code, c.customer_name, c.customer_type, c.phone, c.email, c.address, c.special_discount_pct, c.credit_limit, c.is_active]
      );
    }
  }
}

export async function GET(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type');

    let query = `SELECT * FROM m_customer WHERE 1=1`;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (customer_name ILIKE $${params.length} OR customer_code ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    if (type && type !== 'ALL') {
      params.push(type);
      query += ` AND customer_type = $${params.length}`;
    }

    query += ` ORDER BY id ASC;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const {
      customer_code,
      customer_name,
      customer_type = 'Reguler',
      phone = '',
      email = '',
      address = '',
      special_discount_pct = 0,
      credit_limit = 0,
      is_active = true
    } = body;

    if (!customer_code || !customer_name) {
      return NextResponse.json({ success: false, error: 'Kode Customer dan Nama Pelanggan wajib diisi' }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO m_customer (customer_code, customer_name, customer_type, phone, email, address, special_discount_pct, credit_limit, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`,
      [customer_code, customer_name, customer_type, phone, email, address, special_discount_pct, credit_limit, is_active]
    );

    return NextResponse.json({ success: true, message: 'Customer berhasil ditambahkan', data: res.rows[0] });
  } catch (error: any) {
    console.error('Error in POST /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const { id, customer_code, customer_name, customer_type, phone, email, address, special_discount_pct, credit_limit, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Customer diperlukan' }, { status: 400 });
    }

    const res = await pool.query(
      `UPDATE m_customer SET
        customer_code = COALESCE($1, customer_code),
        customer_name = COALESCE($2, customer_name),
        customer_type = COALESCE($3, customer_type),
        phone = COALESCE($4, phone),
        email = COALESCE($5, email),
        address = COALESCE($6, address),
        special_discount_pct = COALESCE($7, special_discount_pct),
        credit_limit = COALESCE($8, credit_limit),
        is_active = COALESCE($9, is_active)
       WHERE id = $10 RETURNING *;`,
      [customer_code, customer_name, customer_type, phone, email, address, special_discount_pct, credit_limit, is_active, id]
    );

    return NextResponse.json({ success: true, message: 'Data Customer berhasil diperbarui', data: res.rows[0] });
  } catch (error: any) {
    console.error('Error in PUT /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Customer diperlukan' }, { status: 400 });
    }

    await pool.query(`DELETE FROM m_customer WHERE id = $1;`, [id]);
    return NextResponse.json({ success: true, message: 'Customer berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in DELETE /api/customers:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
