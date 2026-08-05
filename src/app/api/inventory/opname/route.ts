import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

async function initOpnameTablesAndSeed() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.t_opname_header (
        id SERIAL PRIMARY KEY,
        no_transaction VARCHAR(50) UNIQUE NOT NULL,
        opname_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        warehouse VARCHAR(100) DEFAULT 'Harmoni',
        total_items INT DEFAULT 0,
        total_qty INT DEFAULT 0,
        remarks TEXT,
        created_by VARCHAR(100) DEFAULT 'SA',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS public.t_opname_detail (
        id SERIAL PRIMARY KEY,
        opname_id INT REFERENCES public.t_opname_header(id) ON DELETE CASCADE,
        no_transaction VARCHAR(50) NOT NULL,
        inventory_id INT,
        barcode VARCHAR(100),
        inventory_no VARCHAR(100),
        inventory_name VARCHAR(255),
        qty INT NOT NULL DEFAULT 0,
        price NUMERIC(15, 2) DEFAULT 0,
        description TEXT,
        modified_user VARCHAR(100) DEFAULT 'SA',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE public.t_opname_detail DROP CONSTRAINT IF EXISTS t_opname_detail_inventory_id_fkey;
    `);

    // Check count of opname headers
    const checkHead = await pool.query(`SELECT COUNT(*) FROM public.t_opname_header`);
    if (parseInt(checkHead.rows[0].count, 10) < 3 || true) {
      const checkReal = await pool.query(`SELECT COUNT(*) FROM public.t_opname_detail WHERE barcode LIKE '0000%' OR barcode LIKE '69%'`);
      if (parseInt(checkReal.rows[0].count, 10) === 0) {
        await pool.query(`TRUNCATE public.t_opname_detail, public.t_opname_header RESTART IDENTITY CASCADE;`);
      }
    }

    const checkFinal = await pool.query(`SELECT COUNT(*) FROM public.t_opname_header`);
    if (parseInt(checkFinal.rows[0].count, 10) === 0) {

      // Fetch real inventory items from m_inventory
      const invRes = await pool.query(`
        SELECT id, inventory_no, barcode, inventory_name, price, stok_update
        FROM public.m_inventory
        WHERE barcode IS NOT NULL AND barcode != '' AND inventory_name IS NOT NULL
        ORDER BY id DESC
        LIMIT 20;
      `);

      const items = invRes.rows;

      if (items.length >= 5) {
        // 1. Transaction 1: Opname Awal Bulan
        const tx1No = 'OPN/2026/08/001';
        const tx1Items = items.slice(0, 5);
        const totalQty1 = tx1Items.reduce((acc, item) => acc + (item.stok_update || 10), 0);

        const head1 = await pool.query(`
          INSERT INTO public.t_opname_header (no_transaction, warehouse, total_items, total_qty, remarks, created_by, opname_date)
          VALUES ($1, 'Gudang Utama Harmoni', $2, $3, 'Opname Persediaan Bulanan Utama', 'SA', '2026-08-01 09:00:00')
          RETURNING id;
        `, [tx1No, tx1Items.length, totalQty1]);
        const id1 = head1.rows[0].id;

        for (const it of tx1Items) {
          await pool.query(`
            INSERT INTO public.t_opname_detail (opname_id, no_transaction, inventory_id, barcode, inventory_no, inventory_name, qty, price, description, modified_user)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Opname Fisik Gudang Utama', 'SA');
          `, [
            id1,
            tx1No,
            it.id,
            it.barcode,
            it.inventory_no || '-',
            it.inventory_name,
            it.stok_update || 10,
            it.price || 0,
          ]);
        }

        // 2. Transaction 2: Opname Peralatan Dapur
        if (items.length >= 10) {
          const tx2No = 'OPN/2026/08/002';
          const tx2Items = items.slice(5, 10);
          const totalQty2 = tx2Items.reduce((acc, item) => acc + Math.max(1, item.stok_update || 5), 0);

          const head2 = await pool.query(`
            INSERT INTO public.t_opname_header (no_transaction, warehouse, total_items, total_qty, remarks, created_by, opname_date)
            VALUES ($1, 'Gudang Peralatan Dapur', $2, $3, 'Opname Rutin Mingguan Peralatan', 'SA', '2026-08-03 14:15:00')
            RETURNING id;
          `, [tx2No, tx2Items.length, totalQty2]);
          const id2 = head2.rows[0].id;

          for (const it of tx2Items) {
            await pool.query(`
              INSERT INTO public.t_opname_detail (opname_id, no_transaction, inventory_id, barcode, inventory_no, inventory_name, qty, price, description, modified_user)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Penyesuaian Fisik Mingguan', 'SA');
            `, [
              id2,
              tx2No,
              it.id,
              it.barcode,
              it.inventory_no || '-',
              it.inventory_name,
              Math.max(1, it.stok_update || 5),
              it.price || 0,
            ]);
          }
        }

        // 3. Transaction 3: Opname Bahan Baku & Melamin
        if (items.length >= 15) {
          const tx3No = 'OPN/2026/08/003';
          const tx3Items = items.slice(10, 15);
          const totalQty3 = tx3Items.reduce((acc, item) => acc + Math.max(1, (item.stok_update || 12) + 2), 0);

          const head3 = await pool.query(`
            INSERT INTO public.t_opname_header (no_transaction, warehouse, total_items, total_qty, remarks, created_by, opname_date)
            VALUES ($1, 'Gudang Bahan Baku', $2, $3, 'Stock Audit & Opname Melamin', 'SA', '2026-08-05 10:30:00')
            RETURNING id;
          `, [tx3No, tx3Items.length, totalQty3]);
          const id3 = head3.rows[0].id;

          for (const it of tx3Items) {
            await pool.query(`
              INSERT INTO public.t_opname_detail (opname_id, no_transaction, inventory_id, barcode, inventory_no, inventory_name, qty, price, description, modified_user)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Hasil Stock Opname Audit', 'SA');
            `, [
              id3,
              tx3No,
              it.id,
              it.barcode,
              it.inventory_no || '-',
              it.inventory_name,
              Math.max(1, (it.stok_update || 12) + 2),
              it.price || 0,
            ]);
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to init opname tables & seed:', err);
  }
}

export async function GET(request: Request) {
  try {
    await initOpnameTablesAndSeed();
    const { searchParams } = new URL(request.url);
    const noTx = searchParams.get('noTx');

    if (noTx) {
      // Fetch details for specific transaction
      const detailRes = await pool.query(`
        SELECT 
          d.id,
          d.no_transaction AS "noTransaction",
          d.inventory_id AS "inventoryId",
          d.barcode,
          d.inventory_no AS "inventoryNo",
          d.inventory_name AS "inventoryName",
          d.qty,
          d.price,
          d.description,
          d.modified_user AS "modifiedUser",
          d.created_at AS "createdAt"
        FROM public.t_opname_detail d
        WHERE d.no_transaction = $1
        ORDER BY d.id ASC
      `, [noTx]);

      return NextResponse.json({ success: true, data: detailRes.rows });
    }

    // Fetch history list (headers)
    const historyRes = await pool.query(`
      SELECT 
        h.id,
        h.no_transaction AS "noTransaction",
        h.opname_date AS "opnameDate",
        h.warehouse,
        h.total_items AS "totalItems",
        h.total_qty AS "totalQty",
        h.remarks,
        h.created_by AS "createdBy"
      FROM public.t_opname_header h
      ORDER BY h.id DESC
    `);

    return NextResponse.json({ success: true, data: historyRes.rows });
  } catch (error: any) {
    console.error('Error fetching opname data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initOpnameTablesAndSeed();
    const body = await request.json();
    const {
      noTransaction,
      warehouse = 'Gudang Utama Harmoni',
      items = [],
      createdBy = 'SA',
      remarks = ''
    } = body;

    // Single item instant update fallback (backwards compatibility)
    if (!items || items.length === 0) {
      const { inventoryId, qtyOpname } = body;
      if (!inventoryId || qtyOpname === undefined) {
        return NextResponse.json({ success: false, error: 'inventoryId and qtyOpname are required' }, { status: 400 });
      }

      await pool.query(
        `UPDATE m_inventory SET stok_update = $1 WHERE id = $2`,
        [parseInt(qtyOpname), parseInt(inventoryId)]
      );

      return NextResponse.json({
        success: true,
        message: `Opname berhasil! Stok fisik diperbarui menjadi ${qtyOpname}`,
      });
    }

    // Full Opname Transaction Submission (1:1 with Module Manager)
    const txNo = noTransaction || `OPN/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${Date.now().toString().slice(-4)}`;

    const totalQty = items.reduce((acc: number, item: any) => acc + (parseInt(item.qty) || 0), 0);
    const totalItems = items.length;

    const headRes = await pool.query(`
      INSERT INTO public.t_opname_header (no_transaction, warehouse, total_items, total_qty, remarks, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, no_transaction AS "noTransaction", opname_date AS "opnameDate";
    `, [txNo, warehouse, totalItems, totalQty, remarks, createdBy]);

    const opId = headRes.rows[0].id;

    for (const item of items) {
      await pool.query(`
        INSERT INTO public.t_opname_detail (
          opname_id, no_transaction, inventory_id, barcode, inventory_no, inventory_name, qty, price, description, modified_user
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        opId,
        txNo,
        item.inventoryId || item.id,
        item.barcode || '',
        item.inventoryNo || '',
        item.inventoryName || '',
        parseInt(item.qty) || 0,
        parseFloat(item.price) || 0,
        item.description || 'Input Stok Opname',
        createdBy
      ]);

      // Update actual stock in m_inventory
      if (item.inventoryId || item.id) {
        await pool.query(`
          UPDATE m_inventory SET stok_update = $1 WHERE id = $2
        `, [parseInt(item.qty) || 0, item.inventoryId || item.id]);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: opId,
        noTransaction: txNo,
        message: `Transaksi Opname ${txNo} berhasil disimpan! (${totalItems} item, total qty: ${totalQty})`
      }
    });
  } catch (error: any) {
    console.error('Error submitting opname transaction:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
