import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function ensureTablesExist() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS t_material_receive_header (
      id SERIAL PRIMARY KEY,
      mr_no VARCHAR(100) UNIQUE NOT NULL,
      mr_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      supplier_id INT,
      supplier_name VARCHAR(255),
      do_no VARCHAR(100),
      driver_name VARCHAR(100),
      vehicle_no VARCHAR(100),
      wh_name VARCHAR(100) DEFAULT 'Gudang Utama Dapur',
      description TEXT,
      is_express BOOLEAN DEFAULT TRUE,
      is_void BOOLEAN DEFAULT FALSE,
      created_by VARCHAR(100) DEFAULT 'Admin'
    );

    CREATE TABLE IF NOT EXISTS t_material_receive_detail (
      id SERIAL PRIMARY KEY,
      header_id INT REFERENCES t_material_receive_header(id) ON DELETE CASCADE,
      inventory_id INT,
      barcode VARCHAR(100),
      inventory_no VARCHAR(100),
      inventory_name VARCHAR(255),
      uom_name VARCHAR(50),
      qty INT NOT NULL DEFAULT 1,
      description TEXT
    );
  `);

  // Seed Express Goods Receipts if count < 5
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM t_material_receive_header WHERE is_express = TRUE;`);
  if (countRes.rows[0].count < 5) {
    // Fetch some suppliers and inventory items
    const supRes = await pool.query(`SELECT id, supplier_name FROM m_supplier WHERE supplier_name != '-' ORDER BY id ASC LIMIT 10;`);
    const invRes = await pool.query(`SELECT id, barcode, inventory_no, inventory_name FROM m_inventory ORDER BY id ASC LIMIT 20;`);

    const sups = supRes.rows.length > 0 ? supRes.rows : [{ id: 1, supplier_name: 'PT. Maspion Group Indonesia' }];
    const invs = invRes.rows.length > 0 ? invRes.rows : [{ id: 1, barcode: '8991001', inventory_no: 'INV-001', inventory_name: 'Wajan Anti Lengket Maspion 30cm', uom_name: 'PCS' }];

    const seedExpressData = [
      {
        mr_no: 'MR-EXP-241101',
        supplier_id: sups[0]?.id || 1,
        supplier_name: sups[0]?.supplier_name || 'PT. Maspion Group Indonesia',
        do_no: 'DO-MSP-9881',
        driver_name: 'Bpk. Bambang',
        vehicle_no: 'L 9123 AB',
        wh_name: 'Gudang Utama Dapur',
        description: 'Penerimaan Fisik Cepat Panci & Wajan Maspion',
        items: [
          { inv: invs[0], qty: 25 },
          { inv: invs[1] || invs[0], qty: 15 },
        ],
      },
      {
        mr_no: 'MR-EXP-241102',
        supplier_id: sups[1]?.id || sups[0]?.id || 1,
        supplier_name: sups[1]?.supplier_name || 'PT. RKM Kitchenware Industries',
        do_no: 'DO-RKM-4412',
        driver_name: 'Bpk. Herman',
        vehicle_no: 'B 9481 UJ',
        wh_name: 'Gudang Utama Dapur',
        description: 'Penerimaan Cepat Sendok & Garpu Stainless Cutlery',
        items: [
          { inv: invs[2] || invs[0], qty: 100 },
          { inv: invs[3] || invs[0], qty: 100 },
        ],
      },
      {
        mr_no: 'MR-EXP-241103',
        supplier_id: sups[2]?.id || sups[0]?.id || 1,
        supplier_name: sups[2]?.supplier_name || 'PT. Paramount Kitchen Solutions',
        do_no: 'DO-PRM-8819',
        driver_name: 'Bpk. Joko Susilo',
        vehicle_no: 'L 8821 CD',
        wh_name: 'Gudang Utama Dapur',
        description: 'Penerimaan Fisik Kompor Resto & Grill Pan',
        items: [
          { inv: invs[4] || invs[0], qty: 5 },
          { inv: invs[5] || invs[0], qty: 10 },
        ],
      },
      {
        mr_no: 'MR-EXP-241104',
        supplier_id: sups[3]?.id || sups[0]?.id || 1,
        supplier_name: sups[3]?.supplier_name || 'PT. Presindo Central Utamaindo',
        do_no: 'DO-PRS-5511',
        driver_name: 'Bpk. Rudi',
        vehicle_no: 'D 1289 XY',
        wh_name: 'Gudang Utama Dapur',
        description: 'Penerimaan Piring Saji Opal & Mangkok Keramik',
        items: [
          { inv: invs[6] || invs[0], qty: 60 },
          { inv: invs[7] || invs[0], qty: 48 },
        ],
      },
      {
        mr_no: 'MR-EXP-241105',
        supplier_id: sups[4]?.id || sups[0]?.id || 1,
        supplier_name: sups[4]?.supplier_name || 'PT. Modena Indonesia Appliance',
        do_no: 'DO-MOD-1092',
        driver_name: 'Bpk. Michael',
        vehicle_no: 'B 3341 MOD',
        wh_name: 'Gudang Utama Dapur',
        description: 'Penerimaan Exhaust Hood & Blender Resto',
        items: [
          { inv: invs[8] || invs[0], qty: 4 },
          { inv: invs[9] || invs[0], qty: 8 },
        ],
      },
    ];

    for (const data of seedExpressData) {
      const headerRes = await pool.query(`
        INSERT INTO t_material_receive_header (
          mr_no, supplier_id, supplier_name, do_no, driver_name, vehicle_no, wh_name, description, is_express
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
        ON CONFLICT (mr_no) DO NOTHING
        RETURNING id;
      `, [data.mr_no, data.supplier_id, data.supplier_name, data.do_no, data.driver_name, data.vehicle_no, data.wh_name, data.description]);

      if (headerRes.rows.length > 0) {
        const headerId = headerRes.rows[0].id;
        for (const itemData of data.items) {
          const item = itemData.inv;
          await pool.query(`
            INSERT INTO t_material_receive_detail (
              header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
          `, [headerId, item.id, item.barcode || '', item.inventory_no || '', item.inventory_name, item.uom_name || 'PCS', itemData.qty, 'Kondisi mulus']);
        }
      }
    }
  }
}

export async function GET(request: Request) {
  try {
    await ensureTablesExist();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    let queryText = `
      SELECT 
        h.id::text AS id,
        h.mr_no AS "mrNo",
        TO_CHAR(h.mr_date, 'YYYY-MM-DD HH24:MI:SS') AS "mrDate",
        h.supplier_id::text AS "supplierId",
        h.supplier_name AS "supplierName",
        h.do_no AS "doNo",
        h.driver_name AS "driverName",
        h.vehicle_no AS "vehicleNo",
        h.wh_name AS "whName",
        h.description,
        h.is_express AS "isExpress",
        h.is_void AS "isVoid",
        COALESCE(SUM(d.qty), 0)::int AS "totalQty",
        COUNT(d.id)::int AS "itemCount"
      FROM t_material_receive_header h
      LEFT JOIN t_material_receive_detail d ON h.id = d.header_id
      WHERE (h.is_express = TRUE)
    `;

    const whereConditions: string[] = [];
    const values: string[] = [];

    if (q) {
      values.push(`%${q}%`);
      whereConditions.push(`(
        h.mr_no ILIKE $${values.length} OR 
        h.supplier_name ILIKE $${values.length} OR 
        h.do_no ILIKE $${values.length} OR
        h.driver_name ILIKE $${values.length}
      )`);
    }

    if (whereConditions.length > 0) {
      queryText += ` AND ` + whereConditions.join(' AND ');
    }

    queryText += ` GROUP BY h.id ORDER BY h.id DESC LIMIT 100;`;

    const result = await pool.query(queryText, values);
    return NextResponse.json({ success: true, data: result.rows });
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
    const {
      mrNo,
      supplierId,
      supplierName,
      doNo = '',
      driverName = '',
      vehicleNo = '',
      whName = 'Gudang Utama Dapur',
      description = '',
      items = [],
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Wajib menginput minimal 1 item barang yang diterima' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Generate MR No if not provided
    const receiptNo = mrNo || `MR-EXP-${Date.now().toString().slice(-6)}`;

    // Insert Header
    const insertHeaderSql = `
      INSERT INTO t_material_receive_header (
        mr_no, supplier_id, supplier_name, do_no, driver_name, vehicle_no, wh_name, description, is_express
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING id;
    `;

    const headerRes = await client.query(insertHeaderSql, [
      receiptNo,
      supplierId ? parseInt(supplierId) : null,
      supplierName || 'Supplier Umum',
      doNo,
      driverName,
      vehicleNo,
      whName,
      description,
    ]);

    const headerId = headerRes.rows[0].id;

    // Insert Line Items & Increment Inventory Stock in m_inventory
    for (const item of items) {
      const { inventoryId, barcode, inventoryNo, inventoryName, uomName, qty, itemDescription = '' } = item;
      const parsedQty = parseInt(qty) || 1;

      // Insert Detail
      await client.query(`
        INSERT INTO t_material_receive_detail (
          header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
      `, [
        headerId,
        inventoryId ? parseInt(inventoryId) : null,
        barcode || '',
        inventoryNo || '',
        inventoryName || 'Barang Dapur',
        uomName || 'PCS',
        parsedQty,
        itemDescription,
      ]);

      // Update Inventory Stock in m_inventory
      if (inventoryId) {
        await client.query(`
          UPDATE m_inventory SET
            stok_update = COALESCE(stok_update, 0) + $1,
            modified_date = CURRENT_TIMESTAMP
          WHERE id = $2;
        `, [parsedQty, parseInt(inventoryId)]);
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Penerimaan Barang Ekspress ${receiptNo} berhasil disimpan & stok diperbarui!`,
      id: headerId,
      mrNo: receiptNo,
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
