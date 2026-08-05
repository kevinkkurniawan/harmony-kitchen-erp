import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';

    const whereCondition: any = {};
    if (onlyActive) whereCondition.isActive = true;
    if (q) {
      whereCondition.OR = [
        { promoNo: { contains: q, mode: 'insensitive' } },
        { promoName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const promos = await prisma.promo.findMany({
      where: whereCondition,
      include: { group: true },
      orderBy: { id: 'asc' },
    });

    const mapped = promos.map((p) => ({
      id: p.id,
      promoNo: p.promoNo,
      promo_no: p.promoNo,
      promoName: p.promoName,
      promo_name: p.promoName,
      group_name: p.group?.groupName || 'Promo Utama',
      promoBundle: 0,
      promoGrosir: 0,
      promoPercentage: p.discountPct,
      discount_pct: p.discountPct,
      discountPct: p.discountPct,
      qtyMin: 1,
      qtyMax: 9999,
      isPartial: true,
      isGroup: true,
      description: `Promo Diskon ${p.discountPct}% (${p.promoName})`,
      promoGrosirType: 'PERCENT',
      start_date: p.startDate,
      end_date: p.endDate,
      isActive: p.isActive,
      is_active: p.isActive,
      created_at: p.createdAt,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const promo_no = body.promo_no || body.promoNo || `PRM-${Date.now().toString().slice(-6)}`;
    const promo_name = body.promo_name || body.promoName;
    const group_id = body.group_id || body.groupId;
    const discount_pct = body.discount_pct !== undefined ? body.discount_pct : (body.promoPercentage !== undefined ? body.promoPercentage : 10);
    const start_date = body.start_date || body.startDate;
    const end_date = body.end_date || body.endDate;
    const is_active = body.is_active !== undefined ? body.is_active : body.isActive;

    if (!promo_name) {
      return NextResponse.json({ success: false, error: 'Nama Promo wajib diisi' }, { status: 400 });
    }

    const created = await prisma.promo.create({
      data: {
        promoNo: promo_no,
        promoName: promo_name,
        groupId: group_id ? Number(group_id) : null,
        discountPct: Number(discount_pct || 0),
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
