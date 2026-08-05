import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    console.error('Error in GET /api/users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, fullName, userLevel = 'Kasir' } = body;

    if (!username || !fullName) {
      return NextResponse.json({ success: false, error: 'Username dan Nama Lengkap wajib diisi' }, { status: 400 });
    }

    const created = await prisma.user.create({
      data: {
        username,
        fullName,
        userLevel,
      },
    });

    return NextResponse.json({ success: true, message: 'User berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
