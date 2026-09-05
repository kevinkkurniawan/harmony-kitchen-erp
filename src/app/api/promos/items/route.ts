import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});
posPool.on('connect', client => client.query('SET search_path TO pos, public;'));

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
      promoBundle: p.promoBundle,
      promoGrosir: p.promoGrosir,
      promoGrosirType: p.promoGrosirType,
      qtyMin: p.qtyMin,
      qtyMax: p.qtyMax,
      isPartial: p.isPartial,
      isGroup: p.isGroup,
      description: p.description,
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
    const promoBundle = body.promoBundle;
    const promoGrosir = body.promoGrosir;
    const promoGrosirType = body.promoGrosirType ?? 'PERCENT';
    const qtyMin = body.qtyMin ?? 1;
    const qtyMax = body.qtyMax ?? 9999;
    const isPartial = body.isPartial ?? true;
    const isGroup = body.isGroup ?? true;
    const description = body.description;
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
        promoBundle: promoBundle !== undefined ? Number(promoBundle) : null,
        promoGrosir: promoGrosir !== undefined ? Number(promoGrosir) : null,
        promoGrosirType: promoGrosirType,
        discountPct: Number(discountPct || 0),
        qtyMin: Number(qtyMin || 1),
        qtyMax: Number(qtyMax || 9999),
        isPartial: Boolean(isPartial),
        isGroup: Boolean(isGroup),
        description: description || null,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: Boolean(isActive),
      },
    });

    // POS SYNC
    try {
      await posPool.query(
        `INSERT INTO "Promo" (id, "promoNo", "promoName", "groupId", "promoBundle", "promoGrosir", "promoGrosirType", "discountPct", "qtyMin", "qtyMax", "isPartial", "isGroup", description, "startDate", "endDate", "isActive", "createdAt") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
         ON CONFLICT ("promoNo") DO NOTHING`,
        [created.id, created.promoNo, created.promoName, created.groupId, created.promoBundle, created.promoGrosir, created.promoGrosirType, created.discountPct, created.qtyMin, created.qtyMax, created.isPartial, created.isGroup, created.description, created.startDate, created.endDate, created.isActive]
      );
    } catch (posErr) {
      console.error('POS Sync Error (Promo POST):', posErr);
    }

    return NextResponse.json({ success: true, message: 'Promo berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
