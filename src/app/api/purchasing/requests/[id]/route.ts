import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pr = await prisma.t_purchaserequisitionheader.findUnique({
      where: { id: Number(id) },
      include: { t_purchaserequisitiondetail: true },
    });
    if (!pr) return NextResponse.json({ success: false }, { status: 404 });

    const inventoryIds = pr.t_purchaserequisitiondetail.map((d: any) => d.inventoryid).filter(Boolean) as number[];
    const inventories = await prisma.inventory.findMany({ where: { id: { in: inventoryIds } } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));

    const mapped = {
      id: pr.id,
      pr_no: pr.prqno,
      pr_date: pr.prqdate,
      required_date: pr.reqdate,
      description: pr.description || '',
      status: pr.statusrequisition ? 'Approved' : 'Draft',
      created_at: pr.createddate,
      items: pr.t_purchaserequisitiondetail.map((d: any) => {
        const inv = inventoryMap.get(d.inventoryid);
        return {
          id: d.id,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          qty: Number(d.qty),
          uom_name: 'Pcs',
          notes: d.description || '',
        };
      }),
    };

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
