import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = q
      ? {
          OR: [
            { prNo: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
            { status: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

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

    const mapped = requests.map((pr) => ({
      id: pr.id,
      pr_no: pr.prNo,
      pr_date: pr.prDate,
      required_date: pr.requiredDate,
      description: pr.description || '',
      status: pr.status,
      created_at: pr.createdAt,
      items: pr.details.map((d) => ({
        id: d.id,
        barcode: d.barcode,
        inventory_no: d.inventoryNo,
        inventory_name: d.inventoryName,
        qty: d.qty,
        uom_name: d.uomName,
        notes: d.notes || '',
      })),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/requests:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pr_no, pr_date, required_date, description, status = 'Draft', items } = body;

    if (!pr_no || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. PR dan detail item barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.purchaseRequestHeader.create({
      data: {
        prNo: pr_no,
        prDate: pr_date ? new Date(pr_date) : new Date(),
        requiredDate: required_date ? new Date(required_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        description,
        status,
        details: {
          create: items.map((it: any) => ({
            barcode: it.barcode,
            inventoryNo: it.inventory_no || it.inventoryNo,
            inventoryName: it.inventory_name || it.inventoryName,
            qty: Number(it.qty),
            uomName: it.uom_name || it.uomName || 'Pcs',
            notes: it.notes || null,
          })),
        },
      },
      include: { details: true },
    });

    return NextResponse.json({ success: true, message: 'Purchase Request berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/requests:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
