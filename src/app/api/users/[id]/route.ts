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

// Changes the username and/or password. m_user is shared with the legacy POS, which logs in
// against the same plain password column, so it is stored as-is.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.userLevel !== 'Admin') {
    return NextResponse.json({ success: false, error: 'Hanya Admin yang dapat mengubah user.' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const userId = Number(id);
    const body = await req.json();
    const existing = await prisma.m_user.findUnique({ where: { id: userId } });
    if (!existing) return NextResponse.json({ success: false, error: 'User tidak ditemukan.' }, { status: 404 });

    const data: { username?: string; password?: string; modifieduser: string; modifieddate: Date } = {
      modifieduser: currentUser.username,
      modifieddate: new Date(),
    };
    if (typeof body.username === 'string' && body.username.trim() && body.username.trim() !== existing.username) {
      const username = body.username.trim();
      const taken = await prisma.m_user.findFirst({ where: { username, id: { not: userId } } });
      if (taken) return NextResponse.json({ success: false, error: `Username "${username}" sudah dipakai.` }, { status: 400 });
      data.username = username;
    }
    if (typeof body.password === 'string' && body.password !== '') {
      if (body.password.length < 4) {
        return NextResponse.json({ success: false, error: 'Password minimal 4 karakter.' }, { status: 400 });
      }
      data.password = body.password;
    }

    await prisma.$transaction(async (tx) => {
      await tx.m_user.update({ where: { id: userId }, data });
      await recordAuditEvent({
        actor: currentUser.username,
        eventType: 'USER_UPDATE',
        entityType: 'USER',
        entityId: String(userId),
        beforeData: { username: existing.username },
        afterData: { username: data.username ?? existing.username, passwordChanged: data.password !== undefined },
      }, tx);
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, error: error.message || 'Gagal mengubah user' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.userLevel !== 'Admin') {
    return NextResponse.json({ success: false, error: 'Hanya Admin yang dapat menghapus user.' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const userId = Number(id);
    if (userId === currentUser.id) {
      return NextResponse.json({ success: false, error: 'Tidak dapat menghapus akun yang sedang dipakai login.' }, { status: 400 });
    }
    const existing = await prisma.m_user.findUnique({ where: { id: userId } });
    if (!existing) return NextResponse.json({ success: false, error: 'User tidak ditemukan.' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.t_userpermission.deleteMany({ where: { userid: userId } });
      await tx.t_usercapability.deleteMany({ where: { userid: userId } });
      await tx.m_user.delete({ where: { id: userId } });
      await recordAuditEvent({
        actor: currentUser.username,
        eventType: 'USER_DELETE',
        entityType: 'USER',
        entityId: String(userId),
        beforeData: { username: existing.username, employeeId: existing.employeeid },
      }, tx);
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, error: error.message || 'Gagal menghapus user' }, { status: 500 });
  }
}
