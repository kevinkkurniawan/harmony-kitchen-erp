import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m_position (
      id SERIAL PRIMARY KEY,
      position_no VARCHAR(50) UNIQUE NOT NULL,
      position_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS m_employee (
      id SERIAL PRIMARY KEY,
      employee_no VARCHAR(50) UNIQUE NOT NULL,
      employee_name VARCHAR(255) NOT NULL,
      position_id INT REFERENCES m_position(id) ON DELETE SET NULL,
      position_name VARCHAR(100) DEFAULT 'Staff',
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE m_employee ADD COLUMN IF NOT EXISTS employee_no VARCHAR(50);
    ALTER TABLE m_employee ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255);
    ALTER TABLE m_employee ADD COLUMN IF NOT EXISTS position_id INT;
    ALTER TABLE m_employee ADD COLUMN IF NOT EXISTS position_name VARCHAR(100);
    ALTER TABLE m_employee ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE m_employee ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

    UPDATE m_employee SET employee_no = COALESCE(employee_no, 'EM-0000' || id) WHERE employee_no IS NULL;
    UPDATE m_employee SET employee_name = COALESCE(employee_name, 'Employee ' || id) WHERE employee_name IS NULL;
  `);

  // Seed positions if count < 4
  const posCount = await pool.query(`SELECT COUNT(*)::int AS count FROM m_position;`);
  if (posCount.rows[0].count < 4) {
    const seedPositions = [
      { position_no: 'POS-001', position_name: 'Manager', description: 'Manager Operasional Perusahaan' },
      { position_no: 'POS-002', position_name: 'Supervisor', description: 'Supervisor Resto & Toko' },
      { position_no: 'POS-003', position_name: 'Cashier', description: 'Kasir Toko & Pembayaran' },
      { position_no: 'POS-004', position_name: 'Staff', description: 'Staf Operasional' }
    ];

    for (const p of seedPositions) {
      await pool.query(
        `INSERT INTO m_position (position_no, position_name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (position_no) DO NOTHING;`,
        [p.position_no, p.position_name, p.description]
      );
    }
  }

  // Seed employees if count < 4
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_employee WHERE employee_no IS NOT NULL;`);
  if (countRes.rows[0].count < 4) {
    const posRes = await pool.query(`SELECT id, position_name FROM m_position ORDER BY id ASC;`);
    const positions = posRes.rows;

    const seedEmployees = [
      {
        employee_no: 'EM-00001',
        employee_name: 'Bambang Sudirman',
        position_id: positions[0]?.id || 1,
        position_name: positions[0]?.position_name || 'Manager',
        description: 'Penanggung jawab operasional cabang',
        is_active: true
      },
      {
        employee_no: 'EM-00002',
        employee_name: 'Rina Kartika',
        position_id: positions[2]?.id || 3,
        position_name: positions[2]?.position_name || 'Cashier',
        description: 'Kasir utama toko',
        is_active: true
      },
      {
        employee_no: 'EM-00003',
        employee_name: 'Joko Widodo',
        position_id: positions[1]?.id || 2,
        position_name: positions[1]?.position_name || 'Supervisor',
        description: 'Supervisor persediaan gudang',
        is_active: true
      },
      {
        employee_no: 'EM-00004',
        employee_name: 'Siti Aminah',
        position_id: positions[3]?.id || 4,
        position_name: positions[3]?.position_name || 'Staff',
        description: 'Staf pelayanan customer',
        is_active: true
      }
    ];

    for (const emp of seedEmployees) {
      await pool.query(
        `INSERT INTO m_employee (employee_no, employee_name, position_id, position_name, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (employee_no) DO UPDATE SET
            employee_name = EXCLUDED.employee_name,
            position_id = EXCLUDED.position_id,
            position_name = EXCLUDED.position_name,
            description = EXCLUDED.description;`,
        [emp.employee_no, emp.employee_name, emp.position_id, emp.position_name, emp.description, emp.is_active]
      );
    }
  }
}

export async function GET(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    let query = `
      SELECT e.id, 
             COALESCE(e.employee_no, 'EM-' || e.id) AS employee_no, 
             COALESCE(e.employee_name, 'Employee ' || e.id) AS employee_name, 
             e.position_id, 
             COALESCE(p.position_name, e.position_name, 'Staff') AS position_name, 
             COALESCE(e.description, '') AS description, 
             COALESCE(e.is_active, true) AS is_active, 
             e.created_at
      FROM m_employee e
      LEFT JOIN m_position p ON e.position_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (COALESCE(e.employee_name, '') ILIKE $${params.length} OR COALESCE(e.employee_no, '') ILIKE $${params.length} OR COALESCE(p.position_name, e.position_name, '') ILIKE $${params.length} OR COALESCE(e.description, '') ILIKE $${params.length})`;
    }

    query += ` ORDER BY e.id ASC;`;

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
      employee_no,
      employee_name,
      position_id,
      position_name = 'Staff',
      description = '',
      is_active = true
    } = body;

    if (!employee_no || !employee_name) {
      return NextResponse.json({ success: false, error: 'Kode / No. Karyawan dan Nama Karyawan wajib diisi' }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO m_employee (employee_no, employee_name, position_id, position_name, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;`,
      [employee_no, employee_name, position_id || null, position_name, description, is_active]
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
    const { id, employee_no, employee_name, position_id, position_name, description, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Karyawan diperlukan' }, { status: 400 });
    }

    const res = await pool.query(
      `UPDATE m_employee SET
        employee_no = COALESCE($1, employee_no),
        employee_name = COALESCE($2, employee_name),
        position_id = COALESCE($3, position_id),
        position_name = COALESCE($4, position_name),
        description = COALESCE($5, description),
        is_active = COALESCE($6, is_active)
       WHERE id = $7 RETURNING *;`,
      [employee_no, employee_name, position_id, position_name, description, is_active, id]
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
