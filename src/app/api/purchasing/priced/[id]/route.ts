import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { hasCapability } from '@/lib/capabilities';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    }

    const canViewPrice = await hasCapability(user, 'VIEW_HPP_PROFIT');

    const { id } = await params;
    const mr = await prisma.t_materialreceiveheader.findUnique({
      where: { id: BigInt(id) },
      include: { t_materialreceivedetail: true },
    });

    if (!mr) return apiError('NOT_FOUND', 'Penerimaan barang tidak ditemukan.', 404);

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

    const mapped = {
      id: Number(mr.id),
      mr_no: mr.mrno || '-',
      mr_date: mr.mrdate ? new Date(mr.mrdate).toISOString().slice(0, 10) : '-',
      po_no: mr.pono || '-',
      do_no: mr.dono || '-',
      supplier_name: mr.suppliername || '-',
      driver_name: mr.drivername || '-',
      vehicle_no: mr.vehicleno || '-',
      wh_name: 'Gudang Utama Dapur',
      payment_type: mr.paymenttype === 1 ? 'CASH' : 'TEMPO',
      due_date: mr.duedate ? new Date(mr.duedate).toISOString().slice(0, 10) : '-',
      down_payment: Number(mr.downpayment || 0),
      disc_percentage: Number(mr.discpercentage || 0),
      disc_value: Number(mr.discvalue || 0),
      ppn_percentage: Number(mr.ppnpercentage || 0),
      description: mr.description || '-',
      ...(canViewPrice
        ? {
            subtotal: Number(mr.grandtotal || 0) - Number(mr.ppnvalue || 0),
            tax: Number(mr.ppnvalue || 0),
            grand_total: Number(mr.grandtotal || 0),
          }
        : {
            subtotal: null,
            tax: null,
            grand_total: null,
          }),
      items: mr.t_materialreceivedetail.map((d: any) => {
        const inv = inventoryMap.get(Number(d.inventoryid));
        return {
          id: Number(d.id),
          inventory_id: d.inventoryid,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          uom_name: inv?.m_uom?.uomname || inv?.m_uom?.uomcode || 'PCS',
          qty: Number(d.qty || 0),
          unit_price: canViewPrice ? Number(d.price || 0) : null,
          price: canViewPrice ? Number(d.price || 0) : null,
          disc_percentage: Number(d.discpersen1 || 0),
          subtotal: canViewPrice ? Number(d.subtotal || 0) : null,
          description: d.description || '',
        };
      }),
    };

    return apiSuccess(mapped);
  } catch (error: any) {
    console.error('Error fetching priced receiving detail:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal memuat detail penerimaan', 500);
  }
}
