import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/api-response';
import { decideWrite, isPublicApiPath, isWriteMethod } from '@/lib/api-access';
import { getPermissionsForUser } from '@/lib/erp-permissions';
import { SESSION_COOKIE_NAME, loadSessionUser } from '@/lib/session';

// One guard for every /api route: a valid ERP session is required, and a non-admin write needs the
// view tick of the module that owns the path. Reads stay as before (the menu already hides pages).
// Proxy runs on the Node.js runtime in Next 16, so it can verify the HMAC cookie and query permissions.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicApiPath(pathname)) return NextResponse.next();

  let user;
  try {
    user = await loadSessionUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch (error) {
    // The session check reads m_user: a database outage must answer as JSON, not as an HTML error page
    console.error('proxy session check error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Server tidak dapat menghubungi database. Silakan coba lagi.', 503);
  }
  if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan. Silakan login kembali.', 401);

  if (!isWriteMethod(request.method) || user.userLevel === 'Admin') return NextResponse.next();

  // Only non-admin writes pay for the permission query
  const decision = decideWrite(pathname, await getPermissionsForUser(user));
  if (!decision.allowed) return apiError('FORBIDDEN', decision.message, 403);
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
