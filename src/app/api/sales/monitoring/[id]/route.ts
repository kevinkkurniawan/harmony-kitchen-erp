import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const headerRes = await pool.query(`
      SELECT 
        h.id::text AS id,
        h.invoice_no AS "invoiceNo",
        TO_CHAR(h.invoice_date, 'YYYY-MM-DD HH24:MI:SS') AS "invoiceDate",
        h.cashier_name AS "cashierName",
        h.customer_name AS "customerName",
        h.payment_type AS "paymentType",
        h.bank_name AS "bankName",
        h.subtotal::float,
        h.disc_value AS "discValue",
        h.tax_value AS "taxValue",
        h.grand_total AS "grandTotal",
        h.payment_amount AS "paymentAmount",
        h.change_amount AS "changeAmount",
        h.is_void AS "isVoid",
        h.description
      FROM t_sales_pos_header h
      WHERE h.id = $1;
    `, [parseInt(id)]);

    if (headerRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Nota Sales POS tidak ditemukan' }, { status: 404 });
    }

    const header = headerRes.rows[0];

    const itemsRes = await pool.query(`
      SELECT 
        d.id::text AS id,
        d.inventory_no AS "inventoryNo",
        d.inventory_name AS "inventoryName",
        d.uom_name AS "uomName",
        d.qty,
        d.price::float,
        d.subtotal::float
      FROM t_sales_pos_detail d
      WHERE d.header_id = $1
      ORDER BY d.id ASC;
    `, [parseInt(id)]);

    return NextResponse.json({
      success: true,
      data: {
        header,
        items: itemsRes.rows,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    await pool.query(`
      UPDATE t_sales_pos_header SET is_void = TRUE WHERE id = $1;
    `, [parseInt(id)]);

    return NextResponse.json({
      success: true,
      message: `Nota Transaksi ID #${id} Berhasil Di-void (Dibatalkan)`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
