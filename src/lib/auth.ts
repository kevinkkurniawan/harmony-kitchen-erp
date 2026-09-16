import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { prisma } from './db';

const COOKIE_NAME = 'hk_session';
const SESSION_TTL_DAYS = 7;

// --- Password Hashing & Upgrade Helpers ---

export function hashPassword(plainPassword: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 10000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

export function verifyPassword(plainPassword: string, storedPassword: string): boolean {
  if (!storedPassword) return false;

  // Hashed format: pbkdf2:<salt>:<hash>
  if (storedPassword.startsWith('pbkdf2:')) {
    const parts = storedPassword.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHash] = parts;
    const computedHash = crypto.pbkdf2Sync(plainPassword, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(computedHash, 'hex'));
  }

  // Legacy plaintext compatibility check
  return plainPassword === storedPassword;
}

// --- Session Management ---

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName: string;
  userLevel: string;
  modulePermissions: Record<string, { canView: boolean; canAdd: boolean; canEdit: boolean; canDelete: boolean; canPrint: boolean }>;
  grants: string[];
  hasHpp: boolean;
  canViewAllCashiers: boolean;
  canManageGrants: boolean;
}

export async function createSession(userId: number, userAgent?: string, ipAddress?: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
  });

  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  } catch {
    // cookies() is only available within an active Next.js request lifecycle
  }

  return rawToken;
}

export async function getSessionToken(req?: NextRequest | Request): Promise<string | null> {
  if (req) {
    const cookie = (req as NextRequest).cookies?.get?.(COOKIE_NAME);
    if (cookie?.value) return cookie.value;
    const cookieHeader = req.headers?.get?.('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
      if (match) return decodeURIComponent(match[1]);
    }
    const authHeader = req.headers?.get?.('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(COOKIE_NAME)?.value || null;
  } catch {
    return null;
  }
}

export async function resolveSession(req?: NextRequest): Promise<AuthenticatedUser | null> {
  const token = await getSessionToken(req);
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          permissions: true,
          grants: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  const grants = session.user.grants.map((g) => g.permissionKey);
  const permMap: AuthenticatedUser['modulePermissions'] = {};
  session.user.permissions.forEach((p) => {
    permMap[p.moduleCode] = {
      canView: p.canView,
      canAdd: p.canAdd,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
      canPrint: p.canPrint,
    };
  });

  return {
    id: session.user.id,
    username: session.user.username,
    fullName: session.user.fullName,
    userLevel: session.user.userLevel,
    modulePermissions: permMap,
    grants,
    hasHpp: grants.includes('inventory.viewHpp'),
    canViewAllCashiers: grants.includes('reports.viewAllCashiers'),
    canManageGrants: grants.includes('auth.manageGrants'),
  };
}

export async function revokeCurrentSession(req?: NextRequest): Promise<void> {
  const token = await getSessionToken(req);
  if (token) {
    const tokenHash = hashToken(token);
    await prisma.authSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {}
}
