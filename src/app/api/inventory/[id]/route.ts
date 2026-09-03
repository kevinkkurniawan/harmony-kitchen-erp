import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
        stock: stock !== undefined ? Number(stock) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    return NextResponse.json({ success: true, message: 'Barang berhasil diperbarui', data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.inventory.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true, message: 'Barang berhasil dihapus' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
