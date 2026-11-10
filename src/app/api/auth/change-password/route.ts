import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, getCurrentUser } from '@/lib/session';
import { recordAuditEvent } from '@/lib/audit-event';

// Module Manager "Change Password" (frmChangePassword): the logged-in user changes their own password.
// m_user is shared with the POS, which logs in against the same plain password column, so it is stored as-is.
export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ success: false, error: 'Sesi login diperlukan. Silakan login kembali.' }, { status: 401 });
  try {
    const { oldPassword, newPassword, confirmNewPassword } = await req.json();
    if (typeof oldPassword !== 'string' || oldPassword === '') {
      return NextResponse.json({ success: false, error: 'Old Password wajib diisi.' }, { status: 400 });
    }
    if (typeof newPassword !== 'string' || newPassword === '') {
      return NextResponse.json({ success: false, error: 'New Password wajib diisi.' }, { status: 400 });
    }
    // Same minimum as the admin password change in Setting - User
    if (newPassword.length < 4) {
      return NextResponse.json({ success: false, error: 'Password minimal 4 karakter.' }, { status: 400 });
    }
    if (newPassword !== confirmNewPassword) {
      return NextResponse.json({ success: false, error: 'Confirm New Password tidak sama dengan New Password.' }, { status: 400 });
    }

    // The old password is matched inside the update itself, so a wrong or concurrently changed one updates nothing
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.m_user.updateMany({
        where: { id: currentUser.id, password: oldPassword },
        data: { password: newPassword, modifieduser: currentUser.username, modifieddate: new Date() },
      });
      if (updated.count !== 1) return false;
      await recordAuditEvent({
        actor: currentUser.username,
        eventType: 'USER_CHANGE_PASSWORD',
        entityType: 'USER',
        entityId: String(currentUser.id),
        afterData: { username: currentUser.username, passwordChanged: true },
      }, tx);
      return true;
    });
    if (!changed) return NextResponse.json({ success: false, error: 'Old Password salah.' }, { status: 400 });
    // Other sessions of this user end with the old password; this one is renewed with the new one
    await createSession(currentUser, newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ success: false, error: 'Gagal mengubah password.' }, { status: 500 });
  }
}
