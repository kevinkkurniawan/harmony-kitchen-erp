import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const promoNo = body.promoNo || body.promo_no;
    const promoName = body.promoName || body.promo_name;
    const groupId = body.groupId ?? body.group_id;
    const discountPct = body.discountPct ?? body.discount_pct ?? body.promoPercentage;
    const promoBundle = body.promoBundle;
    const promoGrosir = body.promoGrosir;
    const promoGrosirType = body.promoGrosirType;
    const qtyMin = body.qtyMin;
    const qtyMax = body.qtyMax;
    const isPartial = body.isPartial;
    const isGroup = body.isGroup;
    const description = body.description;
    const startDate = body.startDate || body.start_date;
    const endDate = body.endDate || body.end_date;
    const isActive = body.isActive ?? body.is_active;

    const updated = await prisma.promo.update({
      where: { id: Number(id) },
      data: {
        promoNo: promoNo || undefined,
        promoName: promoName || undefined,
        groupId: groupId !== undefined ? Number(groupId) : undefined,
        promoBundle: promoBundle !== undefined ? Number(promoBundle) : undefined,
        promoGrosir: promoGrosir !== undefined ? Number(promoGrosir) : undefined,
        promoGrosirType: promoGrosirType !== undefined ? promoGrosirType : undefined,
        discountPct: discountPct !== undefined ? Number(discountPct) : undefined,
        qtyMin: qtyMin !== undefined ? Number(qtyMin) : undefined,
        qtyMax: qtyMax !== undefined ? Number(qtyMax) : undefined,
        isPartial: isPartial !== undefined ? Boolean(isPartial) : undefined,
        isGroup: isGroup !== undefined ? Boolean(isGroup) : undefined,
        description: description !== undefined ? description : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    // POS SYNC
    try {
      await posPool.query(
        `UPDATE "Promo" 
         SET "promoName" = $1, "groupId" = $2, "promoBundle" = $3, "promoGrosir" = $4, "promoGrosirType" = $5, "discountPct" = $6, "qtyMin" = $7, "qtyMax" = $8, "isPartial" = $9, "isGroup" = $10, description = $11, "startDate" = $12, "endDate" = $13, "isActive" = $14
         WHERE "promoNo" = $15`,
        [updated.promoName, updated.groupId, updated.promoBundle, updated.promoGrosir, updated.promoGrosirType, updated.discountPct, updated.qtyMin, updated.qtyMax, updated.isPartial, updated.isGroup, updated.description, updated.startDate, updated.endDate, updated.isActive, updated.promoNo]
      );
    } catch (posErr) {
      console.error('POS Sync Error (Promo PUT):', posErr);
    }

    return NextResponse.json({ success: true, message: 'Item Promo berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const promo = await prisma.promo.findUnique({ where: { id: Number(id) } });

    await prisma.promo.delete({ where: { id: Number(id) } });

    if (promo?.promoNo) {
      try {
        await posPool.query(`DELETE FROM "Promo" WHERE "promoNo" = $1`, [promo.promoNo]);
      } catch (posErr) {
        console.error('POS Sync Error (Promo DELETE):', posErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Item Promo berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
