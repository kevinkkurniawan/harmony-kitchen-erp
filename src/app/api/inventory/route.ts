import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});
posPool.on('connect', client => client.query('SET search_path TO pos, public;'));

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
      grosir1: inv.grosir1,
      grosir2: inv.grosir2,
      grosir3: inv.grosir3,
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
    const barcode = body.barcode;
    const inventoryNo = body.inventoryNo || body.inventory_no;
    const inventoryName = body.inventoryName || body.inventory_name;
    const categoryId = body.inventoryCategoryId ?? body.categoryId ?? body.category_id;
    const brandId = body.inventoryBrandId ?? body.brandId ?? body.brand_id;
    const uomId = body.uoMId ?? body.uomId ?? body.uom_id;
    const hpp = body.hpp;
    const price = body.price;
    const grosir1 = body.grosir1 ?? 0;
    const grosir2 = body.grosir2 ?? 0;
    const grosir3 = body.grosir3 ?? 0;
    const stock = body.stokAkhir ?? body.stokAwal ?? body.stock ?? 0;
    const isActive = body.isActive ?? body.is_active ?? true;

    if (!barcode || !inventoryNo || !inventoryName) {
      return NextResponse.json({ success: false, error: 'Barcode, Kode Barang, dan Nama Barang wajib diisi' }, { status: 400 });
    }

    // Get Category and UOM Name for POS Sync
    let catName = 'General';
    let uomNameStr = 'Pcs';
    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
      if (cat) catName = cat.categoryName;
    }
    if (uomId) {
      const uom = await (prisma as any).uoM?.findUnique({ where: { id: Number(uomId) } }) || await (prisma as any).uOM?.findUnique({ where: { id: Number(uomId) } }) || await (prisma as any).uom?.findUnique({ where: { id: Number(uomId) } });
      if (uom) uomNameStr = uom.uomName;
    }

    const created = await prisma.inventory.create({
      data: {
        barcode,
        inventoryNo: inventoryNo,
        inventoryName: inventoryName,
        categoryId: categoryId ? Number(categoryId) : null,
        brandId: brandId ? Number(brandId) : null,
        uomId: uomId ? Number(uomId) : null,
        hpp: Number(hpp || 0),
        price: Number(price || 0),
        grosir1: Number(grosir1 || 0),
        grosir2: Number(grosir2 || 0),
        grosir3: Number(grosir3 || 0),
        stock: Number(stock || 0),
        isActive: Boolean(isActive),
      },
    });

    // POS SYNC
    try {
      const uuid = require('crypto').randomUUID();
      await posPool.query(
        `INSERT INTO "Product" (id, barcode, name, category, uom, "priceRetail", stock, "priceGrosir1", "priceGrosir2", "priceGrosir3", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (barcode) DO NOTHING`,
        [uuid, barcode, inventoryName, catName, uomNameStr, Number(price || 0), Number(stock || 0), Number(grosir1 || 0), Number(grosir2 || 0), Number(grosir3 || 0)]
      );
    } catch (posErr) {
      console.error('POS Sync Error:', posErr);
      // We don't fail the request, we just log it. (In robust systems, use queue).
    }

    return NextResponse.json({ success: true, message: 'Barang berhasil ditambahkan', data: created });
  } catch (error: any) {
    console.error('Error in POST /api/inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
