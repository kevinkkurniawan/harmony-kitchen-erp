import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m_bank_account (
      id SERIAL PRIMARY KEY,
      bank_code VARCHAR(50) UNIQUE NOT NULL,
      bank_name VARCHAR(100) NOT NULL,
      account_no VARCHAR(100) NOT NULL,
      account_holder VARCHAR(255) NOT NULL,
      branch VARCHAR(100),
      balance NUMERIC(15, 2) DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed bank accounts if count < 4
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_bank_account;`);
  if (countRes.rows[0].count < 4) {
    const seedBanks = [
      {
        bank_code: 'BCA-01',
        bank_name: 'Bank BCA',
        account_no: '8830198888',
        account_holder: 'PT. Harmony Kitchen Indonesia',
        branch: 'Cabang Pemuda Surabaya',
        balance: 145000000.0,
        is_active: true
      },
      {
        bank_code: 'MANDIRI-01',
        bank_name: 'Bank Mandiri',
        account_no: '1420007788990',
        account_holder: 'PT. Harmony Kitchen Indonesia',
        branch: 'Cabang Basuki Rahmat Surabaya',
        balance: 98500000.0,
        is_active: true
      },
      {
        bank_code: 'BRI-01',
        bank_name: 'Bank BRI',
        account_no: '001201002233445',
        account_holder: 'PT. Harmony Kitchen Indonesia',
        branch: 'Cabang Diponegoro Surabaya',
        balance: 52000000.0,
        is_active: true
      },
      {
        bank_code: 'QRIS-01',
        bank_name: 'QRIS Merchant Resto',
        account_no: 'MID-992003881',
        account_holder: 'Harmony Kitchen & Resto',
        branch: 'Merchant QRIS BCA',
        balance: 34250000.0,
        is_active: true
      }
    ];

    for (const b of seedBanks) {
      await pool.query(
        `INSERT INTO m_bank_account (bank_code, bank_name, account_no, account_holder, branch, balance, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (bank_code) DO NOTHING;`,
        [b.bank_code, b.bank_name, b.account_no, b.account_holder, b.branch, b.balance, b.is_active]
      );
    }
  }
}

export async function GET(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    let query = `SELECT * FROM m_bank_account WHERE 1=1`;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (bank_name ILIKE $${params.length} OR bank_code ILIKE $${params.length} OR account_no ILIKE $${params.length} OR account_holder ILIKE $${params.length})`;
    }

    query += ` ORDER BY id ASC;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const {
      bank_code,
      bank_name,
      account_no,
      account_holder,
      branch = 'Surabaya',
      balance = 0,
      is_active = true
    } = body;

    if (!bank_code || !bank_name || !account_no || !account_holder) {
      return NextResponse.json({ success: false, error: 'Kode Bank, Nama Bank, No. Rekening, & A.N Pemilik wajib diisi' }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO m_bank_account (bank_code, bank_name, account_no, account_holder, branch, balance, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
      [bank_code, bank_name, account_no, account_holder, branch, balance, is_active]
    );

    return NextResponse.json({ success: true, message: 'Rekening Bank berhasil ditambahkan', data: res.rows[0] });
  } catch (error: any) {
    console.error('Error in POST /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const { id, bank_code, bank_name, account_no, account_holder, branch, balance, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Bank diperlukan' }, { status: 400 });
    }

    const res = await pool.query(
      `UPDATE m_bank_account SET
        bank_code = COALESCE($1, bank_code),
        bank_name = COALESCE($2, bank_name),
        account_no = COALESCE($3, account_no),
        account_holder = COALESCE($4, account_holder),
        branch = COALESCE($5, branch),
        balance = COALESCE($6, balance),
        is_active = COALESCE($7, is_active)
       WHERE id = $8 RETURNING *;`,
      [bank_code, bank_name, account_no, account_holder, branch, balance, is_active, id]
    );

    return NextResponse.json({ success: true, message: 'Data Rekening Bank berhasil diperbarui', data: res.rows[0] });
  } catch (error: any) {
    console.error('Error in PUT /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Bank diperlukan' }, { status: 400 });
    }

    await pool.query(`DELETE FROM m_bank_account WHERE id = $1;`, [id]);
    return NextResponse.json({ success: true, message: 'Data Rekening Bank berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in DELETE /api/banks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
