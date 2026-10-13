import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface LedgerRow {
  source: string;
  date: Date | null;
  transaction_no: string | null;
  type_id: number | null;
  qty_in: number;
  qty_out: number;
  price: number;
  row_id: number;
}

/**
 * Stock card for one item, built from every place stock changes are recorded:
 * - s_flowinventory: ERP opname and new-POS sales (and legacy opname up to 2024, type 81)
 * - t_salesposheader/detail: legacy (Module Manager) sales, which never wrote stock flows
 * - t_opname: legacy OPM adjustments (qty is the +/- delta) not already present as a flow
 * - t_materialreceiveheader/detail: goods receipts (neither app writes flows for them)
 * The running balance is anchored on the current stock, so it ends at m_inventory.stokupdate.
 */
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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 500, 1), 5000);

    const [inventory, rows] = await Promise.all([
      prisma.m_inventory.findUnique({
        where: { id: inventoryId },
        select: { stokupdate: true, syncdate: true },
      }),
      prisma.$queryRaw<LedgerRow[]>`
        SELECT 'flow' AS source, COALESCE(d.invoicedate, f.stockdate, d.createddate) AS date,
               COALESCE(d.invoicecode, f.invoicecode) AS transaction_no,
               COALESCE(d.invoicetype, f.invoicetype) AS type_id,
               COALESCE(d.qtyin, 0)::float8 AS qty_in, COALESCE(d.qtyout, 0)::float8 AS qty_out,
               COALESCE(NULLIF(d.pricein, 0), NULLIF(d.priceout, 0), f.price, 0)::float8 AS price,
               d.id::int AS row_id
        FROM s_flowinventory f
        JOIN s_flowdetailinventory d ON d.flowinventoryid = f.id
        WHERE f.inventoryid = ${inventoryId}

        UNION ALL
        SELECT 'sale', h.salesposdate, h.salesposno, 2,
               0, COALESCE(sd.qty, 0)::float8, COALESCE(sd.price, 0)::float8, sd.id::int
        FROM t_salesposdetail sd
        JOIN t_salesposheader h ON h.id = sd.salesposheaderid
        WHERE sd.inventoryid = ${inventoryId}
          AND h.status IS NULL
          AND COALESCE(h.isvoid, false) = false

        UNION ALL
        SELECT 'opname', COALESCE(o.opnamedate, o.createddate), o.notransaction, 3,
               GREATEST(o.qty, 0)::float8, GREATEST(-o.qty, 0)::float8, COALESCE(o.price, 0)::float8, o.id::int
        FROM t_opname o
        WHERE o.inventoryid = ${inventoryId}
          AND NOT EXISTS (SELECT 1 FROM t_opnameheader oh WHERE oh.notransaction = o.notransaction)
          AND NOT EXISTS (
            SELECT 1 FROM s_flowinventory f2
            WHERE f2.inventoryid = o.inventoryid AND f2.invoicecode = o.notransaction
          )

        UNION ALL
        SELECT 'receive', COALESCE(mh.mrdate, mh.createddate), mh.mrno, 1,
               COALESCE(md.qty, 0)::float8, 0, COALESCE(md.price, 0)::float8, md.id::int
        FROM t_materialreceivedetail md
        JOIN t_materialreceiveheader mh ON mh.id = md.mrid
        WHERE md.inventoryid = ${String(inventoryId)} -- text column in this legacy table
          AND COALESCE(mh.isvoid, false) = false
      `,
    ]);

    // Oldest first to compute balances
    rows.sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : 0;
      const tb = b.date ? new Date(b.date).getTime() : 0;
      return ta !== tb ? ta - tb : a.row_id - b.row_id;
    });

    const netChange = rows.reduce((sum, r) => sum + Number(r.qty_in) - Number(r.qty_out), 0);
    const currentStock = Number(inventory?.stokupdate || 0);
    let balance = currentStock - netChange;

    const ledger = rows.map((r) => {
      balance += Number(r.qty_in) - Number(r.qty_out);
      return {
        id: `${r.source}-${r.row_id}`,
        date: r.date,
        transactionNo: r.transaction_no || 'SYS-ADJ',
        type: mapInvoiceType(r.type_id),
        qtyIn: Number(r.qty_in),
        qtyOut: Number(r.qty_out),
        price: Number(r.price),
        balance,
      };
    });

    // Newest first for display
    ledger.reverse();

    return NextResponse.json({
      success: true,
      data: ledger.slice(0, limit),
      total: ledger.length,
      currentStock,
      lastOpnameDate: inventory?.syncdate || null,
    });
  } catch (error: any) {
    console.error('Stock Movement Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch movement history' }, { status: 500 });
  }
}

// Map the integer invoicetype to a readable label (legacy & ERP conventions)
function mapInvoiceType(typeId?: number | null): string {
  switch (typeId) {
    case 1:
      return 'Penerimaan';
    case 2:
    case 39:
      return 'Penjualan';
    case 3:
    case 81: // legacy Module Manager opname
      return 'Opname';
    case 4: return 'Transfer In';
    case 5: return 'Transfer Out';
    case 6: return 'Waste/Spoilage';
    case 7: return 'Retur';
    default: return 'Manual Adjustment';
  }
}
