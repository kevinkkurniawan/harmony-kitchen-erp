import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const uomClient = (prisma as any).uoM || (prisma as any).uOM || (prisma as any).uom;

    const [categories, brands, uoms] = await Promise.all([
      prisma.category.findMany({ orderBy: { categoryName: 'asc' } }),
      prisma.brand.findMany({ orderBy: { brandName: 'asc' } }),
      uomClient.findMany({ orderBy: { uomName: 'asc' } })
    ]);

    return NextResponse.json({
      success: true,
      categories: categories.map((c: any) => ({ id: c.id, name: c.categoryName })),
      brands: brands.map((b: any) => ({ id: b.id, name: b.brandName })),
      uoms: uoms.map((u: any) => ({ id: u.id, name: u.uomName })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error: any) {
    console.error('Error in GET /api/inventory/lookups:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
