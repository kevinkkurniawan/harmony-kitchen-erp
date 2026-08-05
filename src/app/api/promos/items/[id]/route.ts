import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { promo_no, promo_name, group_id, discount_pct, start_date, end_date, is_active } = body;

    const updated = await prisma.promo.update({
      where: { id: Number(id) },
      data: {
        promoNo: promo_no,
        promoName: promo_name,
        groupId: group_id ? Number(group_id) : undefined,
        discountPct: discount_pct !== undefined ? Number(discount_pct) : undefined,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Item Promo berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.promo.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true, message: 'Item Promo berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
