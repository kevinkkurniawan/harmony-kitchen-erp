import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const i = await prisma.inventory.findUnique({
      where: { id: Number(id) },
      include: { brand: true, category: true, uom: true },
    });
    if (!i) return NextResponse.json({ success: false, error: 'Barang tidak ditemukan' }, { status: 404 });

    const mapped: any = {
      id: i.id,
      barcode: i.barcode,
      inventory_no: i.inventoryNo,
      inventoryNo: i.inventoryNo,
      inventory_name: i.inventoryName,
      inventoryName: i.inventoryName,
      category_id: i.categoryId,
      brand_id: i.brandId,
      uom_id: i.uomId,
      price: i.price,
      grosir1: i.grosir1,
      grosir2: i.grosir2,
      grosir3: i.grosir3,
      stock: i.stock,
      is_active: i.isActive,
    };

    if (authUser.hasHpp) {
      mapped.hpp = i.hpp !== null && i.hpp !== undefined ? Number(i.hpp) : null;
    }

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const data: any = {};
    if (body.inventory_no || body.inventoryNo) data.inventoryNo = body.inventory_no || body.inventoryNo;
    if (body.inventory_name || body.inventoryName) data.inventoryName = body.inventory_name || body.inventoryName;
    if (body.barcode) data.barcode = body.barcode;
    if (body.price !== undefined) data.price = Number(body.price);
    if (body.grosir1 !== undefined) data.grosir1 = Number(body.grosir1);
    if (body.grosir2 !== undefined) data.grosir2 = Number(body.grosir2);
    if (body.grosir3 !== undefined) data.grosir3 = Number(body.grosir3);
    if (body.stock !== undefined) data.stock = Number(body.stock);

    // Only allow updating HPP if user has explicit HPP grant
    if (authUser.hasHpp && body.hpp !== undefined && body.hpp !== null) {
      data.hpp = Number(body.hpp);
    }

    const updated = await prisma.inventory.update({
      where: { id: Number(id) },
      data,
    });

    const responseData: any = {
      id: updated.id,
      barcode: updated.barcode,
      inventory_no: updated.inventoryNo,
      inventory_name: updated.inventoryName,
      price: updated.price,
      stock: updated.stock,
    };

    if (authUser.hasHpp) {
      responseData.hpp = updated.hpp !== null ? Number(updated.hpp) : null;
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await prisma.inventory.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}