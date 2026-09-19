import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, inferUserLevel } from '@/lib/session';
import { getPermissionsForUser } from '@/lib/erp-permissions';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const user = await prisma.m_user.findFirst({ where: { username, password } });
    if (!user) return NextResponse.json({ success: false }, { status: 401 });
    const sessionUser = { id: user.id, username: user.username || '', userLevel: inferUserLevel(user.username) };
    await createSession(sessionUser);
    const permissions = await getPermissionsForUser(sessionUser);
    return NextResponse.json({ success: true, user: { ...sessionUser, fullName: user.username || 'User', isActive: true }, permissions });
  } catch { return NextResponse.json({ success: false }, { status: 500 }); }
}
