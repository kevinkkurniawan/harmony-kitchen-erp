import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS t_stock_sync (
      id SERIAL PRIMARY KEY,
      sync_no VARCHAR(100) NOT NULL,
      sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_items INT NOT NULL DEFAULT 0,
      total_qty INT NOT NULL DEFAULT 0,
      status VARCHAR(50) DEFAULT 'COMPLETED',
      created_by VARCHAR(100) DEFAULT 'Admin ERP'
    );

    CREATE TABLE IF NOT EXISTS t_stock_sync_detail (
      id SERIAL PRIMARY KEY,
      sync_id INT REFERENCES t_stock_sync(id) ON DELETE CASCADE,
      inventory_id INT REFERENCES m_inventory(id),
      inventory_no VARCHAR(100),
      inventory_name VARCHAR(255),
      uom_name VARCHAR(50),
      stok_sebelum INT NOT NULL,
      qty_sync INT NOT NULL,
      stok_setelah INT NOT NULL
    );
  `);
}

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const mode = searchParams.get('mode') || 'pending'; // 'pending' | 'history'

    if (mode === 'history') {
      const historyRes = await pool.query(`
        SELECT 
          s.id::text AS id,
          s.sync_no AS "syncNo",
          TO_CHAR(s.sync_date, 'YYYY-MM-DD HH24:MI:SS') AS "syncDate",
          s.total_items AS "totalItems",
          s.total_qty AS "totalQty",
          s.status,
          s.created_by AS "createdBy"
        FROM t_stock_sync s
        ORDER BY s.id DESC LIMIT 50;
      `);
      return NextResponse.json({ success: true, data: historyRes.rows });
    }

    // Pending POS Sync Items List
    let queryText = `
      SELECT 
        i.id::text AS id,
        i.inventory_no AS "inventoryNo",
        i.barcode,
        i.inventory_name AS "inventoryName",
        COALESCE(u.uom_code, 'PCS') AS "uomName",
        COALESCE(i.stok_update, 0)::int AS "stokGudang",
        -- Simulate pending POS sales qty for items
        CASE 
          WHEN i.id % 7 = 0 THEN 12
          WHEN i.id % 5 = 0 THEN 8
          WHEN i.id % 3 = 0 THEN 5
          WHEN i.id % 2 = 0 THEN 3
          ELSE 2
        END AS "qtyTransaksi",
        TRUE AS "isChecked"
      FROM m_inventory i
      LEFT JOIN m_uom u ON i.uom_id = u.id
      WHERE (i.is_active = TRUE OR i.is_active IS NULL)
    `;

    const values: string[] = [];
    if (q) {
      values.push(`%${q}%`);
      queryText += ` AND (i.inventory_name ILIKE $1 OR i.inventory_no ILIKE $1 OR i.barcode ILIKE $1)`;
    }

    queryText += ` ORDER BY i.id ASC LIMIT 100;`;

    const result = await pool.query(queryText, values);

    // Calculate Stok Setelah Sync (Stok Gudang - Qty Transaksi POS)
    const items = result.rows.map((row) => {
      const stokGudang = parseInt(row.stokGudang) || 0;
      const qtyTransaksi = parseInt(row.qtyTransaksi) || 0;
      return {
        ...row,
        stokGudang,
        qtyTransaksi,
        stokSetelahSync: Math.max(0, stokGudang - qtyTransaksi),
      };
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    await ensureTablesExist();
    const body = await request.json();
    const { items = [] } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Wajib memilih minimal 1 barang untuk di-sinkronisasi' }, { status: 400 });
    }

    await client.query('BEGIN');

    const syncNo = `SYNC-${Date.now().toString().slice(-6)}`;
    let totalQtySynced = 0;

    // Create Sync Header
    const headerRes = await client.query(`
      INSERT INTO t_stock_sync (sync_no, total_items, total_qty, status)
      VALUES ($1, $2, 0, 'COMPLETED')
      RETURNING id;
    `, [syncNo, items.length]);

    const syncId = headerRes.rows[0].id;

    for (const item of items) {
      const { id: inventoryId, inventoryNo, inventoryName, uomName, stokGudang, qtyTransaksi } = item;
      const parsedQty = parseInt(qtyTransaksi) || 0;
      const currentStock = parseInt(stokGudang) || 0;
      const newStock = Math.max(0, currentStock - parsedQty);

      totalQtySynced += parsedQty;

      // Log sync detail
      await client.query(`
        INSERT INTO t_stock_sync_detail (
          sync_id, inventory_id, inventory_no, inventory_name, uom_name, stok_sebelum, qty_sync, stok_setelah
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [syncId, parseInt(inventoryId), inventoryNo || '', inventoryName, uomName || 'PCS', currentStock, parsedQty, newStock]);

      // Deduct stock in m_inventory
      await client.query(`
        UPDATE m_inventory SET
          stok_update = GREATEST(0, COALESCE(stok_update, 0) - $1),
          modified_date = CURRENT_TIMESTAMP
        WHERE id = $2;
      `, [parsedQty, parseInt(inventoryId)]);
    }

    // Update total_qty in header
    await client.query(`UPDATE t_stock_sync SET total_qty = $1 WHERE id = $2;`, [totalQtySynced, syncId]);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi Stok ${syncNo} Berhasil! ${items.length} Barang (${totalQtySynced} Qty) Telah Di-sync ke Gudang.`,
      syncNo,
      totalQtySynced,
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
