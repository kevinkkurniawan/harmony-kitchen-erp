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
      promo_no: p.promoNo,
      promo_name: p.promoName,
      group_name: p.group?.groupName || 'Promo Utama',
      discount_pct: p.discountPct,
      start_date: p.startDate,
      end_date: p.endDate,
      is_active: p.isActive,
      created_at: p.createdAt,
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
    const { promo_no, promo_name, group_id, discount_pct, start_date, end_date, is_active } = body;

    if (!promo_no || !promo_name) {
      return NextResponse.json({ success: false, error: 'Kode Promo dan Nama Promo wajib diisi' }, { status: 400 });
    }

    const created = await prisma.promo.create({
      data: {
        promoNo: promo_no,
        promoName: promo_name,
        groupId: group_id ? Number(group_id) : null,
        discountPct: discount_pct ? Number(discount_pct) : 0,
        startDate: start_date ? new Date(start_date) : new Date(),
        endDate: end_date ? new Date(end_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: is_active !== undefined ? Boolean(is_active) : true,
      },
    });

    return NextResponse.json({ success: true, message: 'Promo berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
