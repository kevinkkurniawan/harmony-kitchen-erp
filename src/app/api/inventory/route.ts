import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 100, 2000);
    const where: any = {};
    if (q) { where.OR = [{ inventoryno: { contains: q, mode: 'insensitive' as const } }, { inventoryname: { contains: q, mode: 'insensitive' as const } }]; }
    const [total, items] = await Promise.all([
      prisma.inventory.count({ where }),
      prisma.inventory.findMany({ where, orderBy: { id: 'asc' }, skip: paginationParams.skip, take: paginationParams.limit }),
    ]);
    const mapped = items.map((i: any) => ({
      id: String(i.id),
      barcode: i.barcode || i.inventoryno,
      inventoryNo: i.inventoryno,
      inventory_no: i.inventoryno,
      inventoryName: i.inventoryname,
      inventory_name: i.inventoryname,
      inventoryBrandId: null,
      brandName: 'General',
      brand_name: 'General',
      inventoryCategoryId: null,
      categoryName: 'General',
      category_name: 'General',
      uoMId: null,
      uomName: 'Pcs',
      uom_name: 'Pcs',
      minStock: 5,
      maxStock: 100,
      kodeHarga: 'STD',
      description: '',
      hpp: 0,
      price: i.price,
      grosir1: i.grosir1,
      grosir2: i.grosir2,
      grosir3: i.grosir3,
      stock: Number(i.stokupdate || 0),
      isActive: true,
      is_active: true,
      createdAt: i.createddate,
      created_at: i.createddate
    }));
    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const created = await prisma.inventory.create({ data: { inventoryno: body.inventory_no, inventoryname: body.inventory_name, barcode: body.barcode || body.inventory_no, price: Number(body.price) || 0 } });
    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
