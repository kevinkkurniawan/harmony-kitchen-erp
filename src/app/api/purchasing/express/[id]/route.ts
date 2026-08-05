import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mr = await prisma.materialReceiveHeader.findUnique({
      where: { id: Number(id) },
      include: { details: true },
    });

    if (!mr) return NextResponse.json({ success: false, error: 'Penerimaan barang tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true, data: mr });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.materialReceiveHeader.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true, message: 'Penerimaan barang berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
