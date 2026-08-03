import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await pool.query(
      `SELECT 
        id::text AS id,
        mr_no AS "mrNo",
        to_char(mr_date, 'YYYY-MM-DD HH24:MI') AS "mrDate",
        supplier_name AS "supplierName",
        hpp::float AS hpp
       FROM m_hpp_history 
       WHERE inventory_id = $1 
       ORDER BY mr_date DESC`,
      [parseInt(id)]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
