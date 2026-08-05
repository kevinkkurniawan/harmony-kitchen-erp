import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const ALL_MODULE_CODES = [
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

async function initPermissionsTableAndSeed() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.t_access_user_module (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES public.t_access_user(id) ON DELETE CASCADE,
        module_code VARCHAR(100) NOT NULL,
        can_view BOOLEAN DEFAULT true,
        can_add BOOLEAN DEFAULT true,
        can_edit BOOLEAN DEFAULT true,
        can_delete BOOLEAN DEFAULT true,
        can_print BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, module_code)
      );
    `);

    // Check count of permission entries
    const countRes = await pool.query(`SELECT COUNT(*) FROM public.t_access_user_module`);
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      // Seed permissions for user 1 (Admin) -> All true
      const userRes = await pool.query(`SELECT id, username, user_level FROM public.t_access_user ORDER BY id ASC`);
      const users = userRes.rows;

      for (const u of users) {
        for (const modCode of ALL_MODULE_CODES) {
          const isUserMgmt = modCode === 'user-management';
          
          let canView = true;
          let canAdd = true;
          let canEdit = true;
          let canDelete = true;
          let canPrint = true;

          if (u.user_level === 'Kasir') {
            // Kasir has restricted access
            if (isUserMgmt || modCode === 'master-supplier' || modCode === 'penerimaan-barang-harga') {
              canView = false;
            }
            canDelete = false;
          } else if (u.user_level === 'Supervisor') {
            if (isUserMgmt) {
              canView = false;
            }
            canDelete = false;
          } else if (u.user_level === 'Manager') {
            if (isUserMgmt) {
              canView = false;
            }
          }

          await pool.query(`
            INSERT INTO public.t_access_user_module (
              user_id, module_code, can_view, can_add, can_edit, can_delete, can_print
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, module_code) DO NOTHING;
          `, [u.id, modCode, canView, canAdd, canEdit, canDelete, canPrint]);
        }
      }
    }
  } catch (err) {
    console.error('Error initializing permission table/seed:', err);
  }
}

export async function GET(request: Request) {
  try {
    await initPermissionsTableAndSeed();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId parameter is required' }, { status: 400 });
    }

    const res = await pool.query(`
      SELECT 
        id,
        user_id AS "userId",
        module_code AS "moduleCode",
        can_view AS "canView",
        can_add AS "canAdd",
        can_edit AS "canEdit",
        can_delete AS "canDelete",
        can_print AS "canPrint"
      FROM public.t_access_user_module
      WHERE user_id = $1
      ORDER BY id ASC;
    `, [parseInt(userId)]);

    return NextResponse.json({ success: true, userId: parseInt(userId), data: res.rows });
  } catch (error: any) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initPermissionsTableAndSeed();
    const body = await request.json();
    const { userId, permissions = [] } = body;

    if (!userId || !Array.isArray(permissions)) {
      return NextResponse.json({ success: false, error: 'userId and permissions array are required' }, { status: 400 });
    }

    for (const p of permissions) {
      await pool.query(`
        INSERT INTO public.t_access_user_module (
          user_id, module_code, can_view, can_add, can_edit, can_delete, can_print
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, module_code) 
        DO UPDATE SET 
          can_view = EXCLUDED.can_view,
          can_add = EXCLUDED.can_add,
          can_edit = EXCLUDED.can_edit,
          can_delete = EXCLUDED.can_delete,
          can_print = EXCLUDED.can_print;
      `, [
        parseInt(userId),
        p.moduleCode,
        p.canView ?? true,
        p.canAdd ?? true,
        p.canEdit ?? true,
        p.canDelete ?? true,
        p.canPrint ?? true,
      ]);
    }

    return NextResponse.json({
      success: true,
      message: `Hak Akses User ID ${userId} berhasil diperbarui! (${permissions.length} modul)`,
    });
  } catch (error: any) {
    console.error('Error saving user permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
