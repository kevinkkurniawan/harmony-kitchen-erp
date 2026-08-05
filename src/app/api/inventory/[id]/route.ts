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
    const { barcode, inventory_no, inventory_name, category_id, brand_id, uom_id, hpp, price, stock, is_active } = body;

    const updated = await prisma.inventory.update({
      where: { id: Number(id) },
      data: {
        barcode,
        inventoryNo: inventory_no,
        inventoryName: inventory_name,
        categoryId: category_id ? Number(category_id) : undefined,
        brandId: brand_id ? Number(brand_id) : undefined,
        uomId: uom_id ? Number(uom_id) : undefined,
        hpp: hpp !== undefined ? Number(hpp) : undefined,
        price: price !== undefined ? Number(price) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        isActive: is_active !== undefined ? Boolean(is_active) : undefined,
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
