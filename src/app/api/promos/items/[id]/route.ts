import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const promoNo = body.promoNo || body.promo_no;
    const promoName = body.promoName || body.promo_name;
    const groupId = body.groupId ?? body.group_id;
    const discountPct = body.discountPct ?? body.discount_pct ?? body.promoPercentage;
    const startDate = body.startDate || body.start_date;
    const endDate = body.endDate || body.end_date;
    const isActive = body.isActive ?? body.is_active;

    const updated = await prisma.promo.update({
      where: { id: Number(id) },
      data: {
        promoNo: promoNo || undefined,
        promoName: promoName || undefined,
        groupId: groupId !== undefined ? Number(groupId) : undefined,
        discountPct: discountPct !== undefined ? Number(discountPct) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
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
