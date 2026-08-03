import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [brands, categories, productTypes, uoms] = await Promise.all([
      pool.query(`SELECT id, brand_no AS "brandNo", brand_name AS "brandName" FROM m_brand ORDER BY brand_name ASC`),
      pool.query(`SELECT id, category_no AS "categoryNo", category_name AS "categoryName" FROM m_category ORDER BY category_name ASC`),
      pool.query(`SELECT id, product_no AS "productNo", product_name AS "productName" FROM m_product_type ORDER BY product_name ASC`),
      pool.query(`SELECT id, uom_code AS "uomCode", uom_name AS "uomName" FROM m_uom ORDER BY uom_name ASC`),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        brands: brands.rows,
        categories: categories.rows,
        productTypes: productTypes.rows,
        uoms: uoms.rows,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
