import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const groups = await prisma.promoGroup.findMany({
      include: { promos: true },
      orderBy: { id: 'asc' },
    });

    const mapped = groups.map((g) => ({
      id: g.id,
      promoCode: `PRM-GRP-${g.id.toString().padStart(4, '0')}`,
      promo_code: `PRM-GRP-${g.id.toString().padStart(4, '0')}`,
      promoName: g.groupName,
      promo_name: g.groupName,
      group_name: g.groupName,
      description: `Group Promo ${g.groupName}`,
      promos_count: g.promos.length,
      isActive: true,
      is_active: true,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/promos:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const group_name = body.group_name || body.promoName || body.groupName;

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
