import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sale = await prisma.salesPOSHeader.findUnique({
      where: { id: Number(id) },
      include: { details: true },
    });

    if (!sale) return NextResponse.json({ success: false, error: 'Transaksi penjualan tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true, data: sale });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
