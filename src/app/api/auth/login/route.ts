import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, verifyPassword, hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        username: { equals: String(username).trim(), mode: 'insensitive' },
      },
      include: {
        permissions: true,
        grants: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan atau non-aktif' }, { status: 401 });
    }

    const isValid = verifyPassword(String(password), user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, error: 'Password salah' }, { status: 401 });
    }

    // Upgrade plaintext password to secure hash transparently
    if (!user.password.startsWith('pbkdf2:')) {
      const secureHash = hashPassword(String(password));
      await prisma.user.update({
        where: { id: user.id },
        data: { password: secureHash },
      });
    }

    const userAgent = req.headers.get('user-agent') || undefined;
    const ipAddress = req.headers.get('x-forwarded-for') || undefined;
    const sessionToken = await createSession(user.id, userAgent, ipAddress);

    const grants = user.grants.map((g) => g.permissionKey);

    return NextResponse.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        userLevel: user.userLevel,
        isActive: user.isActive,
        hasHpp: grants.includes('inventory.viewHpp'),
        canViewAllCashiers: grants.includes('reports.viewAllCashiers'),
        canManageGrants: grants.includes('auth.manageGrants'),
      },
      permissions: user.permissions.map((p) => ({
        id: p.id,
        userId: p.userId,
        moduleCode: p.moduleCode,
        canView: p.canView,
        canAdd: p.canAdd,
        canEdit: p.canEdit,
        canDelete: p.canDelete,
        canPrint: p.canPrint,
      })),
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Gagal autentikasi' }, { status: 500 });
  }
}
