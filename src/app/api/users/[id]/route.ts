import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSession, hashPassword } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
      include: { grants: true },
    });
    if (!user) return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });

    const mapped = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      full_name: user.fullName,
      userLevel: user.userLevel,
      user_level: user.userLevel,
      isActive: user.isActive,
      is_active: user.isActive,
      createdAt: user.createdAt.toISOString(),
      hasHpp: user.grants.some((g) => g.permissionKey === 'inventory.viewHpp'),
      canViewAllCashiers: user.grants.some((g) => g.permissionKey === 'reports.viewAllCashiers'),
      canManageGrants: user.grants.some((g) => g.permissionKey === 'auth.manageGrants'),
    };
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.userLevel !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const data: any = {};
    if (body.username) data.username = body.username.trim();
    if (body.fullName || body.full_name) data.fullName = (body.fullName || body.full_name).trim();
    if (body.userLevel || body.user_level) data.userLevel = body.userLevel || body.user_level;
    if (body.isActive !== undefined || body.is_active !== undefined) {
      data.isActive = Boolean(body.isActive !== undefined ? body.isActive : body.is_active);
    }
    if (body.password) {
      data.password = hashPassword(body.password);
    }

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        username: updated.username,
        fullName: updated.fullName,
        userLevel: updated.userLevel,
        isActive: updated.isActive,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.userLevel !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await prisma.user.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}