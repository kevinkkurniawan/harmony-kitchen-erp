import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function initUserTableAndSeed() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.t_access_user (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        user_level VARCHAR(50) NOT NULL DEFAULT 'Kasir',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const countRes = await pool.query(`SELECT COUNT(*) FROM public.t_access_user`);
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO public.t_access_user (username, full_name, user_level, is_active)
        VALUES 
          ('admin', 'Super Administrator ERP', 'Admin', true),
          ('manager', 'Budi Santoso (Manager ERP)', 'Manager', true),
          ('supervisor', 'Siti Aminah (Supervisor)', 'Supervisor', true),
          ('kasir1', 'Rina Kartika (Kasir POS)', 'Kasir', true);
      `);
    }
  } catch (err) {
    console.error('Error initializing user tables/seed:', err);
  }
}

export async function GET() {
  try {
    await initUserTableAndSeed();
    const res = await pool.query(`
      SELECT 
        id,
        username,
        full_name AS "fullName",
        user_level AS "userLevel",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM public.t_access_user
      ORDER BY id ASC;
    `);

    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initUserTableAndSeed();
    const body = await request.json();
    const { username, fullName, userLevel = 'Kasir', isActive = true } = body;

    if (!username || !fullName) {
      return NextResponse.json({ success: false, error: 'Username and fullName are required' }, { status: 400 });
    }

    const res = await pool.query(`
      INSERT INTO public.t_access_user (username, full_name, user_level, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, full_name AS "fullName", user_level AS "userLevel", is_active AS "isActive";
    `, [username.toLowerCase().trim(), fullName, userLevel, isActive]);

    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
