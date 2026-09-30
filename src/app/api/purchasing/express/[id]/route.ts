import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    }

    const { id } = await params;
    const mr = await prisma.t_materialreceiveheader.findUnique({
      where: { id: BigInt(id) },
      include: { t_materialreceivedetail: true },
    });

    if (!mr) return apiError('NOT_FOUND', 'Penerimaan barang ekspress tidak ditemukan.', 404);

    const inventoryIds = mr.t_materialreceivedetail
      .map((d: any) => Number(d.inventoryid))
      .filter((n) => !isNaN(n) && n > 0);
    const inventories = inventoryIds.length > 0
      ? await prisma.m_inventory.findMany({
          where: { id: { in: inventoryIds.map((invId) => BigInt(invId)) } },
          include: { m_uom: true },
        })
      : [];
    const inventoryMap = new Map(inventories.map((i: any) => [Number(i.id), i]));
    const totalQty = mr.t_materialreceivedetail.reduce((sum: number, d: any) => sum + Number(d.qty || 0), 0);

    const mapped = {
      id: Number(mr.id),
      mr_no: mr.mrno || '-',
      mr_date: mr.mrdate ? new Date(mr.mrdate).toISOString().slice(0, 10) : '-',
      po_no: mr.pono || '-',
      do_no: mr.dono || '-',
      supplier_name: mr.suppliername || '-',
      driver_name: mr.drivername || '-',
      vehicle_no: mr.vehicleno || '-',
      wh_name: 'Gudang Utama',
      description: mr.description || '-',
      total_qty: totalQty,
      items: mr.t_materialreceivedetail.map((d: any) => {
        const inv = inventoryMap.get(Number(d.inventoryid));
        return {
          id: Number(d.id),
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          uom_name: inv?.m_uom?.uomname || inv?.m_uom?.uomcode || 'PCS',
          qty: Number(d.qty || 0),
          description: d.description || '',
        };
      }),
    };

    return apiSuccess(mapped);
  } catch (error: any) {
    console.error('Error fetching express receiving detail:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal memuat detail penerimaan', 500);
  }
}
