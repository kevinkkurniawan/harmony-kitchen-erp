import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { promoCode, promoName, description, isActive } = body;

    const updateQuery = `
      UPDATE m_promo_group SET
        promo_code = COALESCE($1, promo_code),
        promo_name = COALESCE($2, promo_name),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active)
      WHERE id = $5;
    `;

    const values = [
      promoCode,
      promoName,
      description,
      isActive !== undefined ? isActive : null,
      parseInt(id),
    ];

    await pool.query(updateQuery, values);
    return NextResponse.json({ success: true, message: 'Kelompok promo berhasil diperbarui' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await pool.query(`DELETE FROM m_promo_group WHERE id = $1`, [parseInt(id)]);
    return NextResponse.json({ success: true, message: 'Kelompok promo berhasil dihapus' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
