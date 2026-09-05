import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});
posPool.on('connect', client => client.query('SET search_path TO pos, public;'));

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const groupName = body.groupName || body.group_name || body.promoName;
    const promoCode = body.promoCode;
    const description = body.description;
    const isActive = body.isActive;

    const updated = await prisma.promoGroup.update({
      where: { id: Number(id) },
      data: { 
        groupName: groupName || undefined,
        promoCode: promoCode || undefined,
        description: description !== undefined ? description : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    // POS SYNC
    try {
      await posPool.query(
        `UPDATE "PromoGroup" 
         SET "groupName" = $1, description = $2, "isActive" = $3
         WHERE "promoCode" = $4`,
        [updated.groupName, updated.description, updated.isActive, updated.promoCode]
      );
    } catch (posErr) {
      console.error('POS Sync Error (PromoGroup PUT):', posErr);
    }

    return NextResponse.json({ success: true, message: 'Group Promo berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const group = await prisma.promoGroup.findUnique({ where: { id: Number(id) } });

    await prisma.promoGroup.delete({ where: { id: Number(id) } });

    if (group?.promoCode) {
      try {
        await posPool.query(`DELETE FROM "PromoGroup" WHERE "promoCode" = $1`, [group.promoCode]);
      } catch (posErr) {
        console.error('POS Sync Error (PromoGroup DELETE):', posErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Group Promo berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
