import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const inventoryId = parseInt(p.id, 10);
    if (isNaN(inventoryId)) {
      return NextResponse.json({ success: false, error: 'Invalid inventory ID' }, { status: 400 });
    }

    // 1. Fetch parent flow records for this inventory ID
    const flowParents = await prisma.s_flowinventory.findMany({
      where: { inventoryid: inventoryId },
      select: { id: true, invoicecode: true, invoicetype: true, stockdate: true, qty: true, price: true }
    });

    const flowIds = flowParents.map(f => Number(f.id));

    // 2. Fetch all corresponding details (qtyin, qtyout)
    const flowDetails = await prisma.s_flowdetailinventory.findMany({
      where: { flowinventoryid: { in: flowIds } },
      orderBy: { id: 'desc' } // Chronological
    });

    // We merge the parent and detail records to form the ledger
    const ledger = flowDetails.map(detail => {
      const parent = flowParents.find(p => Number(p.id) === detail.flowinventoryid);
      
      return {
        id: detail.id,
        date: detail.invoicedate || parent?.stockdate || detail.createddate,
        transactionNo: detail.invoicecode || parent?.invoicecode || 'SYS-ADJ',
        type: mapInvoiceType(detail.invoicetype || parent?.invoicetype),
        qtyIn: Number(detail.qtyin || 0),
        qtyOut: Number(detail.qtyout || 0),
        price: Number(detail.pricein || detail.priceout || parent?.price || 0),
      };
    });

    // Calculate running balances (requires sorting by date ascending)
    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let currentBalance = 0;
    const ledgerWithBalance = ledger.map(entry => {
      currentBalance += entry.qtyIn;
      currentBalance -= entry.qtyOut;
      return { ...entry, balance: currentBalance };
    });
    
    // Reverse again for display (newest first)
    ledgerWithBalance.reverse();

    return NextResponse.json({
      success: true,
      data: ledgerWithBalance
    });
  } catch (error: any) {
    console.error('Stock Movement Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch movement history' }, { status: 500 });
  }
}

// Map the integer invoicetype to a readable string based on legacy conventions
function mapInvoiceType(typeId?: number | null): string {
  switch (typeId) {
    case 1: return 'Purchase In';
    case 2: return 'Sales Out';
    case 3: return 'Opname Adj';
    case 4: return 'Transfer In';
    case 5: return 'Transfer Out';
    case 6: return 'Waste/Spoilage';
    case 7: return 'Return';
    default: return 'Manual Adjustment';
  }
}
