import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = { memotype: 'RETURN' };
    if (q) {
      where.OR = [
        { memocode: { contains: q, mode: 'insensitive' as const } },
        { remarks: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, returns] = await Promise.all([
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
      returns.flatMap((r: any) => r.t_memodetail.map((d: any) => d.inventoryid))
    )).filter(Boolean) as number[];
    const inventories = await prisma.inventory.findMany({ where: { id: { in: inventoryIds } } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));

    const mapped = returns.map((r: any) => ({
      id: r.id,
      return_no: r.memocode,
      return_date: r.memodate,
      mr_no: r.memoreason, // Store MR No in memoreason
      supplier_name: 'Supplier', // Could extract from remarks or MR
      return_reason: r.remarks || '',
      created_at: r.createddate,
      items: r.t_memodetail.map((d: any) => {
        const inv = inventoryMap.get(d.inventoryid);
        return {
          id: d.id,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          qty: Number(d.qty),
        };
      }),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { return_no, return_date, mr_no, supplier_name, return_reason, items } = body;

    if (!return_no || !mr_no || !supplier_name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Retur, MR No, Supplier, dan detail item barang wajib diisi' }, { status: 400 });
    }

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    const created = await prisma.t_memoheader.create({
      data: {
        memocode: return_no,
        memodate: return_date ? new Date(return_date) : new Date(),
        memotype: 'RETURN',
        memoreason: mr_no,
        remarks: return_reason || `Retur untuk ${supplier_name}`,
        createduser: 'system',
        createddate: new Date(),
        modifieduser: 'system',
        modifieddate: new Date(),
        t_memodetail: {
          create: items.map((it: any) => ({
            inventoryid: invMapByNo.get(it.inventory_no || it.inventoryNo) || 1,
            qty: Number(it.qty) || 0,
            uom: 'Pcs',
            createduser: 'system',
            createddate: new Date(),
            modifieduser: 'system',
            modifieddate: new Date(),
          })),
        },
      },
      include: { t_memodetail: true },
    });

    // Decrement stock for returned items
    for (const it of items) {
      const invId = invMapByNo.get(it.inventory_no || it.inventoryNo);
      if (invId) {
        await prisma.inventory.updateMany({
          where: { id: invId },
          data: { stokupdate: { decrement: Number(it.qty) } },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, message: 'Retur Pembelian berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
