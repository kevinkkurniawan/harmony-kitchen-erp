import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSession } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Direct cost history request MUST be forbidden if user has no HPP permission
    if (!authUser.hasHpp) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Anda tidak memiliki hak akses untuk melihat data HPP' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const invId = Number(id);

    // Fetch cost history from MaterialReceiveDetail (purchasing with price)
    const receiveDetails = await prisma.materialReceiveDetail.findMany({
      where: { inventoryId: invId },
      include: { header: true },
      orderBy: { id: 'desc' },
      take: 20,
    });

    const history = receiveDetails.map((rd) => ({
      id: rd.id,
      date: rd.header.mrDate.toISOString().split('T')[0],
      supplierName: rd.header.supplierName,
      unitPrice: rd.unitPrice,
      qty: rd.qty,
      notes: rd.description || `PO: ${rd.header.poNo || '-'}`,
    }));

    return NextResponse.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error fetching HPP history:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
