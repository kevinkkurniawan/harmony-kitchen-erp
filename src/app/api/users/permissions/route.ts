import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const ALL_MODULE_CODES = [
  // TCodes
  'MD_INV',
  'MD_STOCK',
  'MD_USAGE',
  'MD_BARCODE',
  'MD_EMP',
  'MD_CUST',
  'MD_BANK',
  'MD_SUPP',
  'MD_PROMO',
  'PUR_PR',
  'PUR_PO',
  'PUR_EXP',
  'PUR_RCV',
  'PUR_PAY',
  'PUR_RET',
  'INV_OPN',
  'SLS_SYNC',
  'SLS_MON',
  'RPT_SALES',
  'ADM_USER',
  // Tab Keys
  'master-barang',
  'inventory-stok',
  'pemakaian-barang',
  'cetak-barcode',
  'master-karyawan',
  'master-customer',
  'master-bank',
  'master-supplier',
  'master-promo',
  'pengajuan-pembelian',
  'order-pembelian',
  'penerimaan-barang',
  'penerimaan-barang-harga',
  'pembayaran-supplier',
  'retur-pembelian',
  'stok-opname',
  'sync-stok',
  'memo-sync-stok',
  'sales-sync-stok',
  'sales-monitoring',
  'laporan-penjualan',
  'user-management'
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

    // Ensure permissions for all users
    const userRes = await pool.query(`SELECT id, username, user_level FROM public.t_access_user ORDER BY id ASC`);
    const users = userRes.rows;

    for (const u of users) {
      for (const modCode of ALL_MODULE_CODES) {
        const isUserMgmt = modCode === 'user-management' || modCode === 'ADM_USER';
        
        let canView = true;
        let canAdd = true;
        let canEdit = true;
        let canDelete = true;
        let canPrint = true;

        if (u.user_level === 'Kasir') {
          if (isUserMgmt || modCode === 'MD_SUPP' || modCode === 'PUR_RCV' || modCode === 'PUR_PAY' || modCode === 'master-supplier' || modCode === 'penerimaan-barang-harga' || modCode === 'pembayaran-supplier') {
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

        // Admin has all true
        if (u.user_level === 'Admin' || u.username === 'admin') {
          canView = true;
          canAdd = true;
          canEdit = true;
          canDelete = true;
          canPrint = true;
        }

        await pool.query(`
          INSERT INTO public.t_access_user_module (
            user_id, module_code, can_view, can_add, can_edit, can_delete, can_print
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id, module_code) DO UPDATE SET
            can_view = EXCLUDED.can_view,
            can_add = EXCLUDED.can_add,
            can_edit = EXCLUDED.can_edit,
            can_delete = EXCLUDED.can_delete,
            can_print = EXCLUDED.can_print;
        `, [u.id, modCode, canView, canAdd, canEdit, canDelete, canPrint]);
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
    const username = searchParams.get('username');

    let queryUser = '';
    let paramVal: any = null;

    if (userId) {
      queryUser = `WHERE user_id = $1`;
      paramVal = userId;
    } else if (username) {
      const uRes = await pool.query(`SELECT id FROM public.t_access_user WHERE username = $1`, [username]);
      if (uRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }
      queryUser = `WHERE user_id = $1`;
      paramVal = uRes.rows[0].id;
    } else {
      return NextResponse.json({ success: false, error: 'userId or username parameter is required' }, { status: 400 });
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
      ${queryUser}
      ORDER BY id ASC;
    `, [paramVal]);

    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    console.error('Error in GET /api/users/permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initPermissionsTableAndSeed();
    const body = await request.json();
    const { userId, permissions } = body;

    if (!userId || !Array.isArray(permissions)) {
      return NextResponse.json({ success: false, error: 'userId and permissions array are required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const p of permissions) {
        await client.query(`
          INSERT INTO public.t_access_user_module (
            user_id, module_code, can_view, can_add, can_edit, can_delete, can_print
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id, module_code) DO UPDATE SET
            can_view = EXCLUDED.can_view,
            can_add = EXCLUDED.can_add,
            can_edit = EXCLUDED.can_edit,
            can_delete = EXCLUDED.can_delete,
            can_print = EXCLUDED.can_print;
        `, [
          userId,
          p.moduleCode,
          p.canView ?? true,
          p.canAdd ?? true,
          p.canEdit ?? true,
          p.canDelete ?? true,
          p.canPrint ?? true,
        ]);
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Permissions saved successfully' });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error in POST /api/users/permissions:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
