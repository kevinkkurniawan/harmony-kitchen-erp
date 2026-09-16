import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {};
    if (q) {
      where.OR = [
        { returnNo: { contains: q, mode: 'insensitive' as const } },
        { mrNo: { contains: q, mode: 'insensitive' as const } },
        { supplierName: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, returns] = await Promise.all([
      prisma.purchaseReturnHeader.count({ where }),
      prisma.purchaseReturnHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = returns.map((r: any) => ({
      id: r.id,
      return_no: r.returnNo,
      return_date: r.returnDate,
      mr_no: r.mrNo,
      supplier_name: r.supplierName,
      return_reason: r.returnReason || '',
      created_at: r.createdAt,
      items: r.details.map((d: any) => ({
        id: d.id,
        barcode: d.barcode,
        inventory_no: d.inventoryNo,
        inventory_name: d.inventoryName,
        qty: Number(d.qty),
      })),
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
    const inventories = await prisma.inventory.findMany({ where: { inventoryNo: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryNo, i]));

    const created = await prisma.purchaseReturnHeader.create({
      data: {
        returnNo: return_no,
        returnDate: return_date ? new Date(return_date) : new Date(),
        mrNo: mr_no,
        supplierName: supplier_name,
        returnReason: return_reason || null,
        details: {
          create: items.map((it: any) => {
            const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
            return {
              barcode: inv?.barcode || it.barcode || '',
              inventoryNo: it.inventory_no || it.inventoryNo || '',
              inventoryName: inv?.inventoryName || it.inventory_name || it.inventoryName || '',
              qty: Number(it.qty) || 0,
            };
          }),
        },
      },
      include: { details: true },
    });

    // Decrement stock for returned items
    for (const it of items) {
      const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
      if (inv) {
        await prisma.inventory.update({
          where: { id: inv.id },
          data: { stock: { decrement: Number(it.qty) } },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, message: 'Retur Pembelian berhasil disimpan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/returns:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

