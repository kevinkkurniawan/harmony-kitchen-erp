import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Pool } from 'pg';
import crypto from 'crypto';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});
posPool.on('connect', client => client.query('SET search_path TO pos, public;'));

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { username, fullName, userLevel, isActive } = body;

    const updated = await prisma.user.update({
      where: { id: Number(id) },
      data: {
        username: username || undefined,
        fullName: fullName || undefined,
        userLevel: userLevel || undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    // Sync to POS Database
    try {
      if (updated.isActive) {
        await posPool.query(`
          INSERT INTO "User" (id, username, name, password, role, "updatedAt")
          VALUES ($1, $2, $3, '123', $4, NOW())
          ON CONFLICT (username) DO UPDATE
          SET name = EXCLUDED.name, role = EXCLUDED.role, "updatedAt" = NOW()
        `, [crypto.randomUUID(), updated.username, updated.fullName, updated.userLevel === 'Kasir' ? 'Cashier' : updated.userLevel === 'Supervisor' ? 'Supervisor' : 'Manager']);
      } else {
        await posPool.query(`DELETE FROM "User" WHERE username = $1`, [updated.username]);
      }
    } catch (posErr) {
      console.error('Failed to sync user to POS:', posErr);
    }

    return NextResponse.json({ success: true, message: 'Data user berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const uId = Number(id);

    const user = await prisma.user.findUnique({ where: { id: uId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Delete permissions first, then delete user
    await prisma.userModulePermission.deleteMany({ where: { userId: uId } });
    await prisma.user.delete({ where: { id: uId } });

    // Sync deletion to POS Database
    try {
      await posPool.query(`DELETE FROM "User" WHERE username = $1`, [user.username]);
    } catch (posErr) {
      console.error('Failed to sync user deletion to POS:', posErr);
    }

    return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
