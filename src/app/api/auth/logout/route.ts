import { NextRequest, NextResponse } from 'next/server';
import { revokeCurrentSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await revokeCurrentSession(req);
    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Gagal logout' }, { status: 500 });
  }
}
