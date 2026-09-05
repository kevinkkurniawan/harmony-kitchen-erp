import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});
posPool.on('connect', client => client.query('SET search_path TO pos, public;'));

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const inv = await prisma.inventory.findUnique({
      where: { id: Number(id) },
      include: { category: true, brand: true, uom: true },
    });

    if (!inv) return NextResponse.json({ success: false, error: 'Barang tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true, data: inv });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const barcode = body.barcode;
    const inventoryNo = body.inventoryNo || body.inventory_no;
    const inventoryName = body.inventoryName || body.inventory_name;
    const categoryId = body.inventoryCategoryId ?? body.categoryId ?? body.category_id;
    const brandId = body.inventoryBrandId ?? body.brandId ?? body.brand_id;
    const uomId = body.uoMId ?? body.uomId ?? body.uom_id;
    const hpp = body.hpp;
    const price = body.price;
    const grosir1 = body.grosir1;
    const grosir2 = body.grosir2;
    const grosir3 = body.grosir3;
    const stock = body.stokAkhir ?? body.stokAwal ?? body.stock;
    const isActive = body.isActive ?? body.is_active;

    const updated = await prisma.inventory.update({
      where: { id: Number(id) },
      data: {
        barcode: barcode || undefined,
        inventoryNo: inventoryNo || undefined,
        inventoryName: inventoryName || undefined,
        categoryId: categoryId !== undefined ? Number(categoryId) : undefined,
        brandId: brandId !== undefined ? Number(brandId) : undefined,
        uomId: uomId !== undefined ? Number(uomId) : undefined,
        hpp: hpp !== undefined ? Number(hpp) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        grosir1: grosir1 !== undefined ? Number(grosir1) : undefined,
        grosir2: grosir2 !== undefined ? Number(grosir2) : undefined,
        grosir3: grosir3 !== undefined ? Number(grosir3) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    // POS SYNC
    try {
      // Get category and UOM for POS sync if they were updated, otherwise fetch current
      let catName = 'General';
      let uomNameStr = 'Pcs';
      const invCurrent = await prisma.inventory.findUnique({ where: { id: Number(id) }, include: { category: true, uom: true } });
      if (invCurrent) {
        if (invCurrent.category) catName = invCurrent.category.categoryName;
        if (invCurrent.uom) uomNameStr = invCurrent.uom.uomName;
      }
      
      const syncBarcode = barcode || invCurrent?.barcode;
      
      await posPool.query(
        `UPDATE "Product" 
         SET name = $1, category = $2, uom = $3, "priceRetail" = $4, stock = $5, "priceGrosir1" = $6, "priceGrosir2" = $7, "priceGrosir3" = $8, "updatedAt" = NOW()
         WHERE barcode = $9`,
        [
          inventoryName || invCurrent?.inventoryName, 
          catName, 
          uomNameStr, 
          price !== undefined ? Number(price) : invCurrent?.price, 
          stock !== undefined ? Number(stock) : invCurrent?.stock, 
          grosir1 !== undefined ? Number(grosir1) : invCurrent?.grosir1, 
          grosir2 !== undefined ? Number(grosir2) : invCurrent?.grosir2, 
          grosir3 !== undefined ? Number(grosir3) : invCurrent?.grosir3, 
          syncBarcode
        ]
      );
    } catch (posErr) {
      console.error('POS Sync Error on PUT:', posErr);
    }

    return NextResponse.json({ success: true, message: 'Barang berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Fetch barcode before deleting to sync with POS
    const inv = await prisma.inventory.findUnique({ where: { id: Number(id) }, select: { barcode: true } });
    
    await prisma.inventory.delete({ where: { id: Number(id) } });

    if (inv?.barcode) {
      try {
        await posPool.query(`DELETE FROM "Product" WHERE barcode = $1`, [inv.barcode]);
      } catch (posErr) {
        console.error('POS Sync Error on DELETE:', posErr);
      }
    }

    return NextResponse.json({ success: true, message: 'Barang berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
