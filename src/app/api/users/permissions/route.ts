import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');

    let targetUserId: number | null = null;

    if (userId) {
      targetUserId = Number(userId);
    } else if (username) {
      const u = await prisma.user.findUnique({ where: { username } });
      if (!u) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }
      targetUserId = u.id;
    } else {
      return NextResponse.json({ success: false, error: 'userId or username parameter is required' }, { status: 400 });
    }

    const permissions = await prisma.userModulePermission.findMany({
      where: { userId: targetUserId },
      orderBy: { id: 'asc' },
    });

    const mapped = permissions.map((p) => ({
      id: p.id,
      userId: p.userId,
      moduleCode: p.moduleCode,
      canView: p.canView,
      canAdd: p.canAdd,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
      canPrint: p.canPrint,
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/users/permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, permissions } = body;

    if (!userId || !Array.isArray(permissions)) {
      return NextResponse.json({ success: false, error: 'userId and permissions array are required' }, { status: 400 });
    }

    const uId = Number(userId);

    for (const p of permissions) {
      await prisma.userModulePermission.upsert({
        where: {
          userId_moduleCode: {
            userId: uId,
            moduleCode: p.moduleCode,
          },
        },
        update: {
          canView: p.canView ?? true,
          canAdd: p.canAdd ?? true,
          canEdit: p.canEdit ?? true,
          canDelete: p.canDelete ?? true,
          canPrint: p.canPrint ?? true,
        },
        create: {
          userId: uId,
          moduleCode: p.moduleCode,
          canView: p.canView ?? true,
          canAdd: p.canAdd ?? true,
          canEdit: p.canEdit ?? true,
          canDelete: p.canDelete ?? true,
          canPrint: p.canPrint ?? true,
        },
      });
    }

    return NextResponse.json({ success: true, message: 'Permissions saved successfully' });
  } catch (error: any) {
    console.error('Error in POST /api/users/permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
