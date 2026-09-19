import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { canViewHpp } from '@/lib/erp-permissions';
import { normalizeInventoryName, validateInventoryName } from '@/lib/inventory-name';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mayViewHpp = await canViewHpp();
    const i = await prisma.inventory.findUnique({ where: { id: Number(id) } });
    if (!i) return NextResponse.json({ success: false }, { status: 404 });
    const mapped = { id: i.id, barcode: i.barcode, inventory_no: i.inventoryno, inventory_name: i.inventoryname, category_id: null, brand_id: null, uom_id: null, ...(mayViewHpp ? { hpp: Number(i.hpp || 0) } : {}), price: i.price, grosir1: i.grosir1, grosir2: i.grosir2, grosir3: i.grosir3, stock: 0, is_active: true };
    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const mayViewHpp = await canViewHpp();
    if (!mayViewHpp && body.hpp !== undefined) return NextResponse.json({ success: false, error: 'Anda tidak memiliki hak akses untuk mengubah HPP.' }, { status: 403 });
    const incomingName = body.inventoryName ?? body.inventory_name;
    if (incomingName !== undefined) {
      const nameError = validateInventoryName(incomingName);
      if (nameError) return NextResponse.json({ success: false, error: nameError }, { status: 400 });
    }
    const data = {
      inventoryno: body.inventoryNo || body.inventory_no,
      inventoryname: incomingName !== undefined ? normalizeInventoryName(incomingName) : undefined,
      barcode: body.barcode || body.inventoryNo || body.inventory_no,
      inventorybrandid: body.inventoryBrandId ? Number(body.inventoryBrandId) : undefined,
      inventorycategoryid: body.inventoryCategoryId ? Number(body.inventoryCategoryId) : undefined,
      inventoryproductid: body.inventoryProductId ? Number(body.inventoryProductId) : undefined,
      uomid: body.uoMId ? Number(body.uoMId) : undefined,
      minstock: body.minStock !== undefined ? Number(body.minStock) : undefined,
      maxstock: body.maxStock !== undefined ? Number(body.maxStock) : undefined,
      kodeharga: body.kodeHarga,
      description: body.description,
      hpp: mayViewHpp && body.hpp !== undefined ? Number(body.hpp) : undefined,
      price: body.price !== undefined ? Number(body.price) : undefined,
      pricebuy: body.priceBuy !== undefined ? Number(body.priceBuy) : undefined,
      grosir1: body.grosir1 !== undefined ? Number(body.grosir1) : null,
      grosir2: body.grosir2 !== undefined ? Number(body.grosir2) : null,
      grosir3: body.grosir3 !== undefined ? Number(body.grosir3) : null,
      isactive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      stokawal: body.stokAwal !== undefined ? Number(body.stokAwal) : undefined,
    };
    
    // Clean up undefined fields so we don't overwrite with nulls if omitted
    Object.keys(data).forEach(key => data[key as keyof typeof data] === undefined && delete data[key as keyof typeof data]);

    const updated = await prisma.inventory.update({ where: { id: Number(id) }, data });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Update error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.inventory.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) { 
    if (error?.code === 'P2003') {
      return NextResponse.json({ 
        success: false, 
        error: 'Barang tidak bisa dihapus karena sudah memiliki riwayat transaksi. Silakan ubah status menjadi Non-Aktif.' 
      }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 }); 
  }
}
