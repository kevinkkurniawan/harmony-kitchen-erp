import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS t_purchase_request_header (
      id SERIAL PRIMARY KEY,
      pr_no VARCHAR(100) UNIQUE NOT NULL,
      pr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      department_name VARCHAR(100) DEFAULT 'Showroom / Toko Utama',
      request_reason TEXT,
      required_date TIMESTAMP,
      description TEXT,
      status VARCHAR(50) DEFAULT 'Pending Approval',
      requested_by VARCHAR(100) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS t_purchase_request_detail (
      id SERIAL PRIMARY KEY,
      header_id INT REFERENCES t_purchase_request_header(id) ON DELETE CASCADE,
      inventory_id INT,
      barcode VARCHAR(100),
      inventory_no VARCHAR(100),
      inventory_name VARCHAR(255),
      uom_name VARCHAR(50),
      qty INT NOT NULL DEFAULT 1,
      notes TEXT
    );
  `);

  // Reset if count > 0 and contains legacy restaurant cooking terms
  const checkRes = await pool.query(`SELECT COUNT(*)::int AS count FROM t_purchase_request_header WHERE department_name LIKE '%Dapur%' OR request_reason LIKE '%kaldu%';`);
  if (checkRes.rows[0].count > 0) {
    await pool.query(`DELETE FROM t_purchase_request_header;`);
  }

  // Seed Purchase Requests if count < 3
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM t_purchase_request_header;`);
  if (countRes.rows[0].count < 3) {
    const invRes = await pool.query(`SELECT id, barcode, inventory_no, inventory_name FROM m_inventory ORDER BY id ASC LIMIT 20;`);

    const invs = invRes.rows.length > 0 ? invRes.rows : [
      { id: 1, barcode: '8991001', inventory_no: 'INV-001', inventory_name: 'Wajan Anti Lengket Maspion 30cm' },
      { id: 2, barcode: '8991002', inventory_no: 'INV-002', inventory_name: 'Panci Stockpot Stainless Steel 40L' },
      { id: 3, barcode: '8991003', inventory_no: 'INV-003', inventory_name: 'Pisau Dapur Chef Knife 8 inch' }
    ];

    const seedPRs = [
      {
        pr_no: 'PR-241101-001',
        department_name: 'Showroom / Toko Utama',
        request_reason: 'Restock Stok Toko Peralatan Dapur Menjelang Promo',
        required_date: '2024-11-12',
        description: 'Pengajuan restock cepat wajan anti lengket & panci stockpot',
        status: 'Pending Approval',
        items: [
          { inv: invs[0], qty: 50, notes: 'Stok toko etalase depan' },
          { inv: invs[1] || invs[0], qty: 20, notes: 'Stockpot display' }
        ]
      },
      {
        pr_no: 'PR-241102-002',
        department_name: 'Gudang & Logistik',
        request_reason: 'Pengadaan Pisau Dapur Premium & Talenan Kayu',
        required_date: '2024-11-15',
        description: 'Pemenuhan order pesanan wholesale toko grosir partner',
        status: 'Approved',
        items: [
          { inv: invs[2] || invs[0], qty: 30, notes: 'Pisau chef knife' }
        ]
      },
      {
        pr_no: 'PR-241103-003',
        department_name: 'Divisi Penjualan (Sales B2B)',
        request_reason: 'Kebutuhan Pasokan Peralatan Dapur Hotel & Resto Client',
        required_date: '2024-11-20',
        description: 'Pengadaan perabotan kitchenware stainless steel',
        status: 'Processed to PO',
        items: [
          { inv: invs[0], qty: 100, notes: 'Pesanan B2B Hotel Surabaya' }
        ]
      }
    ];

    for (const pr of seedPRs) {
      const headerIns = await pool.query(
        `INSERT INTO t_purchase_request_header (
          pr_no, department_name, request_reason, required_date, description, status, requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, 'Admin')
        ON CONFLICT (pr_no) DO NOTHING
        RETURNING id;`,
        [
          pr.pr_no,
          pr.department_name,
          pr.request_reason,
          pr.required_date,
          pr.description,
          pr.status
        ]
      );

      const headerId = headerIns.rows[0]?.id;
      if (headerId) {
        for (const item of pr.items) {
          await pool.query(
            `INSERT INTO t_purchase_request_detail (
              header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, notes
            ) VALUES ($1, $2, $3, $4, $5, 'PCS', $6, $7);`,
            [
              headerId,
              item.inv.id,
              item.inv.barcode || '8991000',
              item.inv.inventory_no || 'INV-000',
              item.inv.inventory_name || 'Kitchenware Product',
              item.qty,
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
      const headerRes = await pool.query(`SELECT * FROM t_purchase_request_header WHERE id = $1;`, [id]);
      if (headerRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Pengajuan Pembelian tidak ditemukan' }, { status: 404 });
      }
      const detailRes = await pool.query(`SELECT * FROM t_purchase_request_detail WHERE header_id = $1 ORDER BY id ASC;`, [id]);
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
      FROM t_purchase_request_header h
      LEFT JOIN t_purchase_request_detail d ON h.id = d.header_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (h.pr_no ILIKE $${params.length} OR h.department_name ILIKE $${params.length} OR h.request_reason ILIKE $${params.length} OR h.description ILIKE $${params.length})`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      query += ` AND h.status = $${params.length}`;
    }

    query += ` GROUP BY h.id ORDER BY h.id DESC;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/requests:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const {
      pr_no,
      department_name = 'Showroom / Toko Utama',
      request_reason = '',
      required_date,
      description = '',
      status = 'Pending Approval',
      requested_by = 'Admin',
      items = []
    } = body;

    if (!pr_no || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Nomor PR dan item barang wajib diisi' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const headerRes = await client.query(
        `INSERT INTO t_purchase_request_header (
          pr_no, department_name, request_reason, required_date, description, status, requested_by
        ) VALUES ($1, $2, $3, COALESCE($4::timestamp, NOW()), $5, $6, $7)
        RETURNING id;`,
        [
          pr_no,
          department_name,
          request_reason,
          required_date || null,
          description,
          status,
          requested_by
        ]
      );

      const headerId = headerRes.rows[0].id;

      for (const item of items) {
        await client.query(
          `INSERT INTO t_purchase_request_detail (
            header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            headerId,
            item.inventoryId || item.inventory_id || null,
            item.barcode || '',
            item.inventoryNo || item.inventory_no || '',
            item.inventoryName || item.inventory_name || '',
            item.uomName || item.uom_name || 'PCS',
            Number(item.qty || 1),
            item.notes || ''
          ]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Pengajuan pembelian berhasil disimpan', id: headerId });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/requests:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTablesExist();
    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID dan Status diperlukan' }, { status: 400 });
    }

    await pool.query(`UPDATE t_purchase_request_header SET status = $1 WHERE id = $2;`, [status, id]);
    return NextResponse.json({ success: true, message: 'Status PR berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error in PUT /api/purchasing/requests:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID PR diperlukan' }, { status: 400 });
    }

    await pool.query(`UPDATE t_purchase_request_header SET status = 'Cancelled' WHERE id = $1;`, [id]);
    return NextResponse.json({ success: true, message: 'PR berhasil dibatalkan' });
  } catch (error: any) {
    console.error('Error in DELETE /api/purchasing/requests:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
