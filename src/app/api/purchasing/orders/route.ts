import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS t_purchase_order_header (
      id SERIAL PRIMARY KEY,
      po_no VARCHAR(100) UNIQUE NOT NULL,
      po_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      supplier_id INT,
      supplier_name VARCHAR(255),
      payment_term VARCHAR(100) DEFAULT 'TOP 30 Hari',
      delivery_date TIMESTAMP,
      wh_name VARCHAR(100) DEFAULT 'Gudang Utama Dapur',
      description TEXT,
      subtotal NUMERIC(15, 2) DEFAULT 0,
      tax_pct NUMERIC(5, 2) DEFAULT 11,
      tax_amount NUMERIC(15, 2) DEFAULT 0,
      discount_amount NUMERIC(15, 2) DEFAULT 0,
      grand_total NUMERIC(15, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'Draft',
      created_by VARCHAR(100) DEFAULT 'Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS t_purchase_order_detail (
      id SERIAL PRIMARY KEY,
      header_id INT REFERENCES t_purchase_order_header(id) ON DELETE CASCADE,
      inventory_id INT,
      barcode VARCHAR(100),
      inventory_no VARCHAR(100),
      inventory_name VARCHAR(255),
      uom_name VARCHAR(50),
      qty INT NOT NULL DEFAULT 1,
      unit_price NUMERIC(15, 2) DEFAULT 0,
      discount_pct NUMERIC(5, 2) DEFAULT 0,
      subtotal NUMERIC(15, 2) DEFAULT 0,
      notes TEXT
    );
  `);

  // Seed Purchase Orders if count < 4
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM t_purchase_order_header;`);
  if (countRes.rows[0].count < 4) {
    const supRes = await pool.query(`SELECT id, supplier_name FROM m_supplier WHERE supplier_name != '-' ORDER BY id ASC LIMIT 10;`);
    const invRes = await pool.query(`SELECT id, barcode, inventory_no, inventory_name, price FROM m_inventory ORDER BY id ASC LIMIT 20;`);

    const sups = supRes.rows.length > 0 ? supRes.rows : [
      { id: 1, supplier_name: 'PT. Maspion Group Indonesia' },
      { id: 2, supplier_name: 'PT. RKM Kitchenware Industries' },
      { id: 3, supplier_name: 'PT. Paramount Kitchen Solutions' },
      { id: 4, supplier_name: 'PT. Presindo Central Utamaindo' }
    ];

    const invs = invRes.rows.length > 0 ? invRes.rows : [
      { id: 1, barcode: '8991001', inventory_no: 'INV-001', inventory_name: 'Wajan Anti Lengket Maspion 30cm', price: 175000 },
      { id: 2, barcode: '8991002', inventory_no: 'INV-002', inventory_name: 'Panci Stockpot Stainless Steel 40L', price: 650000 },
      { id: 3, barcode: '8991003', inventory_no: 'INV-003', inventory_name: 'Pisau Dapur Chef Knife 8 inch', price: 125000 },
      { id: 4, barcode: '8991004', inventory_no: 'INV-004', inventory_name: 'Talenan Kayu Jati Premium', price: 95000 }
    ];

    const seedPOs = [
      {
        po_no: 'PO-241101-001',
        supplier_id: sups[0]?.id || 1,
        supplier_name: sups[0]?.supplier_name || 'PT. Maspion Group Indonesia',
        payment_term: 'TOP 30 Hari',
        delivery_date: '2024-11-15',
        wh_name: 'Gudang Utama Dapur',
        description: 'Pemesanan perlengkapan masak awal bulan November',
        status: 'Approved',
        items: [
          { inv: invs[0], qty: 20, unit_price: 175000, disc: 0, notes: 'Warna Hitam Matte' },
          { inv: invs[1] || invs[0], qty: 5, unit_price: 650000, disc: 5, notes: 'Garansi 1 tahun' }
        ]
      },
      {
        po_no: 'PO-241102-002',
        supplier_id: sups[1]?.id || sups[0]?.id || 1,
        supplier_name: sups[1]?.supplier_name || 'PT. RKM Kitchenware Industries',
        payment_term: 'TOP 14 Hari',
        delivery_date: '2024-11-18',
        wh_name: 'Gudang Utama Dapur',
        description: 'Restock pisau & talenan dapur cabang pusat',
        status: 'Sent',
        items: [
          { inv: invs[2] || invs[0], qty: 15, unit_price: 125000, disc: 0, notes: 'Stok pisau chef' },
          { inv: invs[3] || invs[0], qty: 10, unit_price: 95000, disc: 0, notes: 'Talenan anti slip' }
        ]
      },
      {
        po_no: 'PO-241103-003',
        supplier_id: sups[2]?.id || sups[0]?.id || 1,
        supplier_name: sups[2]?.supplier_name || 'PT. Paramount Kitchen Solutions',
        payment_term: 'Cash on Delivery (COD)',
        delivery_date: '2024-11-20',
        wh_name: 'Gudang Transit Outlet 1',
        description: 'Pemesanan Kompor Resto Stainless Heavy Duty',
        status: 'Draft',
        items: [
          { inv: invs[0], qty: 2, unit_price: 2500000, disc: 10, notes: 'Model 4 Burner' }
        ]
      }
    ];

    for (const po of seedPOs) {
      let subtotal = 0;
      for (const item of po.items) {
        const itemSub = item.qty * item.unit_price * (1 - (item.disc || 0) / 100);
        subtotal += itemSub;
      }
      const taxAmount = Math.round(subtotal * 0.11);
      const grandTotal = subtotal + taxAmount;

      const headerIns = await pool.query(
        `INSERT INTO t_purchase_order_header (
          po_no, supplier_id, supplier_name, payment_term, delivery_date, wh_name, description, subtotal, tax_pct, tax_amount, grand_total, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 11, $9, $10, $11, 'Admin')
        ON CONFLICT (po_no) DO NOTHING
        RETURNING id;`,
        [
          po.po_no,
          po.supplier_id,
          po.supplier_name,
          po.payment_term,
          po.delivery_date,
          po.wh_name,
          po.description,
          subtotal,
          taxAmount,
          grandTotal,
          po.status
        ]
      );

      const headerId = headerIns.rows[0]?.id;
      if (headerId) {
        for (const item of po.items) {
          const itemSub = item.qty * item.unit_price * (1 - (item.disc || 0) / 100);
          await pool.query(
            `INSERT INTO t_purchase_order_detail (
              header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, unit_price, discount_pct, subtotal, notes
            ) VALUES ($1, $2, $3, $4, $5, 'PCS', $6, $7, $8, $9, $10);`,
            [
              headerId,
              item.inv.id,
              item.inv.barcode || '8991000',
              item.inv.inventory_no || 'INV-000',
              item.inv.inventory_name || 'Kitchen Item',
              item.qty,
              item.unit_price,
              item.disc || 0,
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
      const headerRes = await pool.query(`SELECT * FROM t_purchase_order_header WHERE id = $1;`, [id]);
      if (headerRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Purchase Order tidak ditemukan' }, { status: 404 });
      }
      const detailRes = await pool.query(`SELECT * FROM t_purchase_order_detail WHERE header_id = $1 ORDER BY id ASC;`, [id]);
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
      FROM t_purchase_order_header h
      LEFT JOIN t_purchase_order_detail d ON h.id = d.header_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (h.po_no ILIKE $${params.length} OR h.supplier_name ILIKE $${params.length} OR h.description ILIKE $${params.length})`;
    }

    if (status && status !== 'ALL') {
      params.push(status);
      query += ` AND h.status = $${params.length}`;
    }

    query += ` GROUP BY h.id ORDER BY h.id DESC;`;

    const res = await pool.query(query, params);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const {
      po_no,
      po_date,
      supplier_id,
      supplier_name,
      payment_term,
      delivery_date,
      wh_name,
      description,
      tax_pct = 11,
      discount_amount = 0,
      status = 'Draft',
      created_by = 'Admin',
      items = []
    } = body;

    if (!po_no || !supplier_name || !items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Data PO tidak lengkap / item kosong' }, { status: 400 });
    }

    let subtotal = 0;
    for (const item of items) {
      const itemPrice = Number(item.unitPrice || item.unit_price || 0);
      const qty = Number(item.qty || 1);
      const discPct = Number(item.discountPct || item.discount_pct || 0);
      const itemSub = qty * itemPrice * (1 - discPct / 100);
      subtotal += itemSub;
    }

    const netSubtotal = Math.max(0, subtotal - Number(discount_amount));
    const taxAmount = Math.round(netSubtotal * (Number(tax_pct) / 100));
    const grandTotal = netSubtotal + taxAmount;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const headerRes = await client.query(
        `INSERT INTO t_purchase_order_header (
          po_no, po_date, supplier_id, supplier_name, payment_term, delivery_date, wh_name, description,
          subtotal, tax_pct, tax_amount, discount_amount, grand_total, status, created_by
        ) VALUES ($1, COALESCE($2::timestamp, NOW()), $3, $4, $5, $6::timestamp, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id;`,
        [
          po_no,
          po_date || null,
          supplier_id || null,
          supplier_name,
          payment_term || 'TOP 30 Hari',
          delivery_date || null,
          wh_name || 'Gudang Utama Dapur',
          description || '',
          subtotal,
          tax_pct,
          taxAmount,
          discount_amount,
          grandTotal,
          status,
          created_by
        ]
      );

      const headerId = headerRes.rows[0].id;

      for (const item of items) {
        const itemPrice = Number(item.unitPrice || item.unit_price || 0);
        const qty = Number(item.qty || 1);
        const discPct = Number(item.discountPct || item.discount_pct || 0);
        const itemSub = qty * itemPrice * (1 - discPct / 100);

        await client.query(
          `INSERT INTO t_purchase_order_detail (
            header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, unit_price, discount_pct, subtotal, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
          [
            headerId,
            item.inventoryId || item.inventory_id || null,
            item.barcode || '',
            item.inventoryNo || item.inventory_no || '',
            item.inventoryName || item.inventory_name || '',
            item.uomName || item.uom_name || 'PCS',
            qty,
            itemPrice,
            discPct,
            itemSub,
            item.notes || item.description || ''
          ]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Purchase Order berhasil dibuat', id: headerId });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await ensureTablesExist();
    const body = await req.json();
    const { id, status, description, delivery_date } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Purchase Order diperlukan' }, { status: 400 });
    }

    if (status) {
      await pool.query(`UPDATE t_purchase_order_header SET status = $1 WHERE id = $2;`, [status, id]);
    } else {
      await pool.query(
        `UPDATE t_purchase_order_header SET description = $1, delivery_date = $2::timestamp WHERE id = $3;`,
        [description, delivery_date || null, id]
      );
    }

    return NextResponse.json({ success: true, message: 'Purchase Order berhasil diperbarui' });
  } catch (error: any) {
    console.error('Error in PUT /api/purchasing/orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Purchase Order diperlukan' }, { status: 400 });
    }

    await pool.query(`UPDATE t_purchase_order_header SET status = 'Cancelled' WHERE id = $1;`, [id]);
    return NextResponse.json({ success: true, message: 'Purchase Order berhasil dibatalkan' });
  } catch (error: any) {
    console.error('Error in DELETE /api/purchasing/orders:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
