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
      where.promoName = { contains: q, mode: 'insensitive' as const };
    }

    const [total, promos] = await Promise.all([
      prisma.promo.count({ where }),
      prisma.promo.findMany({
        where,
        include: { group: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = promos.map((p: any) => ({
      id: String(p.id),
      promoNo: p.promoNo || `PRM-${p.id}`,
      promo_no: p.promoNo || `PRM-${p.id}`,
      promoName: p.promoName,
      promo_name: p.promoName,
      groupId: p.groupId,
      groupName: p.group?.groupName || 'Promo Utama',
      group_name: p.group?.groupName || 'Promo Utama',
      promoBundle: p.promoBundle,
      promoGrosir: p.promoGrosir,
      promoGrosirType: p.promoGrosirType || 'PERCENT',
      qtyMin: p.qtyMin || 1,
      qtyMax: p.qtyMax || 9999,
      isPartial: p.isPartial,
      isGroup: p.isGroup,
      description: p.description,
      discountPct: p.discountPct ? Number(p.discountPct) : 0,
      discount_pct: p.discountPct ? Number(p.discountPct) : 0,
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const promoName = body.promoName || body.promo_name;
    const discountPct = body.discountPct ?? body.discount_pct ?? body.promoPercentage ?? 0;
    const qtyMin = body.qtyMin ?? 1;
    const qtyMax = body.qtyMax ?? 9999;
    const isPartial = body.isPartial ?? true;
    const isGroup = body.isGroup ?? true;
    const description = body.description;
    const isActive = body.isActive ?? body.is_active ?? true;
    const groupId = body.groupId ? Number(body.groupId) : null;
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const endDate = body.endDate ? new Date(body.endDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    if (!promoName) {
      return NextResponse.json({ success: false, error: 'Nama Promo wajib diisi' }, { status: 400 });
    }

    const promoNo = body.promoNo || `PRM-${Date.now()}`;

    const created = await prisma.promo.create({
      data: {
        promoNo,
        promoName,
        groupId,
        promoBundle: 1,
        promoGrosir: 0,
        promoGrosirType: 'PERCENT',
        discountPct: Number(discountPct || 0),
        qtyMin: Number(qtyMin || 1),
        qtyMax: Number(qtyMax || 9999),
        isPartial: Boolean(isPartial),
        isGroup: Boolean(isGroup),
        description: description || null,
        startDate,
        endDate,
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({ success: true, message: 'Promo berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

