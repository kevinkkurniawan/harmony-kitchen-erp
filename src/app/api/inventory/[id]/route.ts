import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      inventoryNo,
      barcode,
      inventoryName,
      inventoryBrandId,
      inventoryCategoryId,
      inventoryProductId,
      uoMId,
      minStock,
      maxStock,
      kodeHarga,
      description,
      price,
      disc,
      isActive,
      hpp,
      priceBuy,
      grosir1,
      grosir2,
      grosir3,
      stokAkhir,
    } = body;

    const updateQuery = `
      UPDATE m_inventory SET
        inventory_no = COALESCE($1, inventory_no),
        barcode = COALESCE($2, barcode),
        inventory_name = COALESCE($3, inventory_name),
        inventory_brand_id = COALESCE($4, inventory_brand_id),
        inventory_category_id = COALESCE($5, inventory_category_id),
        inventory_product_id = COALESCE($6, inventory_product_id),
        uom_id = COALESCE($7, uom_id),
        min_stock = COALESCE($8, min_stock),
        max_stock = COALESCE($9, max_stock),
        kode_harga = COALESCE($10, kode_harga),
        description = COALESCE($11, description),
        price = COALESCE($12, price),
        disc = COALESCE($13, disc),
        is_active = COALESCE($14, is_active),
        hpp = COALESCE($15, hpp),
        price_buy = COALESCE($16, price_buy),
        grosir1 = COALESCE($17, grosir1),
        grosir2 = COALESCE($18, grosir2),
        grosir3 = COALESCE($19, grosir3),
        stok_update = COALESCE($20, stok_update)
      WHERE id = $21;
    `;

    const values = [
      inventoryNo,
      barcode,
      inventoryName,
      inventoryBrandId ? parseInt(inventoryBrandId) : null,
      inventoryCategoryId ? parseInt(inventoryCategoryId) : null,
      inventoryProductId ? parseInt(inventoryProductId) : null,
      uoMId ? parseInt(uoMId) : null,
      minStock !== undefined ? parseInt(minStock) : null,
      maxStock !== undefined ? parseInt(maxStock) : null,
      kodeHarga,
      description,
      price !== undefined ? parseFloat(price) : null,
      disc !== undefined ? parseFloat(disc) : null,
      isActive !== undefined ? isActive : null,
      hpp !== undefined ? parseFloat(hpp) : null,
      priceBuy !== undefined ? parseFloat(priceBuy) : null,
      grosir1 !== undefined ? parseFloat(grosir1) : null,
      grosir2 !== undefined ? parseFloat(grosir2) : null,
      grosir3 !== undefined ? parseFloat(grosir3) : null,
      stokAkhir !== undefined ? parseInt(stokAkhir) : null,
      parseInt(id),
    ];

    await pool.query(updateQuery, values);
    return NextResponse.json({ success: true, message: 'Data barang berhasil diperbarui' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await pool.query(`DELETE FROM m_inventory WHERE id = $1`, [parseInt(id)]);
    return NextResponse.json({ success: true, message: 'Barang berhasil dihapus' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
