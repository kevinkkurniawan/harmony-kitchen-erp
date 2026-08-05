import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureGroupTableExists() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m_promo_group (
      id SERIAL PRIMARY KEY,
      promo_code VARCHAR(100),
      promo_name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE
    );
    CREATE SEQUENCE IF NOT EXISTS m_promo_group_id_seq;
    ALTER TABLE m_promo_group ALTER COLUMN id SET DEFAULT nextval('m_promo_group_id_seq');
  `);

  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_promo_group;`);
  if (countRes.rows[0].count < 5) {
    await pool.query(`TRUNCATE TABLE m_promo_group;`);
    await pool.query(`
      INSERT INTO m_promo_group (promo_code, promo_name, description, is_active) VALUES
      ('PRM-GR1', 'Promo Grosir Dapur Utama', 'Discount bertingkat pembelian grosir peralatan dapur', TRUE),
      ('PRM-BUNDLE', 'Promo Bundle Parcel Dapur', 'Paket hemat perlengkapan dapur & dining set', TRUE),
      ('PRM-SEASON', 'Promo Big Sale Hari Raya & New Year', 'Potongan harga promo musiman perlengkapan masak', TRUE),
      ('PRM-RESTAURANT', 'Promo Khusus Catering & Restoran', 'Potongan harga khusus merchant B2B & hotel/resto', TRUE),
      ('PRM-MEMBERSHIP', 'Promo Member VIP Harmony', 'Diskon khusus pelanggan terdaftar member VIP', TRUE),
      ('PRM-FLASHSALE', 'Promo Flash Sale Kitchenware', 'Diskon kilat produk cookware anti lengket terpilih', TRUE);
    `);
  }
}

export async function GET(request: Request) {
  try {
    await ensureGroupTableExists();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';

    let queryText = `
      SELECT 
        id::text AS id,
        promo_code AS "promoCode",
        promo_name AS "promoName",
        description,
        is_active AS "isActive"
      FROM m_promo_group
    `;

    const whereConditions: string[] = [];
    const values: (string | boolean)[] = [];

    if (q) {
      values.push(`%${q}%`);
      whereConditions.push(`(promo_name ILIKE $${values.length} OR promo_code ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }

    if (onlyActive) {
      whereConditions.push(`is_active = TRUE`);
    }

    if (whereConditions.length > 0) {
      queryText += ` WHERE ` + whereConditions.join(' AND ');
    }

    queryText += ` ORDER BY id ASC;`;

    const result = await pool.query(queryText, values);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureGroupTableExists();
    const body = await request.json();
    const { promoCode, promoName, description = '', isActive = true } = body;

    if (!promoName) {
      return NextResponse.json({ success: false, error: 'Nama kelompok promo wajib diisi' }, { status: 400 });
    }

    const code = promoCode || `PRM-GRP-${Date.now().toString().slice(-4)}`;

    const insertQuery = `
      INSERT INTO m_promo_group (promo_code, promo_name, description, is_active)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;

    const values = [code, promoName, description, isActive];
    const result = await pool.query(insertQuery, values);
    return NextResponse.json({ success: true, message: 'Kelompok promo berhasil ditambahkan', id: result.rows[0].id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
