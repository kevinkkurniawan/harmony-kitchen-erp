import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = q ? {
      OR: [
        { prNo: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [total, requests] = await Promise.all([
      prisma.purchaseRequestHeader.count({ where }),
      prisma.purchaseRequestHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = requests.map((pr: any) => ({
      id: pr.id,
      pr_no: pr.prNo,
      pr_date: pr.prDate,
      required_date: pr.prDate,
      description: pr.description || '',
      status: pr.status,
      created_at: pr.createdAt,
      items: pr.details.map((d: any) => ({
        id: d.id,
        barcode: d.barcode,
        inventory_no: d.inventoryNo,
        inventory_name: d.inventoryName,
        qty: Number(d.qty),
        uom_name: d.uomName || 'Pcs',
        notes: d.notes || '',
      })),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pr_no, pr_date, description, status = 'Draft', items } = body;

    const inventoryNos = (items || []).map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryNo: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryNo, i]));

    const created = await prisma.purchaseRequestHeader.create({
      data: {
        prNo: pr_no,
        prDate: pr_date ? new Date(pr_date) : new Date(),
        requestBy: 'System',
        description,
        status: status || 'Draft',
        details: {
          create: (items || []).map((it: any) => {
            const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
            return {
              barcode: inv?.barcode || it.barcode || '',
              inventoryNo: it.inventory_no || it.inventoryNo || '',
              inventoryName: inv?.inventoryName || it.inventory_name || it.inventoryName || '',
              qty: Number(it.qty) || 0,
              uomName: it.uom_name || it.uomName || 'Pcs',
              notes: it.notes || null,
            };
          }),
        },
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, pr_no, pr_date, description, status, items } = body;

    const inventoryNos = (items || []).map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryNo: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryNo, i]));

    await prisma.purchaseRequestDetail.deleteMany({ where: { headerId: Number(id) } });

    const updated = await prisma.purchaseRequestHeader.update({
      where: { id: Number(id) },
      data: {
        prNo: pr_no,
        prDate: pr_date ? new Date(pr_date) : undefined,
        description,
        status: status || 'Draft',
        details: {
          create: (items || []).map((it: any) => {
            const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
            return {
              barcode: inv?.barcode || it.barcode || '',
              inventoryNo: it.inventory_no || it.inventoryNo || '',
              inventoryName: inv?.inventoryName || it.inventory_name || it.inventoryName || '',
              qty: Number(it.qty) || 0,
              uomName: it.uom_name || it.uomName || 'Pcs',
              notes: it.notes || null,
            };
          }),
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    await prisma.purchaseRequestDetail.deleteMany({ where: { headerId: id } });
    await prisma.purchaseRequestHeader.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

