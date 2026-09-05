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
      const whereCondition = { memotype: 'POS_SYNC' };
      const [total, usageLogs] = await Promise.all([
        prisma.t_memoheader.count({ where: whereCondition }),
        prisma.t_memoheader.findMany({
          where: whereCondition,
          include: { t_memodetail: true },
          orderBy: { createddate: 'desc' },
          skip: paginationParams.skip,
          take: paginationParams.limit,
        }),
      ]);

      const historyData = usageLogs.map((log: any) => {
        const totalItems = log.t_memodetail.length;
        const totalQty = log.t_memodetail.reduce((acc: number, d: any) => acc + Number(d.qty), 0);

        return {
          id: String(log.id),
          syncNo: log.memocode,
          syncDate: log.createddate ? log.createddate.toISOString().replace('T', ' ').substring(0, 19) : '-',
          totalItems,
          totalQty,
          status: 'COMPLETED',
          createdBy: log.remarks || 'Super Administrator ERP',
        };
      });

      return createPaginatedResponse(historyData, total, paginationParams);
    }

    // Unsynced mode
    // Find all unsynced POS details
    const unsyncedDetails = await prisma.t_salesposdetail.findMany({
      where: { issync: false },
    });

    const qtyMap = new Map<number, number>();
    unsyncedDetails.forEach((d: any) => {
      const current = qtyMap.get(d.inventoryid) || 0;
      qtyMap.set(d.inventoryid, current + Number(d.qty || 0));
    });

    const inventoryIds = Array.from(qtyMap.keys());
    
    // Fetch master inventory items that need sync OR match query
    let whereCondition: any = {};
    if (q) {
      whereCondition.OR = [
        { barcode: { contains: q, mode: 'insensitive' as const } },
        { inventoryno: { contains: q, mode: 'insensitive' as const } },
        { inventoryname: { contains: q, mode: 'insensitive' as const } },
      ];
    } else {
      whereCondition.id = { in: inventoryIds }; // Optimize default load
    }

    const [total, inventories] = await Promise.all([
      prisma.inventory.count({ where: whereCondition }),
      prisma.inventory.findMany({
        where: whereCondition,
        include: { m_uom: true },
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mappedData = inventories.map((inv: any) => {
      const qtyPos = qtyMap.get(inv.id) || 0;
      const stokGudang = inv.stokupdate || 0;
      const stokSetelahSync = Math.max(0, stokGudang - qtyPos);

      return {
        id: String(inv.id),
        inventoryNo: inv.inventoryno,
        barcode: inv.barcode,
        inventoryName: inv.inventoryname,
        uomName: inv.m_uom?.uomname || 'Pcs',
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
      return NextResponse.json({ success: false, error: 'Tidak ada item yang dipilih untuk sinkronisasi' }, { status: 400 });
    }

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

    const idsToSync = itemsToSync.map((i: any) => parseInt(i.id, 10)).filter(id => !isNaN(id));

    await prisma.$transaction(
      async (tx) => {
        // 1. Update stock
        for (const item of itemsToSync) {
          const invId = parseInt(item.id, 10);
          if (isNaN(invId)) continue;
          const newStock = Math.max(0, (item.stokGudang || 0) - (item.qtyTransaksi || 0));
          await tx.inventory.update({
            where: { id: invId },
            data: { stokupdate: newStock },
          });
        }

        // 2. Create Audit log using Memo
        await tx.t_memoheader.create({
          data: {
            memocode: syncNo,
            memodate: now,
            memotype: 'POS_SYNC',
            remarks: 'Sinkronisasi Stok Penjualan POS Kasir ERP',
            createduser: 'system',
            createddate: now,
            modifieduser: 'system',
            modifieddate: now,
            t_memodetail: {
              create: itemsToSync.map((item: any) => ({
                inventoryid: parseInt(item.id, 10),
                qty: item.qtyTransaksi || 0,
                uom: item.uomName || 'Pcs',
                remarks: `Sync stok POS: ${item.stokGudang} -> ${item.stokSetelahSync}`,
                createduser: 'system',
                createddate: now,
                modifieduser: 'system',
                modifieddate: now,
              })),
            },
          },
        });

        // 3. Mark POS as synced
        if (idsToSync.length > 0) {
          await tx.t_salesposdetail.updateMany({
            where: {
              inventoryid: { in: idsToSync },
              issync: false,
            },
            data: {
              issync: true,
              syncdate: now,
            },
          });
        }
      },
      { maxWait: 15000, timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${itemsToSync.length} item stok POS dengan Gudang ERP (${syncNo}).`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/sales/sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
