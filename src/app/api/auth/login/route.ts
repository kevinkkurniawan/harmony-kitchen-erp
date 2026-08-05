import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan Password wajib diisi' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.password !== password) {
      return NextResponse.json({ success: false, error: 'Username atau Password salah' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ success: false, error: 'Akun Anda sedang non-aktif' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        userLevel: user.userLevel,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/auth/login:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
