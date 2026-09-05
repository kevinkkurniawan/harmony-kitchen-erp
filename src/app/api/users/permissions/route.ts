import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ALL_MODULE_CODES = [
  'memo-sync-stok',
  'stok-opname',
  'master-barang',
  'inventory-stok',
  'master-promo',
  'master-supplier',
  'penerimaan-barang',
  'penerimaan-barang-harga',
  'sales-sync-stok',
  'sales-monitoring',
  'laporan-penjualan',
  'user-management',
];

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

    const dbPermissions = await prisma.userModulePermission.findMany({
      where: { userId: targetUserId },
      orderBy: { id: 'asc' },
    });

    const permMap = new Map<string, any>();
    dbPermissions.forEach((p) => {
      permMap.set(p.moduleCode, p);
    });

    const mapped = ALL_MODULE_CODES.map((mCode) => {
      const existing = permMap.get(mCode);
      if (existing) {
        return {
          id: existing.id,
          userId: existing.userId,
          moduleCode: existing.moduleCode,
          canView: existing.canView,
          canAdd: existing.canAdd,
          canEdit: existing.canEdit,
          canDelete: existing.canDelete,
          canPrint: existing.canPrint,
        };
      }
      return {
        userId: targetUserId!,
        moduleCode: mCode,
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canPrint: true,
      };
    });

    return NextResponse.json({
      success: true,
      data: mapped,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
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
