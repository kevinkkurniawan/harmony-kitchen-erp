import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { resolveSession, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { fullName: { contains: q, mode: 'insensitive' as const } },
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
        include: { grants: true },
      }),
    ]);

    // Format for UserAccessManager and ensure NO credential secret is returned
    const mapped = users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      full_name: u.fullName,
      userLevel: u.userLevel,
      user_level: u.userLevel,
      isActive: u.isActive,
      is_active: u.isActive,
      createdAt: u.createdAt.toISOString(),
      created_at: u.createdAt.toISOString(),
      hasHpp: u.grants.some((g) => g.permissionKey === 'inventory.viewHpp'),
      canViewAllCashiers: u.grants.some((g) => g.permissionKey === 'reports.viewAllCashiers'),
      canManageGrants: u.grants.some((g) => g.permissionKey === 'auth.manageGrants'),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat data user' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only Admin can add users
    if (authUser.userLevel !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Forbidden: hanya Admin yang dapat menambah user' }, { status: 403 });
    }

    const body = await req.json();
    if (!body.username || !body.fullName) {
      return NextResponse.json({ success: false, error: 'Username dan Nama Lengkap wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { username: body.username.trim() },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Username sudah digunakan' }, { status: 400 });
    }

    const hashedPassword = hashPassword(body.password || '123456');

    const created = await prisma.user.create({
      data: {
        username: body.username.trim(),
        fullName: body.fullName.trim(),
        userLevel: body.userLevel || 'Kasir',
        password: hashedPassword,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        username: created.username,
        fullName: created.fullName,
        userLevel: created.userLevel,
        isActive: created.isActive,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, error: 'Gagal menambah user' }, { status: 500 });
  }
}
