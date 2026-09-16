import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pr = await prisma.purchaseRequestHeader.findUnique({
      where: { id: Number(id) },
      include: { details: true },
    });
    if (!pr) return NextResponse.json({ success: false }, { status: 404 });

    const mapped = {
      id: pr.id,
      pr_no: pr.prNo,
      pr_date: pr.prDate,
      required_date: pr.prDate,
      description: pr.description || '',
      status: pr.status,
      created_at: pr.createdAt,
      items: pr.details.map((d: any) => ({
        id: d.id,
        barcode: d.barcode,
        inventory_no: d.inventoryNo,
        inventory_name: d.inventoryName,
        qty: Number(d.qty),
        uom_name: d.uomName || 'Pcs',
        notes: d.notes || '',
      })),
    };

    return NextResponse.json({ success: true, data: mapped });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

