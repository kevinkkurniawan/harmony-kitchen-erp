import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { usernameEquals } from '@/lib/username';
import { createSession, getCurrentUser } from '@/lib/session';
import { recordAuditEvent } from '@/lib/audit-event';
import { USER_TYPES } from '@/lib/user-types';
import { userTypeChangeError } from '@/lib/user-type-rule';

// Any other value is rejected as a client error (400), not a server error
class UserTypeError extends Error {}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.userLevel !== 'Admin') {
    return NextResponse.json({ success: false, error: 'Hanya Admin yang dapat melihat data user.' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const user = await prisma.m_user.findUnique({ where: { id: Number(id) } });
    if (!user) return NextResponse.json({ success: false }, { status: 404 });
    const mapped = { id: user.id, username: user.username, full_name: 'User', user_level: 'Staff', is_active: true, created_at: user.createddate };
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

// Changes the username, password and/or User Type. m_user is shared with the legacy POS, which logs in
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
    // Stored in lowercase, duplicates checked ignoring case. A name that differs only in case is not a
    // rename: a password-only edit of a legacy "Dwi" must not rename it (sales and shift reports key on it).
    const newUsername = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (newUsername && newUsername !== (existing.username || '').toLowerCase()) {
      const username = newUsername;
      const taken = await prisma.m_user.findFirst({
        where: { username: usernameEquals(username), id: { not: userId } },
      });
      if (taken) return NextResponse.json({ success: false, error: `Username "${username}" sudah dipakai.` }, { status: 400 });
      data.username = username;
    }
    if (typeof body.password === 'string' && body.password !== '') {
      if (body.password.length < 4) {
        return NextResponse.json({ success: false, error: 'Password minimal 4 karakter.' }, { status: 400 });
      }
      data.password = body.password;
    }

    const newUserType = typeof body.userType === 'string' ? body.userType.trim() : '';
    if (newUserType && !(USER_TYPES as readonly string[]).includes(newUserType)) {
      return NextResponse.json({ success: false, error: `User Type "${newUserType}" tidak dikenal.` }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // A rename can also take Admin away (username "admin"), so it runs the same check
      const typeChange = newUserType || data.username
        ? await changeUserType(tx, existing, newUserType || null, data.username ?? existing.username, currentUser.id)
        : null;
      await tx.m_user.update({ where: { id: userId }, data });
      await recordAuditEvent({
        actor: currentUser.username,
        eventType: 'USER_UPDATE',
        entityType: 'USER',
        entityId: String(userId),
        beforeData: { username: existing.username, ...(typeChange && { userType: typeChange.before }) },
        afterData: {
          username: data.username ?? existing.username,
          passwordChanged: data.password !== undefined,
          ...(typeChange && { userType: typeChange.after }),
        },
      }, tx);
      return { userTypeChanged: Boolean(typeChange && typeChange.before !== typeChange.after) };
    });
    // Editing your own name or password ends sessions on the old values; keep this one logged in
    if (userId === currentUser.id && (data.username || data.password !== undefined)) {
      const fresh = await prisma.m_user.findUnique({ where: { id: userId }, select: { username: true, password: true } });
      await createSession({ id: userId, username: fresh?.username || currentUser.username, userLevel: currentUser.userLevel }, fresh?.password);
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof UserTypeError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, error: error.message || 'Gagal mengubah user' }, { status: 500 });
  }
}

// User Type lives on the employee: m_user.employeeid -> m_employee.positionid -> m_position.positionname.
// An advisory lock serialises User Type changes, so two Admins demoting each other at once cannot both
// pass the last-Admin check.
async function changeUserType(
  tx: Prisma.TransactionClient,
  user: { id: bigint; username: string | null; employeeid: number },
  userType: string | null,
  newUsername: string | null,
  actorId: number,
): Promise<{ before: string | null; after: string | null }> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('erp-user-type'))`;
  const employee = await tx.m_employee.findUnique({ where: { id: user.employeeid } });
  if (userType) {
    if (!employee) throw new UserTypeError('Data employee user ini tidak ditemukan, User Type tidak dapat diubah.');
    const sharing = await tx.m_user.count({ where: { employeeid: user.employeeid } });
    if (sharing > 1) throw new UserTypeError('Employee user ini dipakai lebih dari satu user, User Type tidak dapat diubah di sini.');
  }
  const current = employee?.positionid != null
    ? await tx.m_position.findUnique({ where: { id: employee.positionid } })
    : null;
  const before = current?.positionname ?? null;
  const after = userType ?? before;
  if (before === after && newUsername === user.username) return { before, after };

  // The user table is small (store staff), so the Admin rule runs in code instead of being duplicated in SQL
  const others = await tx.$queryRaw<{ username: string | null; positionname: string | null }[]>`
    SELECT u.username, p.positionname FROM m_user u
    LEFT JOIN m_employee e ON e.id = u.employeeid LEFT JOIN m_position p ON p.id = e.positionid
    WHERE u.id <> ${user.id}`;
  const refused = userTypeChangeError(
    { id: Number(user.id), username: user.username, userType: before }, after, actorId, others, newUsername,
  );
  if (refused) throw new UserTypeError(refused);
  if (!userType || before === userType || !employee) return { before, after };

  // Same lookup as Add User: reuse the position with this name, create it when missing
  const position = await tx.m_position.findFirst({ where: { positionname: userType }, orderBy: { id: 'asc' } })
    ?? await tx.m_position.create({ data: { positionname: userType, isactive: true } });
  await tx.m_employee.update({
    where: { id: employee.id },
    data: { positionid: Number(position.id), modifieddate: new Date() },
  });
  return { before, after: userType };
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
