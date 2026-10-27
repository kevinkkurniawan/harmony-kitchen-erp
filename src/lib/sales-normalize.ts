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
  if (payments.length === 0) return 'CASH';
  const group = LEGACY_PAYMENT_GROUP[Number(payments[0].paymenttypeid)] ?? 'OTHER';
  return group === 'CARD' ? 'DEBIT' : group;
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
  let disc = Number(header.manualdiscountamount || 0);
  let items = 0;
  let hpp = 0;
  let lineTotal = 0;
  details.forEach((d: any) => {
    disc += Number(d.disc || 0) + Number(d.disc2 || 0) + Number(d.disc3 || 0);
    const qty = Number(d.qty || 0);
    items += qty;
    lineTotal += Number(d.subtotal ?? Number(d.price || 0) * qty);
    hpp += Number(d.totalhpp || (Number(d.unithpp || d.hpp || 0) * qty));
  });

  const paidTotal = payments.reduce((sum, pm) => sum + Number(pm.transactionvalue || 0), 0);
  const net = Number(header.grandtotal) || paidTotal || lineTotal;

  let payGroup: PayGroup;
  if (header.paymenttypecode) {
    payGroup = payGroupFromText(header.paymenttypecode);
  } else if (payments.length > 0) {
    payGroup = LEGACY_PAYMENT_GROUP[Number(payments[0].paymenttypeid)] ?? 'OTHER';
  } else {
    payGroup = 'CASH';
  }

  return { net, disc, items, hpp, payGroup };
}

/** Legacy sales (synced from the old POS) have no status; every new-app sale has one. */
export function isLegacySale(header: any): boolean {
  return header.status == null;
}
