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
        { prqno: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [total, requests] = await Promise.all([
      prisma.t_purchaserequisitionheader.count({ where }),
      prisma.t_purchaserequisitionheader.findMany({
        where,
        include: { t_purchaserequisitiondetail: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const inventoryIds = Array.from(new Set(
      requests.flatMap((r: any) => r.t_purchaserequisitiondetail.map((d: any) => d.inventoryid))
    )).filter(Boolean) as number[];

    const inventories = await prisma.inventory.findMany({
      where: { id: { in: inventoryIds } }
    });
    
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));

    const mapped = requests.map((pr: any) => ({
      id: pr.id,
      pr_no: pr.prqno,
      pr_date: pr.prqdate,
      required_date: pr.reqdate,
      description: pr.description || '',
      status: pr.statusrequisition ? 'Approved' : 'Draft',
      created_at: pr.createddate,
      items: pr.t_purchaserequisitiondetail.map((d: any) => {
        const inv = inventoryMap.get(d.inventoryid);
        return {
          id: d.id,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          qty: Number(d.qty),
          uom_name: 'Pcs',
          notes: d.description || '',
        };
      }),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pr_no, pr_date, required_date, description, status = 'Draft', items } = body;

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    const created = await prisma.t_purchaserequisitionheader.create({
      data: {
        prqno: pr_no,
        prqdate: pr_date ? new Date(pr_date) : new Date(),
        reqdate: required_date ? new Date(required_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        description,
        statusrequisition: status === 'Approved',
        t_purchaserequisitiondetail: {
          create: items.map((it: any) => ({
            inventoryid: invMapByNo.get(it.inventory_no || it.inventoryNo) || 1,
            qty: Number(it.qty) || 0,
            description: it.notes || null,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, pr_no, pr_date, required_date, description, status, items } = body;

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    await prisma.t_purchaserequisitiondetail.deleteMany({ where: { prqid: Number(id) } });

    const updated = await prisma.t_purchaserequisitionheader.update({
      where: { id: Number(id) },
      data: {
        prqno: pr_no,
        prqdate: pr_date ? new Date(pr_date) : undefined,
        reqdate: required_date ? new Date(required_date) : undefined,
        description,
        statusrequisition: status === 'Approved',
        t_purchaserequisitiondetail: {
          create: items.map((it: any) => ({
            inventoryid: invMapByNo.get(it.inventory_no || it.inventoryNo) || 1,
            qty: Number(it.qty) || 0,
            description: it.notes || null,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    await prisma.t_purchaserequisitiondetail.deleteMany({ where: { prqid: id } });
    await prisma.t_purchaserequisitionheader.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
