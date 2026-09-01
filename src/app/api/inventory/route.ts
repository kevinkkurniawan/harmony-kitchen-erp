import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const brand = searchParams.get('brand') || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const minusStock = searchParams.get('minusStock') === 'true';

    const paginationParams = getPaginationParams(request, 100, 2000);

    const whereCondition: any = {};
    if (onlyActive) whereCondition.isActive = true;
    if (minusStock) whereCondition.stock = { lt: 20 };
    if (category) whereCondition.category = { categoryName: category };
    if (brand) whereCondition.brand = { brandName: brand };
    if (q) {
      whereCondition.OR = [
        { barcode: { contains: q, mode: 'insensitive' } },
        { inventoryNo: { contains: q, mode: 'insensitive' } },
        { inventoryName: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.inventory.count({ where: whereCondition }),
      prisma.inventory.findMany({
        where: whereCondition,
        include: {
          category: true,
          brand: true,
          uom: true,
        },
        orderBy: { id: 'asc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = items.map((inv) => ({
      id: String(inv.id),
      barcode: inv.barcode,
      inventoryNo: inv.inventoryNo,
      inventory_no: inv.inventoryNo,
      inventoryName: inv.inventoryName,
      inventory_name: inv.inventoryName,
      inventoryBrandId: inv.brandId || undefined,
      brandName: inv.brand?.brandName || 'General',
      brand_name: inv.brand?.brandName || 'General',
      inventoryCategoryId: inv.categoryId || undefined,
      categoryName: inv.category?.categoryName || 'General',
      category_name: inv.category?.categoryName || 'General',
      uoMId: inv.uomId || undefined,
      uomName: inv.uom?.uomName || 'Pcs',
      uom_name: inv.uom?.uomName || 'Pcs',
      minStock: 5,
      maxStock: 100,
      kodeHarga: 'STD',
      description: '',
      hpp: inv.hpp,
      price: inv.price,
      priceBuy: inv.hpp,
      disc: 0,
      grosir1: Math.round(inv.price * 0.95),
      grosir2: Math.round(inv.price * 0.90),
      grosir3: Math.round(inv.price * 0.85),
      stokAwal: inv.stock,
      stokAkhir: inv.stock,
      stock: inv.stock,
      isActive: inv.isActive,
      is_active: inv.isActive,
      created_at: inv.createdAt,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { barcode, inventory_no, inventory_name, category_id, brand_id, uom_id, hpp, price, stock, is_active } = body;

    if (!barcode || !inventory_no || !inventory_name) {
      return NextResponse.json({ success: false, error: 'Barcode, Kode Barang, dan Nama Barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.inventory.create({
      data: {
        barcode,
        inventoryNo: inventory_no,
        inventoryName: inventory_name,
        categoryId: category_id ? Number(category_id) : null,
        brandId: brand_id ? Number(brand_id) : null,
        uomId: uom_id ? Number(uom_id) : null,
        hpp: Number(hpp || 0),
        price: Number(price || 0),
        stock: Number(stock || 0),
        isActive: is_active !== undefined ? Boolean(is_active) : true,
      },
    });

    return NextResponse.json({ success: true, message: 'Barang berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
