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
      is_express BOOLEAN DEFAULT FALSE,
      is_void BOOLEAN DEFAULT FALSE,
      created_by VARCHAR(100) DEFAULT 'Admin'
    );

    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS po_no VARCHAR(100);
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS payment_type VARCHAR(50) DEFAULT 'TEMPO';
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS due_date VARCHAR(50);
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS down_payment NUMERIC(18,2) DEFAULT 0;
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS disc_percentage NUMERIC(5,2) DEFAULT 0;
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS disc_value NUMERIC(18,2) DEFAULT 0;
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS ppn_percentage NUMERIC(5,2) DEFAULT 11;
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS ppn_value NUMERIC(18,2) DEFAULT 0;
    ALTER TABLE t_material_receive_header ADD COLUMN IF NOT EXISTS grand_total NUMERIC(18,2) DEFAULT 0;

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

    ALTER TABLE t_material_receive_detail ADD COLUMN IF NOT EXISTS price NUMERIC(18,2) DEFAULT 0;
    ALTER TABLE t_material_receive_detail ADD COLUMN IF NOT EXISTS disc_percentage NUMERIC(5,2) DEFAULT 0;
    ALTER TABLE t_material_receive_detail ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18,2) DEFAULT 0;

    CREATE TABLE IF NOT EXISTS m_hpp_history (
      id SERIAL PRIMARY KEY,
      inventory_id INT REFERENCES m_inventory(id) ON DELETE CASCADE,
      mr_no VARCHAR(100),
      mr_date VARCHAR(50),
      supplier_name VARCHAR(255),
      hpp NUMERIC(18,2) NOT NULL,
      price_buy NUMERIC(18,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed Priced Goods Receipts if count < 5
  const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM t_material_receive_header WHERE (is_express = FALSE OR is_express IS NULL);`);
  if (countRes.rows[0].count < 5) {
    const supRes = await pool.query(`SELECT id, supplier_name FROM m_supplier WHERE supplier_name != '-' ORDER BY id ASC LIMIT 10;`);
    const invRes = await pool.query(`SELECT id, barcode, inventory_no, inventory_name FROM m_inventory ORDER BY id ASC LIMIT 20;`);

    const sups = supRes.rows.length > 0 ? supRes.rows : [{ id: 1, supplier_name: 'PT. Maspion Group Indonesia' }];
    const invs = invRes.rows.length > 0 ? invRes.rows : [{ id: 1, barcode: '8991001', inventory_no: 'INV-001', inventory_name: 'Wajan Anti Lengket Maspion 30cm', uom_name: 'PCS' }];

    const seedPricedData = [
      {
        mr_no: 'MR-RCV-241101',
        po_no: 'PO-2026-0801',
        supplier_id: sups[0]?.id || 1,
        supplier_name: sups[0]?.supplier_name || 'PT. Maspion Group Indonesia',
        do_no: 'DO-MSP-9912',
        driver_name: 'Bpk. Bambang',
        vehicle_no: 'L 9123 AB',
        wh_name: 'Gudang Utama Dapur',
        payment_type: 'TEMPO',
        due_date: '2026-09-05',
        down_payment: 1000000,
        disc_percentage: 5,
        ppn_percentage: 11,
        description: 'Penerimaan Resmi Cookware & Set Panci Dapur',
        items: [
          { inv: invs[0], qty: 20, price: 175000, disc: 0 },
          { inv: invs[1] || invs[0], qty: 10, price: 250000, disc: 0 },
        ],
      },
      {
        mr_no: 'MR-RCV-241102',
        po_no: 'PO-2026-0802',
        supplier_id: sups[1]?.id || sups[0]?.id || 1,
        supplier_name: sups[1]?.supplier_name || 'PT. RKM Kitchenware Industries',
        do_no: 'DO-RKM-4490',
        driver_name: 'Bpk. Herman',
        vehicle_no: 'B 9481 UJ',
        wh_name: 'Gudang Utama Dapur',
        payment_type: 'CASH',
        due_date: '2026-08-05',
        down_payment: 0,
        disc_percentage: 2,
        ppn_percentage: 11,
        description: 'Penerimaan Peralatan Stainless Cutlery Resto',
        items: [
          { inv: invs[2] || invs[0], qty: 50, price: 35000, disc: 0 },
          { inv: invs[3] || invs[0], qty: 50, price: 42000, disc: 0 },
        ],
      },
      {
        mr_no: 'MR-RCV-241103',
        po_no: 'PO-2026-0803',
        supplier_id: sups[2]?.id || sups[0]?.id || 1,
        supplier_name: sups[2]?.supplier_name || 'PT. Paramount Kitchen Solutions',
        do_no: 'DO-PRM-9910',
        driver_name: 'Bpk. Joko Susilo',
        vehicle_no: 'L 8821 CD',
        wh_name: 'Gudang Utama Dapur',
        payment_type: 'TEMPO',
        due_date: '2026-09-15',
        down_payment: 2500000,
        disc_percentage: 0,
        ppn_percentage: 11,
        description: 'Penerimaan Kompor Resto & Wok Heavy Duty',
        items: [
          { inv: invs[4] || invs[0], qty: 3, price: 2850000, disc: 5 },
          { inv: invs[5] || invs[0], qty: 5, price: 1450000, disc: 0 },
        ],
      },
      {
        mr_no: 'MR-RCV-241104',
        po_no: 'PO-2026-0804',
        supplier_id: sups[3]?.id || sups[0]?.id || 1,
        supplier_name: sups[3]?.supplier_name || 'PT. Presindo Central Utamaindo',
        do_no: 'DO-PRS-6621',
        driver_name: 'Bpk. Rudi',
        vehicle_no: 'D 1289 XY',
        wh_name: 'Gudang Utama Dapur',
        payment_type: 'TEMPO',
        due_date: '2026-09-20',
        down_payment: 0,
        disc_percentage: 3,
        ppn_percentage: 11,
        description: 'Penerimaan Piring & Mangkok Saji Catering',
        items: [
          { inv: invs[6] || invs[0], qty: 40, price: 48000, disc: 0 },
          { inv: invs[7] || invs[0], qty: 36, price: 65000, disc: 0 },
        ],
      },
      {
        mr_no: 'MR-RCV-241105',
        po_no: 'PO-2026-0805',
        supplier_id: sups[4]?.id || sups[0]?.id || 1,
        supplier_name: sups[4]?.supplier_name || 'PT. Modena Indonesia Appliance',
        do_no: 'DO-MOD-2291',
        driver_name: 'Bpk. Michael',
        vehicle_no: 'B 3341 MOD',
        wh_name: 'Gudang Utama Dapur',
        payment_type: 'TRANSFER',
        due_date: '2026-08-30',
        down_payment: 5000000,
        disc_percentage: 5,
        ppn_percentage: 11,
        description: 'Penerimaan Exhaust Hood & Commercial Oven',
        items: [
          { inv: invs[8] || invs[0], qty: 2, price: 4500000, disc: 0 },
          { inv: invs[9] || invs[0], qty: 4, price: 2100000, disc: 0 },
        ],
      },
    ];

    for (const data of seedPricedData) {
      let rawSubtotal = 0;
      const parsedItems = data.items.map((it) => {
        const sub = it.qty * it.price * (1 - it.disc / 100);
        rawSubtotal += sub;
        return { ...it, sub };
      });

      const discValue = rawSubtotal * (data.disc_percentage / 100);
      const afterDiscSub = rawSubtotal - discValue;
      const ppnValue = afterDiscSub * (data.ppn_percentage / 100);
      const grandTotal = afterDiscSub + ppnValue;

      const headerRes = await pool.query(`
        INSERT INTO t_material_receive_header (
          mr_no, po_no, supplier_id, supplier_name, do_no, driver_name, vehicle_no, wh_name,
          payment_type, due_date, down_payment, disc_percentage, disc_value, ppn_percentage, ppn_value, grand_total,
          description, is_express
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, FALSE
        ) ON CONFLICT (mr_no) DO NOTHING
        RETURNING id;
      `, [
        data.mr_no,
        data.po_no,
        data.supplier_id,
        data.supplier_name,
        data.do_no,
        data.driver_name,
        data.vehicle_no,
        data.wh_name,
        data.payment_type,
        data.due_date,
        data.down_payment,
        data.disc_percentage,
        discValue,
        data.ppn_percentage,
        ppnValue,
        grandTotal,
        data.description,
      ]);

      if (headerRes.rows.length > 0) {
        const headerId = headerRes.rows[0].id;
        const todayStr = new Date().toISOString().slice(0, 10);
        for (const itemData of parsedItems) {
          const item = itemData.inv;
          await pool.query(`
            INSERT INTO t_material_receive_detail (
              header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, price, disc_percentage, subtotal, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
          `, [
            headerId,
            item.id,
            item.barcode || '',
            item.inventory_no || '',
            item.inventory_name,
            item.uom_name || 'PCS',
            itemData.qty,
            itemData.price,
            itemData.disc,
            itemData.sub,
            'Kondisi mulus',
          ]);

          // Update inventory hpp & price_buy
          await pool.query(`
            UPDATE m_inventory SET
              stok_update = COALESCE(stok_update, 0) + $1,
              hpp = $2,
              price_buy = $2,
              modified_date = CURRENT_TIMESTAMP
            WHERE id = $3;
          `, [itemData.qty, itemData.price, item.id]);

          // Insert into m_hpp_history
          await pool.query(`
            INSERT INTO m_hpp_history (
              inventory_id, mr_no, mr_date, supplier_name, hpp, price_buy
            ) VALUES ($1, $2, $3, $4, $5, $5);
          `, [item.id, data.mr_no, todayStr, data.supplier_name, itemData.price]);
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
        h.po_no AS "poNo",
        h.do_no AS "doNo",
        h.driver_name AS "driverName",
        h.vehicle_no AS "vehicleNo",
        h.wh_name AS "whName",
        h.payment_type AS "paymentType",
        h.due_date AS "dueDate",
        h.down_payment::float AS "downPayment",
        h.disc_percentage::float AS "discPercentage",
        h.disc_value::float AS "discValue",
        h.ppn_percentage::float AS "ppnPercentage",
        h.ppn_value::float AS "ppnValue",
        h.grand_total::float AS "grandTotal",
        h.description,
        h.is_express AS "isExpress",
        h.is_void AS "isVoid",
        COALESCE(SUM(d.qty), 0)::int AS "totalQty",
        COUNT(d.id)::int AS "itemCount"
      FROM t_material_receive_header h
      LEFT JOIN t_material_receive_detail d ON h.id = d.header_id
      WHERE (h.is_express = FALSE OR h.is_express IS NULL)
    `;

    const whereConditions: string[] = [];
    const values: string[] = [];

    if (q) {
      values.push(`%${q}%`);
      whereConditions.push(`(
        h.mr_no ILIKE $${values.length} OR 
        h.supplier_name ILIKE $${values.length} OR 
        h.po_no ILIKE $${values.length} OR
        h.do_no ILIKE $${values.length}
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
      poNo = '',
      doNo = '',
      driverName = '',
      vehicleNo = '',
      whName = 'Gudang Utama Dapur',
      paymentType = 'TEMPO',
      dueDate = '',
      downPayment = 0,
      discPercentage = 0,
      ppnPercentage = 11,
      description = '',
      items = [],
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Wajib menginput minimal 1 item barang yang diterima' }, { status: 400 });
    }

    await client.query('BEGIN');

    // Generate MR No
    const receiptNo = mrNo || `MR-RCV-${Date.now().toString().slice(-6)}`;

    // Calculate Items Subtotal
    let rawSubtotal = 0;
    const parsedItems = items.map((it: { qty: number; price: number; discPercentage?: number }) => {
      const qty = parseInt(String(it.qty)) || 1;
      const price = parseFloat(String(it.price)) || 0;
      const disc = parseFloat(String(it.discPercentage)) || 0;
      const lineSubtotal = qty * price * (1 - disc / 100);
      rawSubtotal += lineSubtotal;
      return { ...it, qty, price, disc, lineSubtotal };
    });

    const parsedDiscPerc = parseFloat(String(discPercentage)) || 0;
    const discValue = rawSubtotal * (parsedDiscPerc / 100);
    const afterDiscSubtotal = rawSubtotal - discValue;

    const parsedPpnPerc = parseFloat(String(ppnPercentage)) || 0;
    const ppnValue = afterDiscSubtotal * (parsedPpnPerc / 100);
    const grandTotal = afterDiscSubtotal + ppnValue;

    // Insert Header
    const insertHeaderSql = `
      INSERT INTO t_material_receive_header (
        mr_no, supplier_id, supplier_name, po_no, do_no, driver_name, vehicle_no, wh_name,
        payment_type, due_date, down_payment, disc_percentage, disc_value, ppn_percentage, ppn_value, grand_total,
        description, is_express
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, FALSE
      ) RETURNING id;
    `;

    const headerRes = await client.query(insertHeaderSql, [
      receiptNo,
      supplierId ? parseInt(supplierId) : null,
      supplierName || 'Supplier Umum',
      poNo,
      doNo,
      driverName,
      vehicleNo,
      whName,
      paymentType,
      dueDate,
      parseFloat(String(downPayment)),
      parsedDiscPerc,
      discValue,
      parsedPpnPerc,
      ppnValue,
      grandTotal,
      description,
    ]);

    const headerId = headerRes.rows[0].id;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Insert Line Items, Update Inventory Stock & HPP, and Log to m_hpp_history
    for (const item of parsedItems) {
      const { inventoryId, barcode, inventoryNo, inventoryName, uomName, qty, price, disc, lineSubtotal, itemDescription = '' } = item;

      // Insert Detail
      await client.query(`
        INSERT INTO t_material_receive_detail (
          header_id, inventory_id, barcode, inventory_no, inventory_name, uom_name, qty, price, disc_percentage, subtotal, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
      `, [
        headerId,
        inventoryId ? parseInt(inventoryId) : null,
        barcode || '',
        inventoryNo || '',
        inventoryName || 'Barang Dapur',
        uomName || 'PCS',
        qty,
        price,
        disc,
        lineSubtotal,
        itemDescription,
      ]);

      // Update Inventory Stock & HPP / PriceBuy in m_inventory
      if (inventoryId) {
        await client.query(`
          UPDATE m_inventory SET
            stok_update = COALESCE(stok_update, 0) + $1,
            hpp = $2,
            price_buy = $2,
            modified_date = CURRENT_TIMESTAMP
          WHERE id = $3;
        `, [qty, price, parseInt(inventoryId)]);

        // Log to m_hpp_history (sp_MDInventory_GetHPPHistory)
        await client.query(`
          INSERT INTO m_hpp_history (
            inventory_id, mr_no, mr_date, supplier_name, hpp, price_buy
          ) VALUES ($1, $2, $3, $4, $5, $5);
        `, [parseInt(inventoryId), receiptNo, todayStr, supplierName || 'Supplier Umum', price]);
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Penerimaan Barang dengan Harga ${receiptNo} berhasil disimpan & HPP diperbarui!`,
      id: headerId,
      mrNo: receiptNo,
      grandTotal,
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
