import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'erp_session';
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

export function inferUserLevel(username: string | null | undefined): SessionUser['userLevel'] {
  const name = (username || '').toLowerCase();
  if (name === 'admin') return 'Admin';
  if (name.includes('manager')) return 'Manager';
  if (name.includes('supervisor')) return 'Supervisor';
  if (name.includes('kasir')) return 'Kasir';
  return 'Staff';
}

export async function createSession(user: Omit<SessionUser, 'userLevel'> & { userLevel?: SessionUser['userLevel'] }) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    username: user.username,
    userLevel: user.userLevel || inferUserLevel(user.username),
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  })).toString('base64url');
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const separator = raw.lastIndexOf('.');
  if (separator < 1) return null;
  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & { expiresAt: number };
    if (!decoded.id || !decoded.username || !decoded.expiresAt || decoded.expiresAt < Date.now()) return null;
    return { id: decoded.id, username: decoded.username, userLevel: decoded.userLevel };
  } catch {
    return null;
  }
}
