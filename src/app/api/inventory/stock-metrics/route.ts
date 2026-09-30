import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/session';
import { hasCapability } from '@/lib/capabilities';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    const mayViewHpp = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get('warehouseId');
    const query = (searchParams.get('q') || '').trim();
    const minusStock = searchParams.get('minusStock') === 'true';

    const hasWarehouseFilter = Boolean(warehouseId && warehouseId !== 'ALL' && !isNaN(Number(warehouseId)));
    const whNum = hasWarehouseFilter ? Number(warehouseId) : null;

    const sql = `
      WITH stock_agg AS (
        SELECT inventoryid, SUM(qtytotal) AS total_qty
        FROM public.s_stockinventory
        WHERE inventoryid IS NOT NULL ${hasWarehouseFilter ? `AND whcode = ${whNum}` : ''}
        GROUP BY inventoryid
      ),
      inv_stock AS (
        SELECT
          i.id,
          COALESCE(i.hpp, 0) AS hpp,
          COALESCE(i.minstock, 0) AS minstock,
          ${hasWarehouseFilter ? 'COALESCE(s.total_qty, 0)' : 'COALESCE(i.stokupdate, s.total_qty, 0)'} AS stock
        FROM public.m_inventory i
        ${hasWarehouseFilter ? 'INNER JOIN' : 'LEFT JOIN'} stock_agg s ON s.inventoryid = i.id
        WHERE i.isactive = true
          ${minusStock ? 'AND i.stokupdate < 0' : ''}
          ${query ? 'AND (i.inventoryname ILIKE $1 OR i.barcode ILIKE $1 OR i.inventoryno ILIKE $1)' : ''}
      )
      SELECT
        COUNT(*)::int AS "totalItems",
        COALESCE(SUM(CASE WHEN stock > 0 THEN stock * hpp ELSE 0 END), 0)::float8 AS "totalValue",
        COUNT(*) FILTER (WHERE stock <= 0)::int AS "outOfStockCount",
        COUNT(*) FILTER (WHERE stock > 0 AND stock <= minstock)::int AS "lowStockCount"
      FROM inv_stock
    `;

    const rows = query
      ? await prisma.$queryRawUnsafe<any[]>(sql, `%${query}%`)
      : await prisma.$queryRawUnsafe<any[]>(sql);

    const row = rows[0] || { totalItems: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0 };

    return NextResponse.json({
      success: true,
      data: {
        totalItems: Number(row.totalItems || 0),
        totalValue: mayViewHpp ? Number(row.totalValue || 0) : 0,
        lowStockCount: Number(row.lowStockCount || 0),
        outOfStockCount: Number(row.outOfStockCount || 0),
      }
    });
  } catch (error: any) {
    console.error('Stock Metrics Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
