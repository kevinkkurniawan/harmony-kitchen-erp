import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const [brands, categories, uoms, productTypes, warehouses, wholesaleCategories] = await Promise.all([
      prisma.m_brand.findMany({ select: { id: true, brandname: true }, orderBy: { brandname: 'asc' } }),
      prisma.m_category.findMany({ select: { id: true, categoryname: true }, orderBy: { categoryname: 'asc' } }),
      prisma.m_uom.findMany({ select: { id: true, uomname: true }, orderBy: { uomname: 'asc' } }),
      prisma.m_product.findMany({ select: { id: true, productname: true }, orderBy: { productname: 'asc' } }),
      prisma.m_warehouse.findMany({ select: { id: true, whno: true, whname: true } }),
      prisma.m_wholesalecategory.findMany({ where: { isactive: true }, orderBy: { id: 'asc' } }),
    ]);

    return NextResponse.json({ 
      success: true, 
      data: {
        brands: brands.map(b => ({ id: b.id, brandName: b.brandname })),
        categories: categories.map(c => ({ id: c.id, categoryName: c.categoryname })),
        uoms: uoms.map(u => ({ id: u.id, uomName: u.uomname })),
        productTypes: productTypes.map(p => ({ id: p.id, productName: p.productname })),
        warehouses: warehouses.map(w => ({ id: w.id, whCode: w.whno, location: w.whname || `Gudang ${w.whno}` })),
        wholesaleCategories: wholesaleCategories.map(wc => ({
          id: wc.id,
          code: wc.code,
          name: wc.name,
          version: wc.version,
          tier1_minqty: wc.tier1_minqty,
          tier2_minqty: wc.tier2_minqty,
          tier3_minqty: wc.tier3_minqty,
        })),
      } 
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
