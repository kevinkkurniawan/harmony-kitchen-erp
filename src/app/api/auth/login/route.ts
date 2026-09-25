import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, inferUserLevel, SessionUser } from '@/lib/session';
import { getPermissionsForUser } from '@/lib/erp-permissions';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const user = await prisma.m_user.findFirst({ where: { username, password } });
    if (!user) return NextResponse.json({ success: false, error: 'Username atau password salah' }, { status: 401 });
    const sessionUser: SessionUser = { id: Number(user.id), username: user.username || '', userLevel: inferUserLevel(user.username) };
    await createSession(sessionUser);
    const permissions = await getPermissionsForUser(sessionUser);
    return NextResponse.json({ success: true, user: { ...sessionUser, fullName: user.username || 'User', isActive: true }, permissions });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan server (mungkin koneksi database). Silakan coba lagi.' }, { status: 500 });
  }
}
