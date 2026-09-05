import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await prisma.m_user.findUnique({ where: { id: Number(id) } });
    if (!user) return NextResponse.json({ success: false }, { status: 404 });
    const mapped = { id: user.id, username: user.username, full_name: 'User', user_level: 'Staff', is_active: true, created_at: user.createddate };
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await prisma.m_user.update({ where: { id: Number(id) }, data: { username: body.username, password: body.password } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.m_user.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}