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
      id: g.id,
      group_name: g.groupName,
      promos_count: g.promos.length,
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
    const { group_name } = body;

    if (!group_name) {
      return NextResponse.json({ success: false, error: 'Nama Group Promo wajib diisi' }, { status: 400 });
    }

    const created = await prisma.promoGroup.create({
      data: { groupName: group_name },
    });

    return NextResponse.json({ success: true, message: 'Group Promo berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/promos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
