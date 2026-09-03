import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const groupName = body.groupName || body.group_name || body.promoName;

    const updated = await prisma.promoGroup.update({
      where: { id: Number(id) },
      data: { groupName: groupName || undefined },
    });

    return NextResponse.json({ success: true, message: 'Group Promo berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.promoGroup.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true, message: 'Group Promo berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
