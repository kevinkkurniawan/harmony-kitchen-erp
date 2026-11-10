import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export const SESSION_COOKIE_NAME = 'erp_session';
const MAX_AGE_SECONDS = 60 * 60 * 8;

export interface SessionUser {
  id: number;
  username: string;
  userLevel: 'Admin' | 'Manager' | 'Supervisor' | 'Staff' | 'Kasir';
}

function secret() {
  if (process.env.NODE_ENV === 'production' && !process.env.ERP_SESSION_SECRET) {
    throw new Error('ERP_SESSION_SECRET wajib diatur pada production.');
  }
  return process.env.ERP_SESSION_SECRET || 'harmony-erp-development-session-secret';
}

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

// Client rule: Admin = User Type "Admin" (m_position.positionname) or the username "admin"; everyone else is a normal user
export function resolveUserLevel(username: string | null | undefined, userType?: string | null): SessionUser['userLevel'] {
  const isAdmin = (username || '').trim().toLowerCase() === 'admin' || (userType || '').trim().toLowerCase() === 'admin';
  return isAdmin ? 'Admin' : 'Staff';
}

// Keyed stamp of the password in the cookie (never the password itself): a changed password ends old sessions
function passwordStamp(password: string | null | undefined) {
  return sign(`pw:${password ?? ''}`).slice(0, 22);
}

export async function createSession(
  user: Omit<SessionUser, 'userLevel'> & { userLevel?: SessionUser['userLevel'] },
  password: string | null | undefined,
) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    username: user.username,
    userLevel: user.userLevel || resolveUserLevel(user.username),
    pw: passwordStamp(password),
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  })).toString('base64url');
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

// Checks the signature and expiry of a raw cookie value (no database check; see loadSessionUser)
export function verifySessionToken(raw: string | null | undefined): (SessionUser & { pw?: string }) | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & { expiresAt: number; pw?: string };
    if (!decoded.id || !decoded.username || !decoded.expiresAt || decoded.expiresAt < Date.now()) return null;
    return { id: decoded.id, username: decoded.username, userLevel: decoded.userLevel, pw: decoded.pw };
  } catch {
    return null;
  }
}

/**
 * A valid cookie whose user still matches the database: deleted, renamed or password changed (here or in the POS,
 * which shares m_user) ends the session, and a User Type change applies at once instead of after 8 hours.
 * One primary-key lookup per call; shared by getCurrentUser and the /api proxy guard.
 */
export async function loadSessionUser(raw: string | null | undefined): Promise<SessionUser | null> {
  const token = verifySessionToken(raw);
  if (!token) return null;
  const [row] = await prisma.$queryRaw<{ username: string | null; password: string | null; positionname: string | null }[]>(Prisma.sql`
    SELECT u.username, u.password, p.positionname FROM m_user u
    LEFT JOIN m_employee e ON e.id = u.employeeid LEFT JOIN m_position p ON p.id = e.positionid
    WHERE u.id = ${token.id}
  `);
  if (!row || (row.username || '').toLowerCase() !== token.username.toLowerCase()) return null;
  const stamp = passwordStamp(row.password);
  if (!token.pw || token.pw.length !== stamp.length || !timingSafeEqual(Buffer.from(token.pw), Buffer.from(stamp))) return null;
  return { id: token.id, username: row.username || token.username, userLevel: resolveUserLevel(row.username, row.positionname) };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return loadSessionUser((await cookies()).get(SESSION_COOKIE_NAME)?.value);
}
