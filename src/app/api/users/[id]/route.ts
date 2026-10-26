import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { recordAuditEvent } from '@/lib/audit-event';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.m_user.findUnique({ where: { id: Number(id) } });
    if (!user) return NextResponse.json({ success: false }, { status: 404 });
    const mapped = { id: user.id, username: user.username, full_name: 'User', user_level: 'Staff', is_active: true, created_at: user.createddate };
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

// Change username and/or password. Only the fields sent are changed; the password is never returned.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ success: false, error: 'Login diperlukan.' }, { status: 401 });
    const { id } = await params;
    const userId = Number(id);
    // Users may change their own password; changing someone else's needs Admin
    if (userId !== currentUser.id && currentUser.userLevel !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Hanya Admin yang dapat mengubah user lain.' }, { status: 403 });
    }

    const body = await req.json();
    const data: { username?: string; password?: string; modifieduser?: string; modifieddate?: Date } = {};
    if (typeof body.username === 'string' && body.username.trim()) data.username = body.username.trim();
    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 4) {
        return NextResponse.json({ success: false, error: 'Password minimal 4 karakter.' }, { status: 400 });
      }
      data.password = body.password;
    }
    if (!data.username && !data.password) {
      return NextResponse.json({ success: false, error: 'Tidak ada data yang diubah.' }, { status: 400 });
    }
    if (data.username) {
      const taken = await prisma.m_user.findFirst({ where: { username: data.username, NOT: { id: userId } } });
      if (taken) return NextResponse.json({ success: false, error: `Username "${data.username}" sudah dipakai.` }, { status: 400 });
    }
    data.modifieduser = currentUser.username;
    data.modifieddate = new Date();

    const updated = await prisma.m_user.update({ where: { id: userId }, data });
    await recordAuditEvent({
      eventType: data.password ? 'USER_PASSWORD_CHANGE' : 'USER_UPDATE',
      entityType: 'USER',
      entityId: String(userId),
      actor: currentUser.username,
      afterData: { username: updated.username, passwordChanged: Boolean(data.password) },
    });
    return NextResponse.json({ success: true, data: { id: Number(updated.id), username: updated.username } });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, error: 'Gagal mengubah user.' }, { status: 500 });
  }
}

// Deletes the login and its access rights. The employee record stays, since sales and other
// documents may still refer to it.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.userLevel !== 'Admin') {
      return NextResponse.json({ success: false, error: 'Hanya Admin yang dapat menghapus user.' }, { status: 403 });
    }
    const { id } = await params;
    const userId = Number(id);
    if (userId === currentUser.id) {
      return NextResponse.json({ success: false, error: 'Tidak bisa menghapus akun yang sedang dipakai login.' }, { status: 400 });
    }
    const user = await prisma.m_user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ success: false, error: 'User tidak ditemukan.' }, { status: 404 });

    await prisma.$transaction([
      prisma.t_usercapability.deleteMany({ where: { userid: userId } }),
      prisma.t_userpermission.deleteMany({ where: { userid: userId } }),
      prisma.erp_user_permission.deleteMany({ where: { user_id: userId } }),
      prisma.m_user.delete({ where: { id: userId } }),
    ]);
    await recordAuditEvent({
      eventType: 'USER_DELETE',
      entityType: 'USER',
      entityId: String(userId),
      actor: currentUser.username,
      beforeData: { username: user.username, employeeid: user.employeeid },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, error: 'Gagal menghapus user.' }, { status: 500 });
  }
}
