import { describe, it } from 'node:test';
import assert from 'node:assert';
import { receiptLineAmounts, receiptHeaderAmounts, dueDateFromTerm } from '../src/lib/receipt-totals';

// Expected values worked out by hand from sp_SPMaterialReceiveDetail_InsData:
// DiscTotal = P - ROUND(P - ROUND(P*d1/100 + (P-P*d1/100)*d2/100 + (P-(...))*d3/100 + Disc, 1, 1), 0); Subtotal = Qty*(P-DiscTotal)
describe('receiptLineAmounts (old detail SP)', () => {
  it('no discount keeps the price', () => {
    assert.deepStrictEqual(receiptLineAmounts({ qty: 4, price: 50000, disc1: 0, disc2: 0, disc3: 0, discRp: 0 }), { netPrice: 50000, discTotal: 0, subtotal: 200000 });
  });
  it('cascades Disc 1 -> Disc 2 -> Disc 3 and adds Disc (Rp) per unit', () => {
    // 10000: d1 10% = 1000; d2 5% of 9000 = 450; d3 2% of 8550 = 171; + 100 Rp => 1721 => net 8279
    assert.deepStrictEqual(receiptLineAmounts({ qty: 3, price: 10000, disc1: 10, disc2: 5, disc3: 2, discRp: 100 }), { netPrice: 8279, discTotal: 1721, subtotal: 24837 });
  });
  it('truncates the discount to 1 decimal, then rounds the net price half away from zero', () => {
    // 10001 * 33.33% = 3333.3333 -> 3333.3 -> 10001 - 3333.3 = 6667.7 -> 6668
    assert.strictEqual(receiptLineAmounts({ qty: 1, price: 10001, disc1: 33.33, disc2: 0, disc3: 0, discRp: 0 }).netPrice, 6668);
    // 1005 * 10% = 100.5 -> net 904.5 -> 905 (half up)
    assert.strictEqual(receiptLineAmounts({ qty: 1, price: 1005, disc1: 10, disc2: 0, disc3: 0, discRp: 0 }).netPrice, 905);
    // 999 * 12.35% = 123.3765 -> 123.3 -> 875.7 -> 876
    assert.strictEqual(receiptLineAmounts({ qty: 2, price: 999, disc1: 12.35, disc2: 0, disc3: 0, discRp: 0 }).subtotal, 1752);
  });
});

describe('receiptHeaderAmounts', () => {
  it('Disc 1 only: ERP rule (Sub Total x %), PPn after discount, Saldo = Total - Uang Muka', () => {
    assert.deepStrictEqual(
      receiptHeaderAmounts({ subtotal: 200000, disc1: 10, isMultiDisc: false, disc2: 50, disc3: 50, ppnPercentage: 11, downPayment: 50000 }),
      { discValue: 20000, ppnValue: 19800, grandTotal: 199800, balance: 149800 },
    );
  });
  it('Multi Disc cascades Disc 2 and Disc 3', () => {
    // 100000: 10% = 10000; 10% of 90000 = 9000; 10% of 81000 = 8100 -> 27100
    const r = receiptHeaderAmounts({ subtotal: 100000, disc1: 10, isMultiDisc: true, disc2: 10, disc3: 10, ppnPercentage: 0, downPayment: 0 });
    assert.strictEqual(r.discValue, 27100);
    assert.strictEqual(r.grandTotal, 72900);
  });
});

describe('receiptHeaderAmounts rounding', () => {
  it('rounds Diskon and PPn to whole rupiah, so Total and Saldo have no fractions', () => {
    // 24837 x 11% = 2732.07 -> 2732; 33% of 24837 = 8196.21 -> 8196, PPn 11% of 16641 = 1830.51 -> 1831
    assert.deepStrictEqual(
      receiptHeaderAmounts({ subtotal: 24837, disc1: 0, isMultiDisc: false, disc2: 0, disc3: 0, ppnPercentage: 11, downPayment: 0 }),
      { discValue: 0, ppnValue: 2732, grandTotal: 27569, balance: 27569 },
    );
    const r = receiptHeaderAmounts({ subtotal: 24837, disc1: 33, isMultiDisc: false, disc2: 0, disc3: 0, ppnPercentage: 11, downPayment: 1000 });
    assert.deepStrictEqual(r, { discValue: 8196, ppnValue: 1831, grandTotal: 18472, balance: 17472 });
  });
});

describe('dueDateFromTerm', () => {
  it('adds the Lama Termin days to the MR date', () => {
    assert.strictEqual(dueDateFromTerm('2026-11-10', 30), '2026-12-10');
    assert.strictEqual(dueDateFromTerm('2026-02-27', 2), '2026-03-01');
    assert.strictEqual(dueDateFromTerm('2026-11-10', 0), '2026-11-10');
  });
});
