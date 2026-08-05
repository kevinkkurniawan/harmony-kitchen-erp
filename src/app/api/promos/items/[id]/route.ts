import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      promoName,
      promoBundle,
      promoGrosir,
      promoPercentage,
      qtyMin,
      qtyMax,
      isPartial,
      isGroup,
      description,
      promoGrosirType,
      isActive,
    } = body;

    const updateQuery = `
      UPDATE m_promo SET
        promo_name = COALESCE($1, promo_name),
        promo_bundle = COALESCE($2, promo_bundle),
        promo_grosir = COALESCE($3, promo_grosir),
        promo_percentage = COALESCE($4, promo_percentage),
        qty_min = COALESCE($5, qty_min),
        qty_max = COALESCE($6, qty_max),
        is_partial = COALESCE($7, is_partial),
        is_group = COALESCE($8, is_group),
        description = COALESCE($9, description),
        promo_grosir_type = COALESCE($10, promo_grosir_type),
        is_active = COALESCE($11, is_active)
      WHERE id = $12;
    `;

    const values = [
      promoName,
      promoBundle !== undefined ? parseInt(promoBundle) : null,
      promoGrosir !== undefined ? parseFloat(promoGrosir) : null,
      promoPercentage !== undefined ? parseFloat(promoPercentage) : null,
      qtyMin !== undefined ? parseInt(qtyMin) : null,
      qtyMax !== undefined ? parseInt(qtyMax) : null,
      isPartial !== undefined ? isPartial : null,
      isGroup !== undefined ? isGroup : null,
      description,
      promoGrosirType,
      isActive !== undefined ? isActive : null,
      parseInt(id),
    ];

    await pool.query(updateQuery, values);
    return NextResponse.json({ success: true, message: 'Promo berhasil diperbarui' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await pool.query(`DELETE FROM m_promo WHERE id = $1`, [parseInt(id)]);
    return NextResponse.json({ success: true, message: 'Promo berhasil dihapus' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
