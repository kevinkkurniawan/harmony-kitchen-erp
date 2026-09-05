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
      promoNo: `PRM-${p.id}`,
      promo_no: `PRM-${p.id}`,
      promoName: p.promoname,
      promo_name: p.promoname,
      groupId: 1,
      groupName: 'Promo Utama',
      group_name: 'Promo Utama',
      promoBundle: p.promobundle,
      promoGrosir: p.promogrosir,
      promoGrosirType: 'PERCENT',
      qtyMin: p.qtymin || 1,
      qtyMax: p.qtymax || 9999,
      isPartial: p.ispartial,
      isGroup: p.isgroup,
      description: p.description,
      discountPct: p.promopercentage ? Number(p.promopercentage) : 0,
      discount_pct: p.promopercentage ? Number(p.promopercentage) : 0,
      startDate: p.createddate,
      start_date: p.createddate,
      endDate: p.modifieddate,
      end_date: p.modifieddate,
      isActive: p.isactive,
      is_active: p.isactive,
      createdAt: p.createddate,
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

    if (!promoName) {
      return NextResponse.json({ success: false, error: 'Nama Promo wajib diisi' }, { status: 400 });
    }

    const max = await prisma.promo.aggregate({ _max: { promobundle: true, promogrosir: true } });
    const bundleId = (max._max.promobundle || 0) + 1;
    const grosirId = (max._max.promogrosir || 0) + 1;

    const created = await prisma.promo.create({
      data: {
        promobundle: bundleId,
        promogrosir: grosirId,
        promoname: promoName,
        promovalue: 0,
        promopercentage: Number(discountPct || 0),
        qtymin: Number(qtyMin || 1),
        qtymax: Number(qtyMax || 9999),
        ispartial: Boolean(isPartial),
        isgroup: Boolean(isGroup),
        description: description || null,
        isactive: Boolean(isActive),
        createduser: 'system',
        createddate: new Date(),
        modifieduser: 'system',
        modifieddate: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Promo berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
