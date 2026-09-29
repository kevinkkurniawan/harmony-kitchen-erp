import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { hasCapability, requireCapability } from '@/lib/capabilities';
import { normalizeInventoryName, validateInventoryName } from '@/lib/inventory-name';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const mayViewHpp = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const i = await prisma.m_inventory.findUnique({
      where: { id: Number(id) },
      include: { m_brand: true, m_uom: true },
    });

    if (!i) return apiError('NOT_FOUND', 'Barang tidak ditemukan.', 404);

    let wc = null;
    if (i.wholesalecategoryid) {
      wc = await prisma.m_wholesalecategory.findUnique({ where: { id: i.wholesalecategoryid } });
    }

    const mapped = {
      id: i.id,
      barcode: i.barcode,
      inventory_no: i.inventoryno,
      inventoryNo: i.inventoryno,
      inventory_name: i.inventoryname,
      inventoryName: i.inventoryname,
      category_id: i.inventorycategoryid,
      brand_id: i.inventorybrandid ? Number(i.inventorybrandid) : null,
      brandName: i.m_brand?.brandname || 'General',
      uom_id: i.uomid ? Number(i.uomid) : null,
      uomName: i.m_uom?.uomname || 'Pcs',
      ...(mayViewHpp ? { hpp: Number(i.hpp || 0) } : {}),
      price: Number(i.price || 0),
      priceBuy: Number(i.pricebuy || 0),
      grosir1: i.grosir1 ? Number(i.grosir1) : null,
      grosir2: i.grosir2 ? Number(i.grosir2) : null,
      grosir3: i.grosir3 ? Number(i.grosir3) : null,
      wholesaleCategoryId: i.wholesalecategoryid,
      wholesaleCategory: wc,
      stock: Number(i.stokupdate || 0),
      is_active: Boolean(i.isactive ?? true),
      isActive: Boolean(i.isactive ?? true),
    };

    return apiSuccess(mapped);
  } catch (error: any) {
    return apiError('INTERNAL_ERROR', error.message, 500);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCapability('INVENTORY_EDIT');
    if ('errorResponse' in auth) return auth.errorResponse;

    const user = auth.user;
    const mayViewHpp = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const { id } = await params;
    const body = await req.json();

    if (!mayViewHpp && body.hpp !== undefined && Number(body.hpp) > 0) {
      return apiError('FORBIDDEN', 'Anda tidak memiliki hak akses untuk mengubah HPP.', 403);
    }

    const incomingName = body.inventoryName ?? body.inventory_name;
    if (incomingName !== undefined) {
      const nameError = validateInventoryName(incomingName);
      if (nameError) return apiError('VALIDATION_ERROR', nameError, 400);
    }

    const data: Record<string, any> = {
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
      grosir1: body.grosir1 !== undefined ? (body.grosir1 ? Number(body.grosir1) : null) : undefined,
      grosir2: body.grosir2 !== undefined ? (body.grosir2 ? Number(body.grosir2) : null) : undefined,
      grosir3: body.grosir3 !== undefined ? (body.grosir3 ? Number(body.grosir3) : null) : undefined,
      wholesalecategoryid: body.wholesaleCategoryId !== undefined 
        ? (body.wholesaleCategoryId ? Number(body.wholesaleCategoryId) : null) 
        : (body.wholesalecategoryid !== undefined ? (body.wholesalecategoryid ? Number(body.wholesalecategoryid) : null) : undefined),
      isactive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
      stokawal: body.stokAwal !== undefined ? Number(body.stokAwal) : undefined,
    };
    
    // Clean up undefined fields so we don't overwrite with nulls if omitted
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    const updated = await prisma.m_inventory.update({ where: { id: Number(id) }, data });
    return apiSuccess(updated, 'Data barang berhasil diperbarui.');
  } catch (error: any) {
    console.error('Update error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal memperbarui barang', 500);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireCapability('INVENTORY_EDIT');
    if ('errorResponse' in auth) return auth.errorResponse;

    const { id } = await params;
    await prisma.m_inventory.delete({ where: { id: Number(id) } });
    return apiSuccess(null, 'Barang berhasil dihapus.');
  } catch (error: any) { 
    if (error?.code === 'P2003') {
      return apiError('CONFLICT', 'Barang tidak bisa dihapus karena sudah memiliki riwayat transaksi. Silakan ubah status menjadi Non-Aktif.', 409);
    }
    return apiError('INTERNAL_ERROR', error.message || 'Gagal menghapus barang', 500);
  }
}
