import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get('userId');

    if (userIdParam) {
      const targetUserId = Number(userIdParam);
      const [modulePerms, grants] = await Promise.all([
        prisma.userModulePermission.findMany({
          where: { userId: targetUserId },
        }),
        prisma.userGrant.findMany({
          where: { userId: targetUserId },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: modulePerms,
        grants: grants.map((g) => g.permissionKey),
        hasHpp: grants.some((g) => g.permissionKey === 'inventory.viewHpp'),
        canViewAllCashiers: grants.some((g) => g.permissionKey === 'reports.viewAllCashiers'),
        canManageGrants: grants.some((g) => g.permissionKey === 'auth.manageGrants'),
      });
    }

    // List all permissions
    const allPerms = await prisma.userModulePermission.findMany({
      include: { user: true },
    });
    return NextResponse.json({ success: true, data: allPerms });
  } catch (error: any) {
    console.error('Error reading permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, permissions, grants } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }
    const targetUserId = Number(userId);

    // 1. Module Permissions update requires Admin
    if (permissions && Array.isArray(permissions)) {
      if (authUser.userLevel !== 'Admin') {
        return NextResponse.json({ success: false, error: 'Forbidden: hanya Admin yang dapat mengubah hak akses modul' }, { status: 403 });
      }

      for (const p of permissions) {
        await prisma.userModulePermission.upsert({
          where: {
            userId_moduleCode: {
              userId: targetUserId,
              moduleCode: p.moduleCode,
            },
          },
          update: {
            canView: Boolean(p.canView),
            canAdd: Boolean(p.canAdd),
            canEdit: Boolean(p.canEdit),
            canDelete: Boolean(p.canDelete),
            canPrint: Boolean(p.canPrint),
          },
          create: {
            userId: targetUserId,
            moduleCode: p.moduleCode,
            canView: Boolean(p.canView),
            canAdd: Boolean(p.canAdd),
            canEdit: Boolean(p.canEdit),
            canDelete: Boolean(p.canDelete),
            canPrint: Boolean(p.canPrint),
          },
        });
      }
    }

    // 2. Explicit grants update (HPP, reports, grant admin) REQUIRES auth.manageGrants!
    if (grants && Array.isArray(grants)) {
      if (!authUser.canManageGrants) {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden: hanya Grant Administrator yang berwenang memberikan atau mencabut hak akses khusus (HPP/Laporan Kasir)',
          },
          { status: 403 }
        );
      }

      // Existing grants for user
      const existingGrants = await prisma.userGrant.findMany({
        where: { userId: targetUserId },
      });
      const existingKeys = new Set(existingGrants.map((g) => g.permissionKey));
      const targetKeys = new Set(grants.map(String));

      // Remove deleted grants
      for (const existing of existingGrants) {
        if (!targetKeys.has(existing.permissionKey)) {
          await prisma.userGrant.delete({
            where: { id: existing.id },
          });
        }
      }

      // Add newly granted keys
      for (const key of targetKeys) {
        if (!existingKeys.has(key)) {
          await prisma.userGrant.create({
            data: {
              userId: targetUserId,
              permissionKey: key,
              grantedBy: authUser.id,
            },
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Hak akses berhasil disimpan' });
  } catch (error: any) {
    console.error('Error updating permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export { PUT as POST };

