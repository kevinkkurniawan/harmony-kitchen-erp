import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function initMemoTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.t_memo (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) DEFAULT 'Memo Utama',
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'operational',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if initial seed memo exists
    const checkRes = await pool.query(`SELECT COUNT(*) FROM public.t_memo`);
    const count = parseInt(checkRes.rows[0].count, 10);
    if (count === 0) {
      await pool.query(`
        INSERT INTO public.t_memo (title, content, category)
        VALUES ('Memo Operasional', 'Cek Sync Stock dan Opname', 'operational');
      `);
    }
  } catch (err) {
    console.error('Failed to initialize t_memo table:', err);
  }
}

export async function GET() {
  try {
    await initMemoTable();
    const result = await pool.query(
      `SELECT id, title, content, category, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM public.t_memo
       WHERE is_active = true
       ORDER BY id ASC`
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching memos:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await initMemoTable();
    const body = await request.json();
    const { id, title, content, category } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content memo wajib diisi' },
        { status: 400 }
      );
    }

    if (id) {
      const updateRes = await pool.query(
        `UPDATE public.t_memo
         SET title = COALESCE($1, title),
             content = $2,
             category = COALESCE($3, category),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, title, content, category, is_active AS "isActive", updated_at AS "updatedAt"`,
        [title, content, category, id]
      );
      return NextResponse.json({ success: true, data: updateRes.rows[0] });
    } else {
      const insertRes = await pool.query(
        `INSERT INTO public.t_memo (title, content, category)
         VALUES ($1, $2, $3)
         RETURNING id, title, content, category, is_active AS "isActive", created_at AS "createdAt"`,
        [title || 'Memo Operasional', content, category || 'operational']
      );
      return NextResponse.json({ success: true, data: insertRes.rows[0] });
    }
  } catch (error: any) {
    console.error('Error saving memo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
