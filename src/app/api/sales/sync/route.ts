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
      include: { category: true, uom: true },
      orderBy: { id: 'asc' },
    });

    const mapped = items.map((inv) => ({
      id: String(inv.id),
      barcode: inv.barcode,
      inventoryNo: inv.inventoryNo,
      inventory_no: inv.inventoryNo,
      inventoryName: inv.inventoryName,
      inventory_name: inv.inventoryName,
      categoryName: inv.category?.categoryName || 'General',
      category_name: inv.category?.categoryName || 'General',
      uomName: inv.uom?.uomName || 'Pcs',
      uom_name: inv.uom?.uomName || 'Pcs',
      stokGudang: inv.stock,
      qtyTransaksi: 0,
      stokSetelahSync: inv.stock,
      hpp: inv.hpp,
      price: inv.price,
      stock: inv.stock,
      syncStatus: 'SYNCED',
      sync_status: 'SYNCED',
      lastSync: new Date().toLocaleTimeString(),
      last_sync: new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Error in GET /api/sales/sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
