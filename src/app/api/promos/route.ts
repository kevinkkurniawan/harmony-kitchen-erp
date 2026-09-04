import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = q
      ? {
          groupName: { contains: q, mode: 'insensitive' as const },
        }
      : undefined;

    const [total, groups] = await Promise.all([
      prisma.promoGroup.count({ where }),
      prisma.promoGroup.findMany({
        where,
        include: { promos: true },
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = groups.map((g) => ({
      id: String(g.id),
      promoCode: g.promoCode,
      groupName: g.groupName,
      group_name: g.groupName,
      description: g.description,
      isActive: g.isActive,
      promosCount: g.promos.length,
      promos_count: g.promos.length,
      promos: g.promos.map((p) => ({
        id: String(p.id),
        promoNo: p.promoNo,
        promo_no: p.promoNo,
        promoName: p.promoName,
        promo_name: p.promoName,
        discountPct: p.discountPct,
        discount_pct: p.discountPct,
        startDate: p.startDate,
        endDate: p.endDate,
        isActive: p.isActive,
      })),
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
    const promoCode = body.promoCode || `PRM-GRP-${Date.now().toString().slice(-4)}`;
    const description = body.description || null;
    const isActive = body.isActive ?? true;

    if (!groupName) {
      return NextResponse.json({ success: false, error: 'Nama Group Promo wajib diisi' }, { status: 400 });
    }

    const created = await prisma.promoGroup.create({
      data: { 
        promoCode,
        groupName,
        description,
        isActive
      },
    });

    // POS SYNC
    try {
      await posPool.query(
        `INSERT INTO "PromoGroup" (id, "promoCode", "groupName", description, "isActive") 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("promoCode") DO UPDATE 
         SET "groupName" = EXCLUDED."groupName", description = EXCLUDED.description, "isActive" = EXCLUDED."isActive"`,
        [created.id, created.promoCode, created.groupName, created.description, created.isActive]
      );
    } catch (posErr) {
      console.error('POS Sync Error (PromoGroup POST):', posErr);
    }

    return NextResponse.json({ success: true, message: 'Group Promo berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
