import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username) {
      return NextResponse.json({ success: false, error: 'Username required' }, { status: 400 });
    }

    const cleanUsername = username.toLowerCase().trim();

    // Query user record
    const userRes = await pool.query(`
      SELECT 
        id,
        username,
        full_name AS "fullName",
        user_level AS "userLevel",
        is_active AS "isActive"
      FROM public.t_access_user
      WHERE LOWER(username) = $1 AND is_active = true;
    `, [cleanUsername]);

    if (userRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'User not registered. Please contact your administrator',
      }, { status: 401 });
    }

    const user = userRes.rows[0];

    // Query permissions for user
    const permRes = await pool.query(`
      SELECT 
        module_code AS "moduleCode",
        can_view AS "canView",
        can_add AS "canAdd",
        can_edit AS "canEdit",
        can_delete AS "canDelete",
        can_print AS "canPrint"
      FROM public.t_access_user_module
      WHERE user_id = $1;
    `, [user.id]);

    return NextResponse.json({
      success: true,
      user,
      permissions: permRes.rows,
      message: `Login berhasil sebagai ${user.fullName} (${user.userLevel})`,
    });
  } catch (error: any) {
    console.error('Error during login process:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
