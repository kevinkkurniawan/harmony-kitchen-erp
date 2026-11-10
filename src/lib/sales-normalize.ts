export type PayGroup = 'CASH' | 'QRIS' | 'TRANSFER' | 'CARD' | 'OTHER';

export interface NormalizedSale {
  net: number;
  disc: number;
  items: number;
  hpp: number;
  payGroup: PayGroup;
}

// m_paymenttype.code as written by the legacy POS into t_salespayment.paymenttypeid:
// 0 Cash, 1 Debit, 2 Credit Card, 3 Qris, 4 Shopee, 5 Tokopedia, 6 Transfer, 7 EDC Mandiri
const LEGACY_PAYMENT_GROUP: Record<number, PayGroup> = {
  0: 'CASH',
  1: 'CARD',
  2: 'CARD',
  3: 'QRIS',
  4: 'OTHER',
  5: 'OTHER',
  6: 'TRANSFER',
  7: 'CARD',
};

/**
 * The m_paymenttype.code the legacy POS expects in t_salespayment.paymenttypeid for a payment
 * type name, or null when the legacy POS has no code for it (e.g. TEMPO).
 */
export function legacyPaymentTypeCode(text: string): number | null {
  const t = text.toUpperCase();
  if (t === 'CASH' || t.includes('TUNAI')) return 0;
  if (t.includes('QRIS')) return 3;
  if (t.includes('SHOPEE')) return 4;
  if (t.includes('TOKOPEDIA')) return 5;
  if (t.includes('TRANSFER')) return 6;
  if (t.includes('MANDIRI')) return 7;
  if (t.includes('CREDIT')) return 2;
  if (t.includes('EDC') || t.includes('DEBIT') || t.includes('CARD') || t === 'BCA') return 1;
  return null;
}

/** Payment type label shown in the sales screens for a sale, from the header or its legacy payments. */
export function salePaymentType(header: any, payments: any[]): string {
  if (header.paymenttypecode) return String(header.paymenttypecode).toUpperCase();
  if (payments.length === 0) return isLegacySale(header) ? UNPAID_LABEL : 'CASH';
  const code = Number(payments[0].paymenttypeid);
  // Credit Card keeps its own name (the old app shows it); it still counts in the card (EDC) totals
  if (code === 2) return 'CREDIT CARD';
  const group = LEGACY_PAYMENT_GROUP[code] ?? 'OTHER';
  return group === 'CARD' ? 'DEBIT' : group;
}

export const UNPAID_LABEL = 'BELUM BAYAR';

/**
 * A legacy sale with no payment row was never paid (held or abandoned in the old POS).
 * The old app leaves these out of its sales lists and totals, so the ERP must not count them.
 */
export function isUnpaidLegacySale(header: any, payments: any[]): boolean {
  return isLegacySale(header) && payments.length === 0;
}

export function payGroupFromText(text: string): PayGroup {
  const t = text.toUpperCase();
  if (t === 'CASH' || t.includes('TUNAI')) return 'CASH';
  if (t.includes('QRIS')) return 'QRIS';
  if (t.includes('TRANSFER')) return 'TRANSFER';
  if (t.includes('EDC') || t.includes('DEBIT') || t.includes('CARD') || t === 'BCA' || t === 'MANDIRI') return 'CARD';
  return 'OTHER';
}

/**
 * One shape for both sources. New POS sales carry grandtotal + paymenttypecode on the header;
 * legacy (Module Manager) sales leave grandtotal at 0 and keep the amount and payment type
 * in t_salespayment, so reading the header alone reports them as Rp 0.
 */
export function normalizeSale(header: any, details: any[], payments: any[]): NormalizedSale {
  return normalizeSaleTotals(header, saleTotals(details, payments));
}

/** Per-sale sums of its lines and payments: what normalizeSale needs, also computable in SQL (see reports). */
export interface SaleTotals {
  lineDisc: number;
  lineTotal: number;
  items: number;
  hpp: number;
  payCount: number;
  paidValue: number;
  /** voucher + discount on the payment rows (the legacy bill discount) */
  payDisc: number;
  /** discount alone on the payment rows (the new POS bill discount: member + voucher + manual) */
  payDiscount: number;
  firstPayTypeId: number | null;
}

type Num = number | string | { toString(): string } | null | undefined;
type LineLike = { disc?: Num; disc2?: Num; disc3?: Num; qty?: Num; subtotal?: Num; price?: Num; totalhpp?: Num; unithpp?: Num };
type PaymentLike = { transactionvalue?: Num; voucher?: Num; discount?: Num; paymenttypeid?: Num };
type SaleHeaderLike = { status?: string | null; grandtotal?: Num; paymenttypecode?: string | null; manualdiscountamount?: Num };

export function saleTotals(details: LineLike[], payments: PaymentLike[]): SaleTotals {
  const t: SaleTotals = { lineDisc: 0, lineTotal: 0, items: 0, hpp: 0, payCount: payments.length, paidValue: 0, payDisc: 0, payDiscount: 0, firstPayTypeId: null };
  details.forEach((d) => {
    t.lineDisc += Number(d.disc || 0) + Number(d.disc2 || 0) + Number(d.disc3 || 0);
    const qty = Number(d.qty || 0);
    t.items += qty;
    t.lineTotal += Number(d.subtotal ?? Number(d.price || 0) * qty);
    t.hpp += Number(d.totalhpp || (Number(d.unithpp || 0) * qty));
  });
  payments.forEach((pm) => {
    t.paidValue += Number(pm.transactionvalue || 0);
    t.payDisc += Number(pm.voucher || 0) + Number(pm.discount || 0);
    t.payDiscount += Number(pm.discount || 0);
  });
  if (payments.length > 0) t.firstPayTypeId = Number(payments[0].paymenttypeid);
  return t;
}

export function normalizeSaleTotals(header: SaleHeaderLike, t: SaleTotals): NormalizedSale {
  // Legacy transactionvalue is before the bill discount (voucher + discount), so the paid net subtracts it.
  // Only legacy rows: the new POS stores marketplace payments in voucher.
  const legacy = isLegacySale(header);
  const billDisc = legacy ? t.payDisc : 0;
  // New POS: the payment row holds the whole bill discount (member + voucher + manual); without one, the header's manual part
  const newBillDisc = legacy ? 0 : t.payCount > 0 ? t.payDiscount : Number(header.manualdiscountamount || 0);
  const disc = (legacy ? Number(header.manualdiscountamount || 0) : 0) + t.lineDisc + billDisc + newBillDisc;
  const paidTotal = t.paidValue - billDisc;
  // A paid legacy sale's net is its payment, even when fully discounted to 0
  const net = Number(header.grandtotal) || (legacy && t.payCount > 0 ? paidTotal : paidTotal || t.lineTotal);

  let payGroup: PayGroup;
  if (header.paymenttypecode) {
    payGroup = payGroupFromText(header.paymenttypecode);
  } else if (t.payCount > 0) {
    payGroup = LEGACY_PAYMENT_GROUP[Number(t.firstPayTypeId)] ?? 'OTHER';
  } else {
    payGroup = 'CASH';
  }

  return { net, disc, items: t.items, hpp: t.hpp, payGroup };
}

/**
 * Card sale paid by credit card (old report's "Kredit") rather than debit / EDC, by the same rule as
 * salePaymentType + Sales Monitoring: header text 'CREDIT CARD', or legacy payment code 2.
 */
export function isCreditCardSale(header: SaleHeaderLike, t: SaleTotals): boolean {
  if (header.paymenttypecode) return String(header.paymenttypecode).toUpperCase() === 'CREDIT CARD';
  return t.payCount > 0 && Number(t.firstPayTypeId) === 2;
}

// Legacy codes the local m_paymenttype has no row for (see LEGACY_PAYMENT_GROUP)
const LEGACY_PAYMENT_NAME: Record<number, string> = { 4: 'Shopee', 5: 'Tokopedia', 6: 'Transfer', 7: 'EDC Mandiri' };

/**
 * "Metode Pembayaran" of the old daily reports: m_paymenttype.name of the sale's legacy payment code
 * (the old SP joins M_PaymentType.ID - 1 = PaymentTypeID). New POS sales map their header label to that
 * code, so "CASH" and legacy Cash land in one group; a label with no code (e.g. SHOPEE) stays as it is.
 */
export function salePaymentName(header: SaleHeaderLike, t: SaleTotals, typeNameByCode: Map<number, string>): string {
  const text = header.paymenttypecode ? String(header.paymenttypecode).trim().toUpperCase() : '';
  // Same fallback as normalizeSaleTotals: no header label and no payment row counts as cash
  const code = text ? legacyPaymentTypeCode(text) : t.payCount > 0 ? Number(t.firstPayTypeId) : 0;
  if (code !== null && typeNameByCode.has(code)) return typeNameByCode.get(code)!;
  if (text) return text;
  return LEGACY_PAYMENT_NAME[code ?? -1] ?? String(code);
}

/**
 * Cashier name for "Kasir :". Legacy rows store "PC-NAME/user"; the old SP took RIGHT(CreatedUser, 5),
 * which only works for 5-letter names ("K/lia"), so this keeps the part after the last "/".
 */
export function saleCashierName(createdUser: string | null | undefined): string {
  const user = String(createdUser ?? '').trim();
  return user.slice(user.lastIndexOf('/') + 1) || user;
}

/** Legacy sales (synced from the old POS) have no status; every new-app sale has one. */
export function isLegacySale(header: any): boolean {
  return header.status == null;
}
