import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m_employee (
      id SERIAL PRIMARY KEY,
      nik VARCHAR(50) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      nickname VARCHAR(100),
      department VARCHAR(100) DEFAULT 'Gudang & Logistik',
      position VARCHAR(100) DEFAULT 'Staf Gudang',
      phone VARCHAR(50),
      email VARCHAR(100),
      address TEXT,
      join_date DATE DEFAULT CURRENT_DATE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed employees if count < 4 or contains legacy restaurant positions
  const checkRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_employee WHERE position LIKE '%Chef%' OR position LIKE '%Kitchen%';`);
  if (checkRes.rows[0].count > 0) {
    await pool.query(`DELETE FROM m_employee;`);
  }

  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_employee;`);
  if (countRes.rows[0].count < 4) {
    const seedEmployees = [
      {
        nik: 'EMP-001',
        full_name: 'Bambang Sudirman',
        nickname: 'Bambang',
        department: 'Management',
        position: 'Store Manager',
        phone: '081234567890',
        email: 'bambang@harmonykitchenware.com',
        address: 'Jl. Raya Darmo No. 12, Surabaya',
        join_date: '2023-01-15',
        is_active: true
      },
      {
        nik: 'EMP-002',
        full_name: 'Rina Kartika',
        nickname: 'Rina',
        department: 'Keuangan & Kasir',
        position: 'Head Cashier & Accounting',
        phone: '081987654321',
        email: 'rina@harmonykitchenware.com',
        address: 'Jl. Pemuda No. 45, Surabaya',
        join_date: '2023-05-20',
        is_active: true
      },
      {
        nik: 'EMP-003',
        full_name: 'Joko Widodo',
        nickname: 'Joko',
        department: 'Gudang & Logistik',
        position: 'Supervisor Gudang & Expedisi',
        phone: '082133445566',
        email: 'joko@harmonykitchenware.com',
        address: 'Jl. Diponegoro No. 88, Surabaya',
        join_date: '2023-08-10',
        is_active: true
      },
      {
        nik: 'EMP-004',
        full_name: 'Siti Aminah',
        nickname: 'Siti',
        department: 'Penjualan (Sales)',
        position: 'Senior Sales Executive B2B',
        phone: '085711223344',
        email: 'siti@harmonykitchenware.com',
        address: 'Jl. Basuki Rahmat No. 30, Surabaya',
        join_date: '2024-02-01',
        is_active: true
      }
    ];

    for (const emp of seedEmployees) {
      await pool.query(
        `INSERT INTO m_employee (nik, full_name, nickname, department, position, phone, email, address, join_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (nik) DO NOTHING;`,
        [emp.nik, emp.full_name, emp.nickname, emp.department, emp.position, emp.phone, emp.email, emp.address, emp.join_date, emp.is_active]
      );
    }
  }
}

export async function GET(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const dept = searchParams.get('dept');

    let query = `SELECT * FROM m_employee WHERE 1=1`;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (full_name ILIKE $${params.length} OR nickname ILIKE $${params.length} OR nik ILIKE $${params.length} OR position ILIKE $${params.length})`;
    }

    if (dept && dept !== 'ALL') {
      params.push(dept);
      query += ` AND department = $${params.length}`;
    }

    query += ` ORDER BY id ASC;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const {
      nik,
      full_name,
      nickname = '',
      department = 'Gudang & Logistik',
      position = 'Staf Gudang',
      phone = '',
      email = '',
      address = '',
      join_date = new Date().toISOString().slice(0, 10),
      is_active = true
    } = body;

    if (!nik || !full_name) {
      return NextResponse.json({ success: false, error: 'NIK dan Nama Lengkap wajib diisi' }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO m_employee (nik, full_name, nickname, department, position, phone, email, address, join_date, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;`,
      [nik, full_name, nickname, department, position, phone, email, address, join_date, is_active]
    );

    return NextResponse.json({ success: true, message: 'Karyawan berhasil ditambahkan', data: res.rows[0] });
  } catch (error: any) {
    console.error('Error in POST /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const { id, nik, full_name, nickname, department, position, phone, email, address, join_date, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Karyawan diperlukan' }, { status: 400 });
    }

    const res = await pool.query(
      `UPDATE m_employee SET
        nik = COALESCE($1, nik),
        full_name = COALESCE($2, full_name),
        nickname = COALESCE($3, nickname),
        department = COALESCE($4, department),
        position = COALESCE($5, position),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        address = COALESCE($8, address),
        join_date = COALESCE($9, join_date),
        is_active = COALESCE($10, is_active)
       WHERE id = $11 RETURNING *;`,
      [nik, full_name, nickname, department, position, phone, email, address, join_date, is_active, id]
    );

    return NextResponse.json({ success: true, message: 'Data Karyawan berhasil diperbarui', data: res.rows[0] });
  } catch (error: any) {
    console.error('Error in PUT /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Karyawan diperlukan' }, { status: 400 });
    }

    await pool.query(`DELETE FROM m_employee WHERE id = $1;`, [id]);
    return NextResponse.json({ success: true, message: 'Karyawan berhasil dihapus' });
  } catch (error: any) {
    console.error('Error in DELETE /api/employees:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
