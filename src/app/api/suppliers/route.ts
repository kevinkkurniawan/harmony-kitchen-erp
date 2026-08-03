import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        id::text AS id,
        supplier_no AS "supplierNo",
        supplier_name AS "supplierName",
        address,
        city,
        phone1,
        phone2,
        fax,
        contact_person AS "contactPerson",
        email,
        tax_no AS "taxNo",
        is_taxable AS "isTaxable",
        description
      FROM m_supplier
      ORDER BY id ASC;
    `);
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
