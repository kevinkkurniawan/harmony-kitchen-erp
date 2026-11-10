// Purchase receipt ("Penerimaan Barang dengan harga") money math, shared by the page and the save / edit API.

// Float noise guard: 0.1 + 0.2 style errors must not move a truncation / rounding step across a boundary.
const EPS = 1e-7;

/** SQL Server ROUND(x, 1, 1): truncate to 1 decimal (toward zero). */
function truncate1(x: number): number {
  return x >= 0 ? Math.floor(x * 10 + EPS) / 10 : -Math.floor(-x * 10 + EPS) / 10;
}

/** SQL Server ROUND(x, 0): nearest whole number, halves away from zero. */
function round0(x: number): number {
  return x >= 0 ? Math.floor(x + 0.5 + EPS) : -Math.floor(-x + 0.5 + EPS);
}

export interface ReceiptLineInput {
  qty: number;
  price: number;
  disc1: number; // Disc 1(%)
  disc2: number; // Disc 2(%)
  disc3: number; // Disc 3(%)
  discRp: number; // Disc (Rp) per unit
}

export interface ReceiptLineAmounts {
  /** Unit price after all discounts (whole rupiah) */
  netPrice: number;
  /** Discount per unit, stored as t_materialreceivedetail.disctotal */
  discTotal: number;
  subtotal: number;
}

/**
 * One line, exactly as sp_SPMaterialReceiveDetail_InsData / _UpdData:
 * the % discounts cascade (Disc 2 on the price after Disc 1, Disc 3 after both), Disc (Rp) is added per unit,
 * the discount is truncated to 1 decimal, the net unit price rounded to whole rupiah, subtotal = qty x net price.
 */
export function receiptLineAmounts({ qty, price, disc1, disc2, disc3, discRp }: ReceiptLineInput): ReceiptLineAmounts {
  const a = (price * disc1) / 100;
  const b = ((price - a) * disc2) / 100;
  const c = ((price - (a + b)) * disc3) / 100;
  const netPrice = round0(price - truncate1(a + b + c + discRp));
  return { netPrice, discTotal: price - netPrice, subtotal: qty * netPrice };
}

export interface ReceiptHeaderInput {
  /** Sum of the line subtotals ("Sub Total :") */
  subtotal: number;
  disc1: number;
  /** "Multi Disc": Disc 2 / Disc 3 only count when it is ticked */
  isMultiDisc: boolean;
  disc2: number;
  disc3: number;
  ppnPercentage: number;
  downPayment: number;
}

export interface ReceiptHeaderAmounts {
  discValue: number;
  ppnValue: number;
  /** "Total Keseluruhan :" (stored as grandtotal) */
  grandTotal: number;
  /** "Saldo Terhutang :" = Total Keseluruhan - Uang Muka (old CalculateSummary) */
  balance: number;
}

/**
 * Header totals. Disc 1 alone keeps the ERP rule (Sub Total x %), PPn on the amount after discount.
 * With Multi Disc, Disc 2 and Disc 3 cascade on the rest the same way the old detail SP cascades line discounts.
 */
export function receiptHeaderAmounts(h: ReceiptHeaderInput): ReceiptHeaderAmounts {
  const a = (h.subtotal * h.disc1) / 100;
  const b = h.isMultiDisc ? ((h.subtotal - a) * h.disc2) / 100 : 0;
  const c = h.isMultiDisc ? ((h.subtotal - (a + b)) * h.disc3) / 100 : 0;
  // Whole rupiah, as the old header SP (@DiscValue int, @PPnValue int); the payment is written from these
  const discValue = Math.round(a + b + c);
  const afterDisc = h.subtotal - discValue;
  const ppnValue = Math.round((afterDisc * h.ppnPercentage) / 100);
  const grandTotal = afterDisc + ppnValue;
  return { discValue, ppnValue, grandTotal, balance: grandTotal - h.downPayment };
}

/** "Lama Termin" days -> due date (old Ed_Termin_EditValueChanged: MR date + days). Dates are 'YYYY-MM-DD'. */
export function dueDateFromTerm(mrDate: string, days: number): string {
  const d = new Date(`${mrDate}T00:00:00Z`);
  if (isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + (Number.isFinite(days) ? Math.trunc(days) : 0));
  return d.toISOString().slice(0, 10);
}
