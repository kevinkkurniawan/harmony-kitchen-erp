import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const usersQuery: any[] = await prisma.$queryRawUnsafe(`
      SELECT u.id, u.username, u.createddate as created_at, 
             COALESCE(e.employeename, 'User') as full_name,
             COALESCE(p.positionname, 'Staff') as user_level,
             COALESCE(e.isactive, true) as is_active
      FROM m_user u
      LEFT JOIN m_employee e ON u.employeeid = e.id
      LEFT JOIN m_position p ON e.positionid = p.id
      ${q ? `WHERE u.username ILIKE $1` : ''}
      ORDER BY u.id ASC
      LIMIT $${q ? 2 : 1} OFFSET $${q ? 3 : 2}
    `, ...(q ? [`%${q}%`, paginationParams.limit, paginationParams.skip] : [paginationParams.limit, paginationParams.skip]));

    const countRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(*) as count
      FROM m_user u
      ${q ? `WHERE u.username ILIKE $1` : ''}
    `, ...(q ? [`%${q}%`] : []));

    const total = Number(countRes[0].count);
    
    const mapped = usersQuery.map((u) => ({ 
      id: Number(u.id), 
      username: u.username, 
      full_name: u.full_name, 
      user_level: u.user_level, 
      is_active: u.is_active, 
      created_at: u.created_at 
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { 
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 }); 
  }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.m_user.create({ data: { username: body.username, password: body.password || '123456', employeeid: 1 } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
