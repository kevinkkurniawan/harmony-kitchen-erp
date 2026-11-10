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
  firstPayTypeId: number | null;
}

type Num = number | string | { toString(): string } | null | undefined;
type LineLike = { disc?: Num; disc2?: Num; disc3?: Num; qty?: Num; subtotal?: Num; price?: Num; totalhpp?: Num; unithpp?: Num };
type PaymentLike = { transactionvalue?: Num; voucher?: Num; discount?: Num; paymenttypeid?: Num };
type SaleHeaderLike = { status?: string | null; grandtotal?: Num; paymenttypecode?: string | null; manualdiscountamount?: Num };

export function saleTotals(details: LineLike[], payments: PaymentLike[]): SaleTotals {
  const t: SaleTotals = { lineDisc: 0, lineTotal: 0, items: 0, hpp: 0, payCount: payments.length, paidValue: 0, payDisc: 0, firstPayTypeId: null };
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
  });
  if (payments.length > 0) t.firstPayTypeId = Number(payments[0].paymenttypeid);
  return t;
}

export function normalizeSaleTotals(header: SaleHeaderLike, t: SaleTotals): NormalizedSale {
  // Legacy transactionvalue is before the bill discount (voucher + discount), so the paid net subtracts it.
  // Only legacy rows: the new POS stores marketplace payments in voucher.
  const billDisc = isLegacySale(header) ? t.payDisc : 0;
  const disc = Number(header.manualdiscountamount || 0) + t.lineDisc + billDisc;
  const paidTotal = t.paidValue - billDisc;
  const net = Number(header.grandtotal) || paidTotal || t.lineTotal;

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

/** Legacy sales (synced from the old POS) have no status; every new-app sale has one. */
export function isLegacySale(header: any): boolean {
  return header.status == null;
}
