import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    const items = await prisma.inventory.findMany({
      where: q
        ? {
            OR: [
              { barcode: { contains: q, mode: 'insensitive' } },
              { inventoryNo: { contains: q, mode: 'insensitive' } },
              { inventoryName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { category: true },
      orderBy: { id: 'asc' },
    });

    const mapped = items.map((inv) => ({
      id: inv.id,
      barcode: inv.barcode,
      inventory_no: inv.inventoryNo,
      inventory_name: inv.inventoryName,
      category_name: inv.category?.categoryName || 'General',
      hpp: inv.hpp,
      price: inv.price,
      stock: inv.stock,
      sync_status: 'SYNCED',
      last_sync: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/sales/sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
