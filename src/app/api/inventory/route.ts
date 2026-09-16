import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { resolveSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 100, 2000);

    const where: any = {};
    if (q) {
      where.OR = [
        { inventoryNo: { contains: q, mode: 'insensitive' as const } },
        { inventoryName: { contains: q, mode: 'insensitive' as const } },
        { barcode: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.inventory.count({ where }),
      prisma.inventory.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
        include: {
          brand: true,
          category: true,
          uom: true,
        },
      }),
    ]);

    const mapped = items.map((i) => {
      const item: any = {
        id: String(i.id),
        barcode: i.barcode,
        inventoryNo: i.inventoryNo,
        inventory_no: i.inventoryNo,
        inventoryName: i.inventoryName,
        inventory_name: i.inventoryName,
        inventoryBrandId: i.brandId,
        brandName: i.brand?.brandName || 'General',
        brand_name: i.brand?.brandName || 'General',
        inventoryCategoryId: i.categoryId,
        categoryName: i.category?.categoryName || 'General',
        category_name: i.category?.categoryName || 'General',
        uoMId: i.uomId,
        uomName: i.uom?.uomName || 'Pcs',
        uom_name: i.uom?.uomName || 'Pcs',
        minStock: 5,
        maxStock: 100,
        kodeHarga: 'STD',
        description: '',
        price: Number(i.price || 0),
        grosir1: Number(i.grosir1 || i.price || 0),
        grosir2: Number(i.grosir2 || i.price || 0),
        grosir3: Number(i.grosir3 || i.price || 0),
        stock: Number(i.stock || 0),
        isActive: i.isActive,
        is_active: i.isActive,
        createdAt: i.createdAt.toISOString(),
        created_at: i.createdAt.toISOString(),
      };

      // Explicit HPP Protection: only project HPP if caller has verified inventory.viewHpp grant
      if (authUser.hasHpp) {
        // Authoritative inventory cost value, distinguishing true zero from null/unavailable
        item.hpp = i.hpp !== null && i.hpp !== undefined ? Number(i.hpp) : null;
      }

      return item;
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    const data: any = {
      inventoryNo: body.inventory_no || body.inventoryNo,
      inventoryName: body.inventory_name || body.inventoryName,
      barcode: body.barcode || body.inventory_no || body.inventoryNo,
      price: Number(body.price) || 0,
      grosir1: Number(body.grosir1) || Number(body.price) || 0,
      grosir2: Number(body.grosir2) || Number(body.price) || 0,
      grosir3: Number(body.grosir3) || Number(body.price) || 0,
      stock: Number(body.stock) || 0,
    };

    // Only allow setting HPP if user has explicit HPP permission
    if (authUser.hasHpp && body.hpp !== undefined && body.hpp !== null) {
      data.hpp = Number(body.hpp);
    }

    const created = await prisma.inventory.create({ data });

    const responseData: any = {
      id: created.id,
      barcode: created.barcode,
      inventoryNo: created.inventoryNo,
      inventoryName: created.inventoryName,
      price: created.price,
      stock: created.stock,
    };

    if (authUser.hasHpp) {
      responseData.hpp = created.hpp !== null ? Number(created.hpp) : null;
    }

    return NextResponse.json({ success: true, data: responseData });
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
