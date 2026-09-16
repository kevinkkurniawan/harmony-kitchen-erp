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
      const whereCondition: any = { title: { contains: 'POS_SYNC', mode: 'insensitive' as const } };
      const [total, memos] = await Promise.all([
        prisma.memo.count({ where: whereCondition }),
        prisma.memo.findMany({
          where: whereCondition,
          orderBy: { createdAt: 'desc' },
          skip: paginationParams.skip,
          take: paginationParams.limit,
        }),
      ]);

      const historyData = memos.map((log: any) => ({
        id: String(log.id),
        syncNo: log.memoNo,
        syncDate: log.createdAt ? log.createdAt.toISOString().replace('T', ' ').substring(0, 19) : '-',
        totalItems: 0,
        totalQty: 0,
        status: 'COMPLETED',
        createdBy: log.author || 'Super Administrator ERP',
      }));

      return createPaginatedResponse(historyData, total, paginationParams);
    }

    // Unsynced mode (POS transactions decrement stock atomically at checkout; return inventory list)
    let whereCondition: any = {};
    if (q) {
      whereCondition.OR = [
        { barcode: { contains: q, mode: 'insensitive' as const } },
        { inventoryNo: { contains: q, mode: 'insensitive' as const } },
        { inventoryName: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, inventories] = await Promise.all([
      prisma.inventory.count({ where: whereCondition }),
      prisma.inventory.findMany({
        where: whereCondition,
        include: { uom: true },
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mappedData = inventories.map((inv: any) => ({
      id: String(inv.id),
      inventoryNo: inv.inventoryNo,
      barcode: inv.barcode,
      inventoryName: inv.inventoryName,
      uomName: inv.uom?.uomName || 'Pcs',
      stokGudang: inv.stock || 0,
      qtyTransaksi: 0,
      stokSetelahSync: inv.stock || 0,
      isChecked: true,
    }));

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

    const now = new Date();
    const syncNo = `SYNC-POS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    await prisma.memo.create({
      data: {
        memoNo: syncNo,
        title: 'POS_SYNC',
        content: `Sinkronisasi stok manual untuk ${items.length} item.`,
        author: 'Super Administrator ERP',
        status: 'COMPLETED',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Sinkronisasi POS berhasil dicatat (${syncNo}).`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/sales/sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

