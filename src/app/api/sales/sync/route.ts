import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 100, 2000);

    // History mode
    if (mode === 'history') {
      const whereCondition = { whName: 'POS_SYNC' };
      const [total, usageLogs] = await Promise.all([
        prisma.inventoryUsageHeader.count({ where: whereCondition }),
        prisma.inventoryUsageHeader.findMany({
          where: whereCondition,
          include: { details: true },
          orderBy: { createdAt: 'desc' },
          skip: paginationParams.skip,
          take: paginationParams.limit,
        }),
      ]);

      const historyData = usageLogs.map((log) => {
        const totalItems = log.details.length;
        const totalQty = log.details.reduce((acc, d) => acc + d.qty, 0);

        return {
          id: log.id.toString(),
          syncNo: log.usageNo,
          syncDate: log.usageDate.toISOString().replace('T', ' ').substring(0, 19),
          totalItems,
          totalQty,
          status: 'COMPLETED',
          createdBy: log.description || 'Super Administrator ERP',
        };
      });

      return createPaginatedResponse(historyData, total, paginationParams);
    }

    // Fetch master inventory items
    const whereCondition = q
      ? {
          OR: [
            { barcode: { contains: q, mode: 'insensitive' as const } },
            { inventoryNo: { contains: q, mode: 'insensitive' as const } },
            { inventoryName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, inventories] = await Promise.all([
      prisma.inventory.count({ where: whereCondition }),
      prisma.inventory.findMany({
        where: whereCondition,
        include: {
          category: true,
          uom: true,
        },
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    // Fetch POS sales quantities per inventory item across database
    const { Client } = require('pg');
    const posClient = new Client({
      connectionString: process.env.POS_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public"
    });
    
    await posClient.connect();
    await posClient.query('SET search_path TO pos, public;');
    
    const posRes = await posClient.query(`
      SELECT "productId", SUM(quantity) as "totalQty" 
      FROM "TransactionItem" 
      WHERE "isSynced" = false AND "isVoided" = false
      GROUP BY "productId"
    `);
    
    const posProducts = await posClient.query(`
      SELECT id, barcode FROM "Product"
    `);
    
    await posClient.end();

    const productBarcodeMap: Record<string, string> = {};
    posProducts.rows.forEach((p: any) => {
      productBarcodeMap[p.id] = p.barcode;
    });

    const posQtyMap: Record<string, number> = {};
    posRes.rows.forEach((row: any) => {
      const barcode = productBarcodeMap[row.productId];
      if (barcode) {
        posQtyMap[barcode] = parseInt(row.totalQty, 10);
      }
    });

    const mappedData = inventories.map((inv) => {
      const qtyPos = posQtyMap[inv.inventoryNo] || posQtyMap[inv.barcode] || 0;
      const stokGudang = inv.stock;
      const stokSetelahSync = Math.max(0, stokGudang - qtyPos);

      return {
        id: inv.id.toString(),
        inventoryNo: inv.inventoryNo,
        barcode: inv.barcode,
        inventoryName: inv.inventoryName,
        uomName: inv.uom?.uomName || inv.category?.categoryName || 'Pcs',
        stokGudang: stokGudang,
        qtyTransaksi: qtyPos,
        stokSetelahSync: stokSetelahSync,
        isChecked: true,
      };
    });

    return createPaginatedResponse(mappedData, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/sales/sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada item yang dipilih untuk sinkronisasi' },
        { status: 400 }
      );
    }

    // Filter items that actually have pending POS sales transactions to sync
    const itemsToSync = items.filter(
      (item: any) => (item.qtyTransaksi || 0) > 0 || (item.stokGudang || 0) !== (item.stokSetelahSync || 0)
    );

    if (itemsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada selisih Qty Penjualan POS pada item yang dipilih (stok gudang sudah sesuai).',
      });
    }

    const now = new Date();
    const syncNo = `SYNC-POS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    await prisma.$transaction(
      async (tx) => {
        // 1. Update inventory stocks in parallel chunks of 50 to avoid timeout
        const CHUNK_SIZE = 50;
        for (let i = 0; i < itemsToSync.length; i += CHUNK_SIZE) {
          const chunk = itemsToSync.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map((item: any) => {
              const invId = parseInt(item.id, 10);
              if (isNaN(invId)) return Promise.resolve();
              const newStock = Math.max(0, (item.stokGudang || 0) - (item.qtyTransaksi || 0));
              return tx.inventory.update({
                where: { id: invId },
                data: { stock: newStock },
              });
            })
          );
        }

        // 2. Create Audit Sync Log in InventoryUsageHeader & Details
        await tx.inventoryUsageHeader.create({
          data: {
            usageNo: syncNo,
            usageDate: now,
            whName: 'POS_SYNC',
            description: 'Sinkronisasi Stok Penjualan POS Kasir ERP',
            details: {
              create: itemsToSync.map((item: any) => ({
                barcode: item.barcode || '',
                inventoryNo: item.inventoryNo || '',
                inventoryName: item.inventoryName || '',
                qty: item.qtyTransaksi || 0,
                uomName: item.uomName || 'Pcs',
                notes: `Sync stok POS: ${item.stokGudang} -> ${item.stokSetelahSync}`,
              })),
            },
          },
        });
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );

    // 3. Update POS database to mark items as synced
    const { Client } = require('pg');
    const posClient = new Client({
      connectionString: process.env.POS_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public"
    });
    
    await posClient.connect();
    await posClient.query('SET search_path TO pos, public;');
    const barcodes = itemsToSync.map((item: any) => `'${item.barcode}'`).join(',');
    
    if (barcodes.length > 0) {
      await posClient.query(`
        UPDATE "TransactionItem"
        SET "isSynced" = true, "syncDate" = NOW()
        FROM "Product"
        WHERE "TransactionItem"."productId" = "Product".id
        AND "TransactionItem"."isSynced" = false
        AND "TransactionItem"."isVoided" = false
        AND "Product".barcode IN (${barcodes})
      `);
    }
    await posClient.end();

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${itemsToSync.length} item stok POS dengan Gudang ERP (${syncNo}).`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/sales/sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
