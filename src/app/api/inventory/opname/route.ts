import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inventoryId, qtyOpname } = body;

    if (!inventoryId || qtyOpname === undefined) {
      return NextResponse.json({ success: false, error: 'inventoryId and qtyOpname are required' }, { status: 400 });
    }

    // Update stok_update in m_inventory
    await pool.query(
      `UPDATE m_inventory SET stok_update = $1 WHERE id = $2`,
      [parseInt(qtyOpname), parseInt(inventoryId)]
    );

    return NextResponse.json({
      success: true,
      message: `Opname berhasil! Stok fisik diperbarui menjadi ${qtyOpname}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
