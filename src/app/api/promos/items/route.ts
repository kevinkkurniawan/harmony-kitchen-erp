import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const paginationParams = getPaginationParams(request, 50);

    const whereCondition: any = {};
    if (onlyActive) whereCondition.isActive = true;
    if (q) {
      whereCondition.OR = [
        { promoNo: { contains: q, mode: 'insensitive' } },
        { promoName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, promos] = await Promise.all([
      prisma.promo.count({ where: whereCondition }),
      prisma.promo.findMany({
        where: whereCondition,
        include: { group: true },
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = promos.map((p) => ({
      id: p.id,
      promoNo: p.promoNo,
      promo_no: p.promoNo,
      promoName: p.promoName,
      promo_name: p.promoName,
      groupId: p.groupId,
      groupName: p.group?.groupName || 'Promo Utama',
      group_name: p.group?.groupName || 'Promo Utama',
      discountPct: p.discountPct,
      discount_pct: p.discountPct,
      startDate: p.startDate,
      start_date: p.startDate,
      endDate: p.endDate,
      end_date: p.endDate,
      isActive: p.isActive,
      is_active: p.isActive,
      createdAt: p.createdAt,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const promoNo = body.promoNo || body.promo_no || `PRM-${Date.now().toString().slice(-6)}`;
    const promoName = body.promoName || body.promo_name;
    const groupId = body.groupId ?? body.group_id;
    const discountPct = body.discountPct ?? body.discount_pct ?? body.promoPercentage ?? 0;
    const startDate = body.startDate || body.start_date;
    const endDate = body.endDate || body.end_date;
    const isActive = body.isActive ?? body.is_active ?? true;

    if (!promoName) {
      return NextResponse.json({ success: false, error: 'Nama Promo wajib diisi' }, { status: 400 });
    }

    const created = await prisma.promo.create({
      data: {
        promoNo: promoNo,
        promoName: promoName,
        groupId: groupId ? Number(groupId) : null,
        discountPct: Number(discountPct || 0),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({ success: true, message: 'Promo berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
