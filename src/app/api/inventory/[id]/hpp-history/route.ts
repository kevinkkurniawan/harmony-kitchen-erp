import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const inv = await prisma.inventory.findUnique({
      where: { id: Number(id) },
    });

    if (!inv) return NextResponse.json({ success: false, error: 'Barang tidak ditemukan' }, { status: 404 });

    const history = [
      { id: 1, date: new Date().toISOString(), type: 'Saldo Awal', qty: inv.stock, hpp: inv.hpp, note: 'Saldo Awal Sistem ERP' }
    ];

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
