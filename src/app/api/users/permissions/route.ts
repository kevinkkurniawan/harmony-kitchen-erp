import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getPermissionsForUser, savePermissions, StoredPermission } from '@/lib/erp-permissions';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ success: false, error: 'Login diperlukan.' }, { status: 401 });
  const requestedUserId = Number(new URL(request.url).searchParams.get('userId') || currentUser.id);
  if (requestedUserId !== currentUser.id && currentUser.userLevel !== 'Admin') {
    return NextResponse.json({ success: false, error: 'Tidak memiliki akses untuk melihat hak akses user lain.' }, { status: 403 });
  }
  // Permission records are keyed by user ID; role defaults are derived from the requested account.
  const subject = requestedUserId === currentUser.id ? currentUser : { ...currentUser, id: requestedUserId, userLevel: 'Staff' as const };
  const data = await getPermissionsForUser(subject);
  return NextResponse.json({ success: true, data, items: data });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.userLevel !== 'Admin') {
    return NextResponse.json({ success: false, error: 'Hanya Admin yang dapat mengubah hak akses.' }, { status: 403 });
  }
  const body = await request.json();
  const userId = Number(body.userId);
  if (!Number.isInteger(userId) || !Array.isArray(body.permissions)) {
    return NextResponse.json({ success: false, error: 'Data hak akses tidak valid.' }, { status: 400 });
  }
  try {
    await savePermissions(userId, body.permissions as StoredPermission[]);
    return NextResponse.json({ success: true, message: 'Hak akses berhasil disimpan.' });
  } catch {
    return NextResponse.json({ success: false, error: 'Tabel hak akses belum tersedia. Jalankan database/migrations/20260919_erp_user_permissions.sql.' }, { status: 503 });
  }
}

export async function PUT() {
  return NextResponse.json({ success: true, data: [] });
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}
