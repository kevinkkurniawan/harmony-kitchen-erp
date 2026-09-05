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
      where.promoname = { contains: q, mode: 'insensitive' as const };
    }

    const [total, promos] = await Promise.all([
      prisma.promo.count({ where }),
      prisma.promo.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = promos.map((p: any) => ({
      id: String(p.id),
      promoCode: `PRM-${p.id}`,
      groupName: p.promoname,
      group_name: p.promoname,
      description: p.description,
      isActive: p.isactive,
      promosCount: 0,
      promos_count: 0,
      promos: [],
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/promos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const groupName = body.groupName || body.group_name || body.promoName;
    const description = body.description || null;
    const isActive = body.isActive ?? true;

    if (!groupName) {
      return NextResponse.json({ success: false, error: 'Nama Group Promo wajib diisi' }, { status: 400 });
    }

    // Get a unique bundle id
    const max = await prisma.promo.aggregate({ _max: { promobundle: true } });
    const bundleId = (max._max.promobundle || 0) + 1;

    const created = await prisma.promo.create({
      data: {
        promobundle: bundleId,
        promogrosir: 0,
        promoname: groupName,
        promovalue: 0,
        promopercentage: 0,
        qtymin: 0,
        qtymax: 0,
        ispartial: false,
        isgroup: true,
        description,
        isactive: isActive,
        createduser: 'system',
        createddate: new Date(),
        modifieduser: 'system',
        modifieddate: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Group Promo berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
