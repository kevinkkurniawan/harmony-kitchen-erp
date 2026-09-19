import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ALL_MODULES = [
  'memo-sync-stok', 'stok-opname', 'master-barang', 'inventory-stok', 
  'master-promo', 'master-supplier', 'penerimaan-barang', 'penerimaan-barang-harga', 
  'sales-sync-stok', 'sales-monitoring', 'laporan-penjualan', 'user-management'
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ success: false, message: 'Missing userId' });

    const perms: any[] = await prisma.$queryRawUnsafe(`
      SELECT * FROM public.t_userpermission WHERE userid = $1
    `, Number(userId));

    const data = ALL_MODULES.map(moduleCode => {
      const dbPerm = perms.find(p => p.modulecode === moduleCode);
      return {
        id: dbPerm ? Number(dbPerm.id) : undefined,
        userId: Number(userId),
        moduleCode,
        canView: !!dbPerm?.canview,
        canAdd: !!dbPerm?.canadd,
        canEdit: !!dbPerm?.canedit,
        canDelete: !!dbPerm?.candelete,
        canPrint: !!dbPerm?.canprint,
        canViewPrice: !!dbPerm?.canviewprice,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, permissions } = body;
    if (!userId || !Array.isArray(permissions)) {
      return NextResponse.json({ success: false, message: 'Invalid payload' });
    }

    // Using transaction to delete and insert for atomic updates
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM public.t_userpermission WHERE userid = $1`, Number(userId));
      
      for (const p of permissions) {
        await tx.$executeRawUnsafe(`
          INSERT INTO public.t_userpermission (userid, modulecode, canview, canadd, canedit, candelete, canprint, canviewprice)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, 
        Number(userId), 
        p.moduleCode, 
        Boolean(p.canView), 
        Boolean(p.canAdd), 
        Boolean(p.canEdit), 
        Boolean(p.canDelete), 
        Boolean(p.canPrint),
        Boolean(p.canViewPrice));
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving permissions:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
