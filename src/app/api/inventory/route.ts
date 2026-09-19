import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paginationParams = getPaginationParams(req, 100, 2000);
    
    // Parse filters
    const query = searchParams.get('q') || '';
    const minusStock = searchParams.get('minusStock') === 'true';
    const onlyActive = searchParams.get('onlyActive') === 'true';

    const where: any = {};
    if (query) {
      where.OR = [
        { inventoryname: { contains: query, mode: 'insensitive' } },
        { barcode: { contains: query, mode: 'insensitive' } },
        { inventoryno: { contains: query, mode: 'insensitive' } }
      ];
    }
    if (minusStock) where.stokupdate = { lt: 0 };
    if (onlyActive) where.isactive = true;

    const [total, items, categories, productTypes] = await Promise.all([
      prisma.m_inventory.count({ where }),
      prisma.m_inventory.findMany({ 
        where, 
        orderBy: { id: 'asc' }, 
        skip: paginationParams.skip, 
        take: paginationParams.limit,
        include: {
          m_brand: true,
          m_uom: true,
        }
      }),
      prisma.m_category.findMany(),
      prisma.m_product.findMany()
    ]);
    
    // Fetch stock for these items
    const inventoryIds = items.map((i: any) => Number(i.id));
    const stocks = await prisma.$queryRawUnsafe<any[]>(
      `SELECT inventoryid, whcode, SUM(qtytotal) as total_qty FROM public.s_stockinventory WHERE inventoryid IN (${inventoryIds.length > 0 ? inventoryIds.join(',') : '0'}) GROUP BY inventoryid, whcode`
    );

    const stockMap = new Map();
    for (const st of stocks) {
      const invId = String(st.inventoryid);
      if (!stockMap.has(invId)) {
        stockMap.set(invId, { gudang: 0, etalase: 0 });
      }
      const current = stockMap.get(invId);
      if (st.whcode === 1) {
        current.gudang += Number(st.total_qty || 0);
      } else {
        current.etalase += Number(st.total_qty || 0);
      }
    }
    
    // Create maps for O(1) lookups
    const categoryMap = new Map(categories.map((c: any) => [c.id, c.categoryname]));
    const productTypeMap = new Map(productTypes.map((p: any) => [p.id, p.productname]));
    const mapped = items.map((i: any) => {
      const stockData = stockMap.get(String(i.id)) || { gudang: 0, etalase: 0 };
      const totalStock = stockData.gudang + stockData.etalase;
      
      return {
      id: String(i.id),
      barcode: i.barcode || i.inventoryno,
      inventoryNo: i.inventoryno,
      inventory_no: i.inventoryno,
      inventoryName: i.inventoryname,
      inventory_name: i.inventoryname,
      inventoryBrandId: i.inventorybrandid,
      brandName: i.m_brand?.brandname || 'General',
      brand_name: i.m_brand?.brandname || 'General',
      inventoryCategoryId: i.inventorycategoryid,
      categoryName: categoryMap.get(i.inventorycategoryid) || 'General',
      category_name: categoryMap.get(i.inventorycategoryid) || 'General',
      inventoryProductId: i.inventoryproductid,
      productName: productTypeMap.get(i.inventoryproductid) || 'General',
      product_name: productTypeMap.get(i.inventoryproductid) || 'General',
      uoMId: i.uomid,
      uomName: i.m_uom?.uomname || 'Pcs',
      uom_name: i.m_uom?.uomname || 'Pcs',
      minStock: Number(i.minstock || 0),
      maxStock: Number(i.maxstock || 0),
      kodeHarga: i.kodeharga || '',
      description: i.description || '',
      hpp: Number(i.hpp || 0),
      price: i.price,
      grosir1: i.grosir1,
      grosir2: i.grosir2,
      grosir3: i.grosir3,
      stock: totalStock,
      stokAwal: Number(i.stokawal || 0),
      stokAkhir: totalStock,
      isActive: Boolean(i.isactive ?? true),
      is_active: Boolean(i.isactive ?? true),
      createdAt: i.createddate,
      created_at: i.createddate,
      stokGudang: stockData.gudang,
      stokEtalase: stockData.etalase
    };
    });
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = {
      inventoryno: body.inventoryNo || body.inventory_no || '',
      inventoryname: body.inventoryName || body.inventory_name || '',
      barcode: body.barcode || body.inventoryNo || body.inventory_no || '',
      inventorybrandid: body.inventoryBrandId ? Number(body.inventoryBrandId) : 1,
      inventorycategoryid: body.inventoryCategoryId ? Number(body.inventoryCategoryId) : 1,
      inventoryproductid: body.inventoryProductId ? Number(body.inventoryProductId) : 1,
      uomid: body.uoMId ? Number(body.uoMId) : 1,
      minstock: Number(body.minStock) || 0,
      maxstock: Number(body.maxStock) || 0,
      kodeharga: body.kodeHarga || 'STD',
      description: body.description || '',
      hpp: Number(body.hpp) || 0,
      price: Number(body.price) || 0,
      pricebuy: Number(body.priceBuy) || 0,
      grosir1: body.grosir1 ? Number(body.grosir1) : null,
      grosir2: body.grosir2 ? Number(body.grosir2) : null,
      grosir3: body.grosir3 ? Number(body.grosir3) : null,
      isactive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      stokawal: Number(body.stokAwal) || 0,
      stokupdate: Number(body.stokAwal) || 0, // Initial stock
    };
    const created = await prisma.m_inventory.create({ data });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error('Create error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
