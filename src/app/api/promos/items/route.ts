import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS m_promo (
      id SERIAL PRIMARY KEY,
      promo_bundle INT DEFAULT 0,
      promo_grosir NUMERIC(18,2) DEFAULT 0,
      promo_name VARCHAR(255) NOT NULL,
      promo_percentage NUMERIC(5,2) DEFAULT 0,
      qty_min INT DEFAULT 1,
      qty_max INT DEFAULT 9999,
      is_partial BOOLEAN DEFAULT TRUE,
      is_group BOOLEAN DEFAULT TRUE,
      description TEXT,
      promo_grosir_type VARCHAR(100) DEFAULT 'PERCENT',
      is_active BOOLEAN DEFAULT TRUE
    );
  `);

  // Seed rich realistic promo rules if less than 5 rows
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM m_promo;`);
  if (countRes.rows[0].count < 5) {
    await pool.query(`TRUNCATE TABLE m_promo;`);
    await pool.query(`
      INSERT INTO m_promo (promo_name, promo_bundle, promo_grosir, promo_percentage, qty_min, qty_max, is_partial, is_group, description, promo_grosir_type, is_active) VALUES
      ('Promo Grosir Maspion Kitchenware', 0, 50000, 10.0, 5, 100, TRUE, TRUE, 'Diskon bertingkat pembelian grosir wajan dan panci Maspion min 5 pcs', 'PERCENT', TRUE),
      ('Promo Bundle Parcel Set Alat Makan', 3, 25000, 15.0, 1, 50, TRUE, TRUE, 'Paket bundling sendok garpu stainless steel + piring keramik opal', 'PERCENT', TRUE),
      ('Diskon Spesial Kitchenware Tier 1', 0, 100000, 20.0, 10, 500, TRUE, TRUE, 'Potongan harga grosir eksklusif pembelian jumlah besar di atas 10 pcs', 'PERCENT', TRUE),
      ('Promo Cashback Restoran & Catering', 0, 150000, 12.5, 20, 1000, TRUE, TRUE, 'Potongan khusus pengadaan peralatan dapur restoran & catering B2B', 'PERCENT', TRUE),
      ('Paket Hemat Pisau Dapur & Talenan Kayu', 2, 15000, 8.0, 2, 30, TRUE, TRUE, 'Beli pisau dapur stainless set gratis talenan kayu mahoni premium', 'FIXED', TRUE),
      ('Promo Flash Sale Wok Pan Anti Lengket 32cm', 0, 35000, 25.0, 1, 10, TRUE, FALSE, 'Diskon Kilat penggorengan wok pan anti lengket 32cm stok terbatas', 'PERCENT', TRUE),
      ('Promo Cuci Gudang Stock End of Year', 0, 75000, 30.0, 3, 100, TRUE, TRUE, 'Promo pembersihan stok peralatan dapur dan perlengkapan resto akhir tahun', 'PERCENT', TRUE),
      ('Promo Member VIP Harmony Kitchen', 0, 10000, 5.0, 1, 20, TRUE, TRUE, 'Diskon tambahan 5% khusus pemegang kartu member VIP Harmony', 'PERCENT', TRUE),
      ('Grosir Piring Saji Keramik Opal 9 inch', 12, 45000, 18.0, 12, 200, TRUE, TRUE, 'Harga grosir khusus pembelian 1 lusin piring saji keramik', 'PERCENT', TRUE),
      ('Promo Paket Kompor Gas Resto 2 Tungku', 2, 80000, 10.0, 1, 5, TRUE, TRUE, 'Bundling kompor gas high pressure 2 tungku + regulator miyako', 'FIXED', TRUE);
    `);
  }
}

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';

    let queryText = `
      SELECT 
        id::text AS id,
        promo_bundle AS "promoBundle",
        promo_grosir::float AS "promoGrosir",
        promo_name AS "promoName",
        promo_percentage::float AS "promoPercentage",
        qty_min AS "qtyMin",
        qty_max AS "qtyMax",
        is_partial AS "isPartial",
        is_group AS "isGroup",
        description,
        promo_grosir_type AS "promoGrosirType",
        is_active AS "isActive"
      FROM m_promo
    `;

    const whereConditions: string[] = [];
    const values: (string | boolean)[] = [];

    if (q) {
      values.push(`%${q}%`);
      whereConditions.push(`(promo_name ILIKE $${values.length} OR description ILIKE $${values.length})`);
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
    await ensureTablesExist();
    const body = await request.json();
    const {
      promoName,
      promoBundle = 0,
      promoGrosir = 0,
      promoPercentage = 0,
      qtyMin = 1,
      qtyMax = 9999,
      isPartial = true,
      isGroup = true,
      description = '',
      promoGrosirType = 'PERCENT',
      isActive = true,
    } = body;

    if (!promoName) {
      return NextResponse.json({ success: false, error: 'Nama promo wajib diisi' }, { status: 400 });
    }

    const insertQuery = `
      INSERT INTO m_promo (
        promo_name, promo_bundle, promo_grosir, promo_percentage,
        qty_min, qty_max, is_partial, is_group, description, promo_grosir_type, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING id;
    `;

    const values = [
      promoName,
      parseInt(promoBundle),
      parseFloat(promoGrosir),
      parseFloat(promoPercentage),
      parseInt(qtyMin),
      parseInt(qtyMax),
      isPartial,
      isGroup,
      description,
      promoGrosirType,
      isActive,
    ];

    const result = await pool.query(insertQuery, values);
    return NextResponse.json({ success: true, message: 'Promo berhasil ditambahkan', id: result.rows[0].id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
