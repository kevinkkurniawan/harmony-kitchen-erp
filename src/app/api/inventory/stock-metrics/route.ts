import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId');
    const query = searchParams.get('q') || '';

    // Build the where clause for the aggregate query
    const where: any = { isactive: true };

    if (query) {
      where.OR = [
        { inventoryname: { contains: query, mode: 'insensitive' } },
        { barcode: { contains: query, mode: 'insensitive' } },
        { inventoryno: { contains: query, mode: 'insensitive' } }
      ];
    }

    const totalItems = await prisma.m_inventory.count({ where });

    const items = await prisma.m_inventory.findMany({
      where,
      select: {
        id: true,
        hpp: true,
        minstock: true,
      }
    });

    const inventoryIds = items.map((i) => Number(i.id));
    const stocks = await prisma.$queryRawUnsafe<any[]>(
      `SELECT inventoryid, SUM(qtytotal) as total_qty FROM public.s_stockinventory WHERE inventoryid IN (${inventoryIds.length > 0 ? inventoryIds.join(',') : '0'}) GROUP BY inventoryid`
    );

    const stockMap = new Map();
    for (const st of stocks) {
      stockMap.set(String(st.inventoryid), Number(st.total_qty || 0));
    }

    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    items.forEach((item) => {
      const stock = stockMap.get(String(item.id)) || 0;
      const minStock = Number(item.minstock || 0);
      const hpp = Number(item.hpp || 0);

      if (stock > 0) {
        totalValue += (stock * hpp);
      }
      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= minStock) {
        lowStockCount++;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        totalItems,
        totalValue,
        lowStockCount,
        outOfStockCount,
      }
    });
  } catch (error: any) {
    console.error('Stock Metrics Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
