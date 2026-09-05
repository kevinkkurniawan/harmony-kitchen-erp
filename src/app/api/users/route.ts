import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);
    const where = q ? { OR: [{ username: { contains: q, mode: 'insensitive' as const } }] } : undefined;
    const [total, users] = await Promise.all([
      prisma.m_user.count({ where }),
      prisma.m_user.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = users.map((u) => ({ id: u.id, username: u.username, full_name: 'User', user_level: 'Staff', is_active: true, created_at: u.createddate }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.m_user.create({ data: { username: body.username, password: body.password || '123456', employeeid: 1 } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
