import { NextResponse } from 'next/server';
import { getPermissionsForUser } from '@/lib/erp-permissions';
import { getCurrentUser } from '@/lib/session';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false }, { status: 401 });
  const permissions = await getPermissionsForUser(user);
  return NextResponse.json({ success: true, user: { ...user, fullName: user.username, isActive: true }, permissions });
}
