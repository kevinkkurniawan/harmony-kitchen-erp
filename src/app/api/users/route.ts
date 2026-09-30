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
      ${q ? `WHERE u.username ILIKE $1 OR e.employeename ILIKE $1` : ''}
      ORDER BY u.id ASC
      LIMIT $${q ? 2 : 1} OFFSET $${q ? 3 : 2}
    `, ...(q ? [`%${q}%`, paginationParams.limit, paginationParams.skip] : [paginationParams.limit, paginationParams.skip]));

    const countRes: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(*) as count
      FROM m_user u
      LEFT JOIN m_employee e ON u.employeeid = e.id
      ${q ? `WHERE u.username ILIKE $1 OR e.employeename ILIKE $1` : ''}
    `, ...(q ? [`%${q}%`] : []));

    const total = Number(countRes[0].count);
    
    const mapped = usersQuery.map((u) => ({ 
      id: Number(u.id), 
      username: u.username, 
      fullName: u.full_name,
      full_name: u.full_name, 
      userLevel: u.user_level,
      user_level: u.user_level, 
      isActive: Boolean(u.is_active),
      is_active: Boolean(u.is_active), 
      createdAt: u.created_at,
      created_at: u.created_at 
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { 
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 }); 
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, fullName, userLevel, isActive } = body;
    if (!username || !username.trim()) {
      return NextResponse.json({ success: false, error: 'Username wajib diisi.' }, { status: 400 });
    }

    // Check if user already exists
    const existing = await prisma.m_user.findFirst({
      where: { username: username.trim() },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: `User dengan username "${username}" sudah ada.` }, { status: 400 });
    }

    // Find or create position matching userLevel
    let positionId = 1;
    if (userLevel) {
      const pos = await prisma.m_position.findFirst({
        where: { positionname: userLevel },
      });
      if (pos) {
        positionId = Number(pos.id);
      } else {
        const newPos = await prisma.m_position.create({
          data: {
            positionname: userLevel,
            isactive: true,
          },
        });
        positionId = Number(newPos.id);
      }
    }

    // Create employee record
    const empNo = `EMP-${Date.now().toString().slice(-6)}`;
    const emp = await prisma.m_employee.create({
      data: {
        employeeno: empNo,
        employeename: fullName || username,
        positionid: positionId,
        isactive: isActive !== undefined ? Boolean(isActive) : true,
        createddate: new Date(),
      },
    });

    // Create user record
    const created = await prisma.m_user.create({
      data: {
        username: username.trim(),
        password: body.password || '123456',
        employeeid: Number(emp.id),
        createddate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: Number(created.id),
        username: created.username,
        fullName: emp.employeename,
        full_name: emp.employeename,
        userLevel: userLevel || 'Staff',
        user_level: userLevel || 'Staff',
        isActive: Boolean(emp.isactive),
        is_active: Boolean(emp.isactive),
      },
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, error: error.message || 'Gagal menambahkan user' }, { status: 500 });
  }
}
