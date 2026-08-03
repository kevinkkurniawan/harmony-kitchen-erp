import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const minusStock = searchParams.get('minusStock') === 'true';
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const limit = parseInt(searchParams.get('limit') || '500');

    let queryText = `
      SELECT 
        i.id::text AS id,
        i.inventory_no AS "inventoryNo",
        i.barcode,
        i.inventory_name AS "inventoryName",
        i.inventory_brand_id AS "inventoryBrandId",
        b.brand_name AS "brandName",
        i.inventory_category_id AS "inventoryCategoryId",
        c.category_name AS "categoryName",
        i.inventory_product_id AS "inventoryProductId",
        pt.product_name AS "productName",
        i.uom_id AS "uoMId",
        u.uom_code AS "uomName",
        i.min_stock AS "minStock",
        i.max_stock AS "maxStock",
        i.kode_harga AS "kodeHarga",
        i.description,
        i.price::float AS price,
        i.disc::float AS disc,
        i.is_active AS "isActive",
        i.hpp::float AS hpp,
        i.price_buy::float AS "priceBuy",
        i.grosir1::float AS grosir1,
        i.grosir2::float AS grosir2,
        i.grosir3::float AS grosir3,
        i.stok_awal AS "stokAwal",
        i.stok_update AS "stokAkhir"
      FROM m_inventory i
      LEFT JOIN m_brand b ON i.inventory_brand_id = b.id
      LEFT JOIN m_category c ON i.inventory_category_id = c.id
      LEFT JOIN m_product_type pt ON i.inventory_product_id = pt.id
      LEFT JOIN m_uom u ON i.uom_id = u.id
    `;

    const whereConditions: string[] = [];
    const values: any[] = [];

    if (q) {
      values.push(`%${q}%`);
      whereConditions.push(`(i.inventory_no ILIKE $${values.length} OR i.barcode ILIKE $${values.length} OR i.inventory_name ILIKE $${values.length})`);
    }

    if (onlyActive) {
      whereConditions.push(`i.is_active = TRUE`);
    }

    if (minusStock) {
      whereConditions.push(`(i.stok_update < 0 OR i.stok_update < i.min_stock)`);
    }

    if (whereConditions.length > 0) {
      queryText += ` WHERE ` + whereConditions.join(' AND ');
    }

    queryText += ` ORDER BY i.id ASC LIMIT ${limit};`;

    const result = await pool.query(queryText, values);
    return NextResponse.json({ success: true, data: result.rows, count: result.rowCount });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      inventoryNo,
      barcode,
      inventoryName,
      inventoryBrandId,
      inventoryCategoryId,
      inventoryProductId,
      uoMId,
      minStock = 0,
      maxStock = 0,
      kodeHarga = '',
      description = '',
      price = 0,
      disc = 0,
      isActive = true,
      hpp = 0,
      priceBuy = 0,
      grosir1 = 0,
      grosir2 = 0,
      grosir3 = 0,
      stokAwal = 0,
    } = body;

    const maxIdRes = await pool.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM m_inventory`);
    const newId = maxIdRes.rows[0].next_id;

    const insertQuery = `
      INSERT INTO m_inventory (
        id, barcode, inventory_no, inventory_name, inventory_brand_id, 
        inventory_category_id, inventory_product_id, uom_id, min_stock, 
        max_stock, kode_harga, description, price, disc, is_active, 
        hpp, price_buy, grosir1, grosir2, grosir3, stok_awal, stok_update
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) RETURNING id;
    `;

    const values = [
      newId,
      barcode || '',
      inventoryNo || `BRG-${newId}`,
      inventoryName,
      inventoryBrandId || 1,
      inventoryCategoryId || 1,
      inventoryProductId || 1,
      uoMId || 1,
      parseInt(minStock),
      parseInt(maxStock),
      kodeHarga,
      description,
      parseFloat(price),
      parseFloat(disc),
      isActive,
      parseFloat(hpp),
      parseFloat(priceBuy),
      parseFloat(grosir1),
      parseFloat(grosir2),
      parseFloat(grosir3),
      parseInt(stokAwal),
      parseInt(stokAwal),
    ];

    await pool.query(insertQuery, values);
    return NextResponse.json({ success: true, message: 'Barang berhasil ditambahkan', id: newId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
