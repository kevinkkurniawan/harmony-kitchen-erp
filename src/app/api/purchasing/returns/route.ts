import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS t_purchase_return_header (
      id SERIAL PRIMARY KEY,
      return_no VARCHAR(100) UNIQUE NOT NULL,
      return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      mr_no VARCHAR(100),
      supplier_id INT,
      supplier_name VARCHAR(255),
      wh_name VARCHAR(100) DEFAULT 'Gudang Utama Dapur',
      return_reason VARCHAR(255) DEFAULT 'Barang Cacat / Damage',
      description TEXT,
      total_amount NUMERIC(15, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Approved',
      created_by VARCHAR(100) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS t_purchase_return_detail (
      id SERIAL PRIMARY KEY,
      header_id INT REFERENCES t_purchase_return_header(id) ON DELETE CASCADE,
      inventory_id INT,
      barcode VARCHAR(100),
      inventory_no VARCHAR(100),
      inventory_name VARCHAR(255),
      uom_name VARCHAR(50),
      qty INT NOT NULL DEFAULT 1,
      unit_price NUMERIC(15, 2) DEFAULT 0,
      subtotal NUMERIC(15, 2) DEFAULT 0,
      notes TEXT
    );
  `);

  // Seed Purchase Returns if count < 4
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM t_purchase_return_header;`);
  if (countRes.rows[0].count < 4) {
    const supRes = await pool.query(`SELECT id, supplier_name FROM m_supplier WHERE supplier_name != '-' ORDER BY id ASC LIMIT 10;`);
    const invRes = await pool.query(`SELECT id, barcode, inventory_no, inventory_name, hpp, price FROM m_inventory ORDER BY id ASC LIMIT 20;`);

    const sups = supRes.rows.length > 0 ? supRes.rows : [
      { id: 1, supplier_name: 'PT. Maspion Group Indonesia' },
      { id: 2, supplier_name: 'PT. RKM Kitchenware Industries' }
    ];

    const invs = invRes.rows.length > 0 ? invRes.rows : [
      { id: 1, barcode: '8991001', inventory_no: 'INV-001', inventory_name: 'Wajan Anti Lengket Maspion 30cm', hpp: 175000 },
      { id: 2, barcode: '8991002', inventory_no: 'INV-002', inventory_name: 'Panci Stockpot Stainless Steel 40L', hpp: 650000 }
    ];

    const seedReturns = [
      {
        return_no: 'RET-241101-001',
        mr_no: 'MR-EXP-241101',
        supplier_id: sups[0]?.id || 1,
        supplier_name: sups[0]?.supplier_name || 'PT. Maspion Group Indonesia',
        wh_name: 'Gudang Utama Dapur',
        return_reason: 'Barang Cacat / Penyok Saat Pengiriman',
        description: 'Pengembalian 2 wajan karena pegangan retak halus',
        status: 'Completed',
        items: [
          { inv: invs[0], qty: 2, unit_price: 175000, notes: 'Gagang wajan retak' }
        ]
      },
      {
        return_no: 'RET-241102-002',
        mr_no: 'MR-EXP-241102',
        supplier_id: sups[1]?.id || sups[0]?.id || 1,
        supplier_name: sups[1]?.supplier_name || 'PT. RKM Kitchenware Industries',
        wh_name: 'Gudang Utama Dapur',
        return_reason: 'Tidak Sesuai Spesifikasi Pesanan',
        description: 'Pengembalian stockpot ukuran tidak pas',
        status: 'Approved',
        items: [
          { inv: invs[1] || invs[0], qty: 1, unit_price: 650000, notes: 'Harusnya 50L dikirim 40L' }
        ]
      }
    ];

    for (const ret of seedReturns) {
      let totalAmount = 0;
      for (const item of ret.items) {
        totalAmount += item.qty * item.unit_price;
      }

      const headerIns = await pool.query(
        `INSERT INTO t_purchase_return_header (
          return_no, mr_no, supplier_id, supplier_name, wh_name, return_reason, description, total_amount, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Admin')
        ON CONFLICT (return_no) DO NOTHING
        RETURNING id;`,
        [
          ret.return_no,
          ret.mr_no,
          ret.supplier_id,
          ret.supplier_name,
          ret.wh_name,
          ret.return_reason,
          ret.description,
          totalAmount,
          ret.status
        ]
      );

      const headerId = headerIns.rows[0]?.id;
      if (headerId) {
        for (const item of ret.items) {
          const itemSub = item.qty * item.unit_price;
          await pool.query(
            `INSERT INTO t_purchase_return_detail (
              header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, unit_price, subtotal, notes
            ) VALUES ($1, $2, $3, $4, $5, 'PCS', $6, $7, $8, $9);`,
            [
              headerId,
              item.inv.id,
              item.inv.barcode || '8991000',
              item.inv.inventory_no || 'INV-000',
              item.inv.inventory_name || 'Kitchen Item',
              item.qty,
              item.unit_price,
              itemSub,
              item.notes || ''
            ]
          );
        }
      }
    }
  }
}

export async function GET(req: Request) {
  try {
    await ensureTablesExist();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const q = searchParams.get('q') || '';
    const status = searchParams.get('status');

    if (id) {
      const headerRes = await pool.query(`SELECT * FROM t_purchase_return_header WHERE id = $1;`, [id]);
      if (headerRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Retur Pembelian tidak ditemukan' }, { status: 404 });
      }
      const detailRes = await pool.query(`SELECT * FROM t_purchase_return_detail WHERE header_id = $1 ORDER BY id ASC;`, [id]);
      return NextResponse.json({
        success: true,
        data: {
          header: headerRes.rows[0],
          items: detailRes.rows
        }
      });
    }

    let query = `
      SELECT h.*, 
        COUNT(d.id)::int AS item_count, 
        COALESCE(SUM(d.qty), 0)::int AS total_qty
      FROM t_purchase_return_header h
      LEFT JOIN t_purchase_return_detail d ON h.id = d.header_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (h.return_no ILIKE $${params.length} OR h.supplier_name ILIKE $${params.length} OR h.mr_no ILIKE $${params.length} OR h.description ILIKE $${params.length})`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      query += ` AND h.status = $${params.length}`;
    }

    query += ` GROUP BY h.id ORDER BY h.id DESC;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const {
      return_no,
      return_date,
      mr_no = '',
      supplier_id,
      supplier_name,
      wh_name = 'Gudang Utama Dapur',
      return_reason = 'Barang Cacat / Damage',
      description = '',
      status = 'Approved',
      created_by = 'Admin',
      items = []
    } = body;

    if (!return_no || !supplier_name || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Data Retur tidak lengkap / item kosong' }, { status: 400 });
    }

    let totalAmount = 0;
    for (const item of items) {
      const itemPrice = Number(item.unitPrice || item.unit_price || 0);
      const qty = Number(item.qty || 1);
      totalAmount += qty * itemPrice;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const headerRes = await client.query(
        `INSERT INTO t_purchase_return_header (
          return_no, return_date, mr_no, supplier_id, supplier_name, wh_name, return_reason, description,
          total_amount, status, created_by
        ) VALUES ($1, COALESCE($2::timestamp, NOW()), $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id;`,
        [
          return_no,
          return_date || null,
          mr_no,
          supplier_id || null,
          supplier_name,
          wh_name,
          return_reason,
          description,
          totalAmount,
          status,
          created_by
        ]
      );

      const headerId = headerRes.rows[0].id;

      for (const item of items) {
        const itemPrice = Number(item.unitPrice || item.unit_price || 0);
        const qty = Number(item.qty || 1);
        const itemSub = qty * itemPrice;

        await client.query(
          `INSERT INTO t_purchase_return_detail (
            header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, unit_price, subtotal, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
          [
            headerId,
            item.inventoryId || item.inventory_id || null,
            item.barcode || '',
            item.inventoryNo || item.inventory_no || '',
            item.inventoryName || item.inventory_name || '',
            item.uomName || item.uom_name || 'PCS',
            qty,
            itemPrice,
            itemSub,
            item.notes || ''
          ]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Retur Pembelian berhasil disimpan', id: headerId });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTablesExist();
    const body = await req.json();
    const { id, status, description } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Retur Pembelian diperlukan' }, { status: 400 });
    }

    if (status) {
      await pool.query(`UPDATE t_purchase_return_header SET status = $1 WHERE id = $2;`, [status, id]);
    } else {
      await pool.query(`UPDATE t_purchase_return_header SET description = $1 WHERE id = $2;`, [description, id]);
    }

    return NextResponse.json({ success: true, message: 'Status retur berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error in PUT /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Retur Pembelian diperlukan' }, { status: 400 });
    }

    await pool.query(`UPDATE t_purchase_return_header SET status = 'Cancelled' WHERE id = $1;`, [id]);
    return NextResponse.json({ success: true, message: 'Retur Pembelian berhasil dibatalkan' });
  } catch (error: any) {
    console.error('Error in DELETE /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
