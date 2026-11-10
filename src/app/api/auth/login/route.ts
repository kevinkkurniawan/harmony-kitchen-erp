import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { usernameEquals } from '@/lib/username';
import { createSession, resolveUserLevel, SessionUser } from '@/lib/session';
import { getPermissionsForUser } from '@/lib/erp-permissions';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    // Both must be non-empty strings before they reach the query: Prisma drops undefined filters
    // (no password check at all) and treats objects as operators such as { not: '' }.
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return NextResponse.json({ success: false, error: 'Username atau password salah' }, { status: 401 });
    }
    // Usernames match ignoring case: the POS and new users use lowercase, but legacy users synced from
    // the old app can carry capitals ("Dwi" and "dwi" are the same person).
    const user = await prisma.m_user.findFirst({
      where: { username: usernameEquals(username), password },
      orderBy: { id: 'asc' },
    });
    if (!user) return NextResponse.json({ success: false, error: 'Username atau password salah' }, { status: 401 });
    // User Type shown on the User ERP page: m_user -> m_employee -> m_position.positionname
    const [userType] = await prisma.$queryRaw<{ positionname: string | null }[]>(Prisma.sql`
      SELECT p.positionname FROM m_employee e JOIN m_position p ON p.id = e.positionid WHERE e.id = ${user.employeeid}
    `);
    const sessionUser: SessionUser = {
      id: Number(user.id),
      username: user.username || '',
      userLevel: resolveUserLevel(user.username, userType?.positionname),
    };
    await createSession(sessionUser, user.password);
    const permissions = await getPermissionsForUser(sessionUser);
    return NextResponse.json({ success: true, user: { ...sessionUser, fullName: user.username || 'User', isActive: true }, permissions });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server (mungkin koneksi database). Silakan coba lagi.' }, { status: 500 });
  }
}
