import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
// import * as jose from 'jose';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const user = await prisma.m_user.findFirst({ where: { username, password } });
    if (!user) return NextResponse.json({ success: false }, { status: 401 });
    const cookieStore = await cookies();
    const token = 'mock_token';
    cookieStore.set('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    return NextResponse.json({ success: true, token, user: { id: user.id, username: user.username, fullName: 'User', userLevel: 'Staff' } });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
