import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const brandsRes = await pool.query('SELECT id, brand_no AS "brandNo", brand_name AS "brandName" FROM m_brand ORDER BY brand_name ASC');
    const categoriesRes = await pool.query('SELECT id, category_no AS "categoryNo", category_name AS "categoryName" FROM m_category ORDER BY category_name ASC');
    const productTypesRes = await pool.query('SELECT id, product_no AS "productNo", product_name AS "productName" FROM m_product_type ORDER BY product_name ASC');
    const uomsRes = await pool.query('SELECT id, uom_code AS "uomCode", uom_name AS "uomName" FROM m_uom ORDER BY uom_name ASC');

    const itemsRes = await pool.query(`
      SELECT 
        id,
        inventory_no AS "inventoryNo",
        barcode,
        inventory_name AS "inventoryName",
        price,
        stok_update AS "stokUpdate"
      FROM public.m_inventory
      WHERE barcode IS NOT NULL AND barcode != ''
      ORDER BY id DESC
      LIMIT 1000;
    `);

    return NextResponse.json({
      success: true,
      data: {
        brands: brandsRes.rows,
        categories: categoriesRes.rows,
        productTypes: productTypesRes.rows,
        uoms: uomsRes.rows,
        items: itemsRes.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching lookups:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
