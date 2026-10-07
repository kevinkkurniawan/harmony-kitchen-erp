import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { getCurrentUser } from '@/lib/session';
import { hasCapability, requireCapability } from '@/lib/capabilities';
import { normalizeInventoryName, validateInventoryName } from '@/lib/inventory-name';
import { parseColumnFilters, buildInventorySearchConditions } from '@/lib/column-filter';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const mayViewHpp = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const { searchParams } = new URL(req.url);
    const paginationParams = getPaginationParams(req, 100, 5000);
    
    // Strict column filters
    const { where: columnWhere } = parseColumnFilters(searchParams, {
      whitelist: ['inventoryno', 'barcode', 'inventorybrandid', 'inventorycategoryid', 'inventoryproductid', 'uomid', 'wholesalecategoryid', 'isactive'],
      exactMatchFields: ['inventoryno', 'barcode'],
      numberFields: ['inventorybrandid', 'inventorycategoryid', 'inventoryproductid', 'uomid', 'wholesalecategoryid'],
      booleanFields: ['isactive'],
    });

    const where: any = { ...columnWhere };

    // Global search (tokenized) + per-column f_* filters
    const query = (searchParams.get('q') || '').trim();
    const searchConditions = buildInventorySearchConditions(searchParams);
    if (searchConditions.length > 0) where.AND = searchConditions;

    // Legacy / quick filters
    const minusStock = searchParams.get('minusStock') === 'true';
    const status = searchParams.get('status');
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const warehouseId = searchParams.get('warehouseId');

    if (minusStock) where.stokupdate = { lt: 0 };
    if (status === 'active' || (onlyActive && status !== 'all' && status !== 'inactive')) {
      where.isactive = true;
    } else if (status === 'inactive') {
      where.isactive = false;
    }

    if (warehouseId && warehouseId !== 'ALL') {
      const whNum = Number(warehouseId);
      if (!isNaN(whNum)) {
        const whRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT DISTINCT inventoryid FROM public.s_stockinventory WHERE whcode = ${whNum} AND inventoryid IS NOT NULL`
        );
        const whIds = whRows.map((r) => BigInt(r.inventoryid));
        where.id = { in: whIds };
      }
    }

    const [total, items] = await Promise.all([
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
    ]);

    // Scanner support: an exact barcode / SKU hit always comes first
    if (query) {
      const exactQ = query.toLowerCase();
      const exactIdx = items.findIndex((i: any) =>
        (i.barcode || '').trim().toLowerCase() === exactQ || (i.inventoryno || '').trim().toLowerCase() === exactQ
      );
      if (exactIdx > 0) items.unshift(...items.splice(exactIdx, 1));
    }

    // Only load the lookup rows these items actually reference
    const uniqueIds = (values: any[]) => [...new Set(values.filter((v) => v !== null && v !== undefined))];
    const [categories, productTypes, wholesaleCategories] = await Promise.all([
      prisma.m_category.findMany({ where: { id: { in: uniqueIds(items.map((i: any) => i.inventorycategoryid)) } } }),
      prisma.m_product.findMany({ where: { id: { in: uniqueIds(items.map((i: any) => i.inventoryproductid)) } } }),
      prisma.m_wholesalecategory.findMany({ where: { id: { in: uniqueIds(items.map((i: any) => i.wholesalecategoryid)) } } }),
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
    
    const categoryMap = new Map(categories.map((c: any) => [Number(c.id), c.categoryname]));
    const productTypeMap = new Map(productTypes.map((p: any) => [Number(p.id), p.productname]));
    const wholesaleMap = new Map(wholesaleCategories.map((wc: any) => [wc.id, wc]));

    const mapped = items.map((i: any) => {
      const stockData = stockMap.get(String(i.id)) || { gudang: 0, etalase: 0 };
      const totalStock = stockData.gudang + stockData.etalase;
      const liveStock = i.stokupdate !== null && i.stokupdate !== undefined ? Number(i.stokupdate) : totalStock;
      const wc = i.wholesalecategoryid ? wholesaleMap.get(i.wholesalecategoryid) : null;
      
      return {
        id: String(i.id),
        barcode: i.barcode || i.inventoryno,
        inventoryNo: i.inventoryno,
        inventory_no: i.inventoryno,
        inventoryName: i.inventoryname,
        inventory_name: i.inventoryname,
        inventoryBrandId: i.inventorybrandid ? Number(i.inventorybrandid) : null,
        brandName: i.m_brand?.brandname || 'General',
        brand_name: i.m_brand?.brandname || 'General',
        inventoryCategoryId: i.inventorycategoryid,
        categoryName: categoryMap.get(i.inventorycategoryid) || 'General',
        category_name: categoryMap.get(i.inventorycategoryid) || 'General',
        inventoryProductId: i.inventoryproductid,
        productName: productTypeMap.get(i.inventoryproductid) || 'General',
        product_name: productTypeMap.get(i.inventoryproductid) || 'General',
        uoMId: i.uomid ? Number(i.uomid) : null,
        uomName: i.m_uom?.uomname || 'Pcs',
        uom_name: i.m_uom?.uomname || 'Pcs',
        minStock: Number(i.minstock || 0),
        maxStock: Number(i.maxstock || 0),
        kodeHarga: i.kodeharga || 'STD',
        description: i.description || '',
        hpp: mayViewHpp ? Number(i.hpp || 0) : 0,
        price: Number(i.price || 0),
        priceBuy: Number(i.pricebuy || 0),
        grosir1: i.grosir1 ? Number(i.grosir1) : null,
        grosir2: i.grosir2 ? Number(i.grosir2) : null,
        grosir3: i.grosir3 ? Number(i.grosir3) : null,
        wholesaleCategoryId: i.wholesalecategoryid ? Number(i.wholesalecategoryid) : null,
        wholesaleCategoryName: wc ? wc.name : undefined,
        wholesaleCategory: wc ? {
          id: wc.id,
          code: wc.code,
          name: wc.name,
          tier1_minqty: wc.tier1_minqty,
          tier2_minqty: wc.tier2_minqty,
          tier3_minqty: wc.tier3_minqty,
        } : null,
        stock: liveStock,
        stokAwal: Number(i.stokawal || 0),
        stokAkhir: liveStock,
        isActive: Boolean(i.isactive ?? true),
        is_active: Boolean(i.isactive ?? true),
        createdAt: i.createddate,
        created_at: i.createddate,
        stokGudang: stockData.gudang,
        stokEtalase: stockData.etalase
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    return apiError('INTERNAL_ERROR', error.message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireCapability('INVENTORY_EDIT');
    if ('errorResponse' in auth) return auth.errorResponse;

    const user = auth.user;
    const mayViewHpp = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const body = await req.json();
    const nameError = validateInventoryName(body.inventoryName || body.inventory_name);
    if (nameError) return apiError('VALIDATION_ERROR', nameError, 400);

    if (!mayViewHpp && body.hpp !== undefined && Number(body.hpp) > 0) {
      return apiError('FORBIDDEN', 'Anda tidak memiliki hak akses untuk mengubah HPP.', 403);
    }

    const data = {
      inventoryno: body.inventoryNo || body.inventory_no || '',
      inventoryname: normalizeInventoryName(body.inventoryName || body.inventory_name),
      barcode: body.barcode || body.inventoryNo || body.inventory_no || '',
      inventorybrandid: body.inventoryBrandId ? Number(body.inventoryBrandId) : 1,
      inventorycategoryid: body.inventoryCategoryId ? Number(body.inventoryCategoryId) : 1,
      inventoryproductid: body.inventoryProductId ? Number(body.inventoryProductId) : 1,
      uomid: body.uoMId ? Number(body.uoMId) : 1,
      minstock: Number(body.minStock) || 0,
      maxstock: Number(body.maxStock) || 0,
      kodeharga: body.kodeHarga || 'STD',
      description: body.description || '',
      hpp: mayViewHpp ? (Number(body.hpp) || 0) : 0,
      price: Number(body.price) || 0,
      pricebuy: Number(body.priceBuy) || 0,
      grosir1: body.grosir1 ? Number(body.grosir1) : null,
      grosir2: body.grosir2 ? Number(body.grosir2) : null,
      grosir3: body.grosir3 ? Number(body.grosir3) : null,
      wholesalecategoryid: body.wholesaleCategoryId ? Number(body.wholesaleCategoryId) : (body.wholesalecategoryid ? Number(body.wholesalecategoryid) : null),
      isactive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      stokawal: Number(body.stokAwal) || 0,
      stokupdate: Number(body.stokAwal) || 0,
    };

    const created = await prisma.m_inventory.create({ data });
    return apiSuccess(created, 'Barang berhasil ditambahkan.', 201);
  } catch (error: any) {
    console.error('Create error:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal menambahkan barang', 500);
  }
}
