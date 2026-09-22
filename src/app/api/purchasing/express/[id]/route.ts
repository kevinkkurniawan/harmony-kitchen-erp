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
      where: { id: Number(id) },
      include: { t_materialreceivedetail: true },
    });

    if (!mr) return apiError('NOT_FOUND', 'Penerimaan barang ekspress tidak ditemukan.', 404);

    const inventoryIds = mr.t_materialreceivedetail.map((d: any) => Number(d.inventoryid)).filter(Boolean);
    const inventories = await prisma.m_inventory.findMany({ where: { id: { in: inventoryIds } } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));
    const totalQty = mr.t_materialreceivedetail.reduce((sum: number, d: any) => sum + Number(d.qty), 0);

    const mapped = {
      id: mr.id,
      mr_no: mr.mrno,
      mr_date: mr.mrdate,
      po_no: '-',
      do_no: mr.dono || '-',
      supplier_name: mr.suppliername,
      driver_name: mr.drivername || '-',
      vehicle_no: mr.vehicleno || '-',
      wh_name: 'Gudang Utama',
      description: mr.description || '-',
      total_qty: totalQty,
      items: mr.t_materialreceivedetail.map((d: any) => {
        const inv = inventoryMap.get(Number(d.inventoryid));
        return {
          id: d.id,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          qty: Number(d.qty),
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
