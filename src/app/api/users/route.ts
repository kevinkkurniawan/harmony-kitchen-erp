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
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { userLevel: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    return createPaginatedResponse(users, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, fullName, userLevel = 'Kasir' } = body;

    if (!username || !fullName) {
      return NextResponse.json({ success: false, error: 'Username dan Nama Lengkap wajib diisi' }, { status: 400 });
    }

    const created = await prisma.user.create({
      data: {
        username,
        fullName,
        userLevel,
      },
    });

    return NextResponse.json({ success: true, message: 'User berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
