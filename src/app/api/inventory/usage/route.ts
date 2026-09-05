import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = { memotype: 'USAGE' };
    if (q) {
      where.OR = [
        { memocode: { contains: q, mode: 'insensitive' as const } },
        { remarks: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, headers] = await Promise.all([
      prisma.t_memoheader.count({ where }),
      prisma.t_memoheader.findMany({
        where,
        include: { t_memodetail: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const inventoryIds = Array.from(new Set(
      headers.flatMap((h: any) => h.t_memodetail.map((d: any) => d.inventoryid))
    )).filter(Boolean) as number[];
    const inventories = await prisma.inventory.findMany({ where: { id: { in: inventoryIds } } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));

    const mapped = headers.map((h: any) => ({
      id: h.id,
      usage_no: h.memocode,
      usage_date: h.memodate,
      wh_name: 'Gudang Utama',
      description: h.remarks || '',
      items: h.t_memodetail.map((d: any) => {
        const inv = inventoryMap.get(d.inventoryid);
        return {
          id: d.id,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          qty: Number(d.qty),
          uom_name: d.uom || 'PCS',
          notes: d.remarks || '',
        };
      }),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/inventory/usage:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { usage_no, usage_date, wh_name, description, items } = body;

    if (!usage_no || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Pemakaian dan detail barang wajib diisi' }, { status: 400 });
    }

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    const created = await prisma.t_memoheader.create({
      data: {
        memocode: usage_no,
        memodate: usage_date ? new Date(usage_date) : new Date(),
        memotype: 'USAGE',
        remarks: description,
        createduser: 'system',
        createddate: new Date(),
        modifieduser: 'system',
        modifieddate: new Date(),
        t_memodetail: {
          create: items.map((it: any) => ({
            inventoryid: invMapByNo.get(it.inventory_no || it.inventoryNo) || 1,
            qty: Number(it.qty) || 0,
            uom: it.uom_name || it.uomName || 'PCS',
            remarks: it.notes || null,
            createduser: 'system',
            createddate: new Date(),
            modifieduser: 'system',
            modifieddate: new Date(),
          })),
        },
      },
      include: { t_memodetail: true },
    });

    // Decrement stock for inventory items
    for (const it of items) {
      const invId = invMapByNo.get(it.inventory_no || it.inventoryNo);
      if (invId) {
        await prisma.inventory.updateMany({
          where: { id: invId },
          data: { stokupdate: { decrement: Number(it.qty) } },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, message: 'Pemakaian barang berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/usage:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
