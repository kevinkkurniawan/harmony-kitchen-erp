import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { Pool } from 'pg';
import crypto from 'crypto';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { fullName: { contains: q, mode: 'insensitive' as const } },
            { userLevel: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    return createPaginatedResponse(users, total, paginationParams);
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

    // Sync to POS Database
    try {
      await posPool.query(`
        INSERT INTO "User" (id, username, name, password, role, "updatedAt")
        VALUES ($1, $2, $3, '123', $4, NOW())
        ON CONFLICT (username) DO UPDATE
        SET name = EXCLUDED.name, role = EXCLUDED.role, "updatedAt" = NOW()
      `, [crypto.randomUUID(), username, fullName, userLevel === 'Kasir' ? 'Cashier' : userLevel === 'Supervisor' ? 'Supervisor' : 'Manager']);
    } catch (posErr) {
      console.error('Failed to sync user to POS:', posErr);
      // We still return success for ERP, but maybe log it
    }

    return NextResponse.json({ success: true, message: 'User berhasil dibuat', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/users:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
