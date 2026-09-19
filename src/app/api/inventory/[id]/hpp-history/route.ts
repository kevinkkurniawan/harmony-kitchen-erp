import { NextResponse } from 'next/server';
import { canViewHpp } from '@/lib/erp-permissions';

export async function GET(request: Request) {
  if (!(await canViewHpp())) return NextResponse.json({ success: false, error: 'Anda tidak memiliki hak akses untuk melihat HPP.' }, { status: 403 });
  return NextResponse.json({ success: true, data: [], items: [] });
}
export async function POST(request: Request) {
  return NextResponse.json({ success: true, data: [] });
}
export async function PUT(request: Request) {
  return NextResponse.json({ success: true, data: [] });
}
export async function DELETE(request: Request) {
  return NextResponse.json({ success: true });
}
