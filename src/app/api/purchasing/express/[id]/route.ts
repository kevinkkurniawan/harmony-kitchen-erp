import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const headerRes = await pool.query(`
      SELECT 
        id::text AS id,
        mr_no AS "mrNo",
        TO_CHAR(mr_date, 'YYYY-MM-DD HH24:MI:SS') AS "mrDate",
        supplier_id::text AS "supplierId",
        supplier_name AS "supplierName",
        do_no AS "doNo",
        driver_name AS "driverName",
        vehicle_no AS "vehicleNo",
        wh_name AS "whName",
        description,
        is_express AS "isExpress",
        is_void AS "isVoid"
      FROM t_material_receive_header
      WHERE id = $1;
    `, [parseInt(id)]);

    if (headerRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Bukti penerimaan barang tidak ditemukan' }, { status: 404 });
    }

    const detailRes = await pool.query(`
      SELECT 
        id::text AS id,
        header_id::text AS "headerId",
        inventory_id::text AS "inventoryId",
        barcode,
        inventory_no AS "inventoryNo",
        inventory_name AS "inventoryName",
        uom_name AS "uomName",
        qty,
        description
      FROM t_material_receive_detail
      WHERE header_id = $1
      ORDER BY id ASC;
    `, [parseInt(id)]);

    return NextResponse.json({
      success: true,
      data: {
        header: headerRes.rows[0],
        items: detailRes.rows,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    await client.query('BEGIN');

    // Fetch details to reverse inventory stock
    const detailRes = await client.query(`
      SELECT inventory_id, qty FROM t_material_receive_detail WHERE header_id = $1;
    `, [parseInt(id)]);

    for (const row of detailRes.rows) {
      if (row.inventory_id) {
        await client.query(`
          UPDATE m_inventory SET
            stok_update = GREATEST(0, COALESCE(stok_update, 0) - $1)
          WHERE id = $2;
        `, [row.qty, row.inventory_id]);
      }
    }

    // Mark as void
    await client.query(`
      UPDATE t_material_receive_header SET is_void = TRUE WHERE id = $1;
    `, [parseInt(id)]);

    await client.query('COMMIT');
    return NextResponse.json({ success: true, message: 'Transaksi penerimaan ekspress berhasil dibatalkan (void) & stok dikembalikan!' });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
