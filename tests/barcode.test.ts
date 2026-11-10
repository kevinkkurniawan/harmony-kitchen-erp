import { describe, it } from 'node:test';
import assert from 'node:assert';
import { encodeBarcode } from '../src/lib/barcode';

// Independent decoders: they read the module string the way a scanner would and must give back the stored value.

// EAN digit sets: only L is listed; R is L inverted and G is R reversed (EAN definition)
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((p) => Array.from(p, (b) => (b === '1' ? '0' : '1')).join(''));
const G = R.map((p) => Array.from(p).reverse().join(''));
const FIRST_DIGIT_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function eanCheck(digits: string): boolean {
  const sum = Array.from(digits).reduce((s, d, i) => s + Number(d) * ((digits.length - i) % 2 === 1 ? 1 : 3), 0);
  return sum % 10 === 0;
}

function decodeEan(modules: string): string {
  const half = (modules.length - 3 - 5 - 3) / 2 / 7;
  assert.ok(half === 6 || half === 4, `unexpected EAN length ${modules.length}`);
  assert.strictEqual(modules.slice(0, 3), '101', 'start guard');
  assert.strictEqual(modules.slice(-3), '101', 'end guard');
  const mid = 3 + half * 7;
  assert.strictEqual(modules.slice(mid, mid + 5), '01010', 'center guard');
  let left = '';
  let parity = '';
  for (let i = 0; i < half; i++) {
    const p = modules.slice(3 + i * 7, 10 + i * 7);
    const l = L.indexOf(p);
    const g = G.indexOf(p);
    assert.ok(l >= 0 || (half === 6 && g >= 0), `bad left digit pattern ${p}`);
    left += l >= 0 ? l : g;
    parity += l >= 0 ? 'L' : 'G';
  }
  let right = '';
  for (let i = 0; i < half; i++) {
    const p = modules.slice(mid + 5 + i * 7, mid + 12 + i * 7);
    const r = R.indexOf(p);
    assert.ok(r >= 0, `bad right digit pattern ${p}`);
    right += r;
  }
  let text = left + right;
  if (half === 6) {
    const first = FIRST_DIGIT_PARITY.indexOf(parity);
    assert.ok(first >= 0, `bad parity ${parity}`);
    text = first + text;
  }
  assert.ok(eanCheck(text), `check digit of ${text}`);
  return text;
}

// Code 128 symbol widths (bar, space, bar, space, bar, space) by value; 106 = stop
const C128_WIDTHS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '233111',
];

/** Decodes Code 128 (start B or C, CODE B / CODE C shifts) and checks the mod-103 checksum. */
function decodeCode128(modules: string): { text: string; start: 'B' | 'C' } {
  const runs: number[] = [];
  for (let i = 0; i < modules.length; ) {
    let j = i;
    while (j < modules.length && modules[j] === modules[i]) j++;
    runs.push(j - i);
    i = j;
  }
  assert.strictEqual(modules[0], '1', 'starts with a bar');
  // Stop = 7 elements (2331112); every other symbol = 6 elements, 11 modules
  assert.strictEqual(runs.slice(-7).join(''), '2331112', 'stop pattern');
  const body = runs.slice(0, -7);
  assert.strictEqual(body.length % 6, 0, 'whole symbols');
  const values: number[] = [];
  for (let i = 0; i < body.length; i += 6) {
    const w = body.slice(i, i + 6).join('');
    const v = C128_WIDTHS.indexOf(w);
    assert.ok(v >= 0 && v < 106, `unknown symbol ${w}`);
    values.push(v);
  }
  const checksum = values.pop()!;
  assert.strictEqual(values.reduce((s, v, i) => s + v * (i === 0 ? 1 : i), 0) % 103, checksum, 'checksum');
  const startValue = values.shift();
  assert.ok(startValue === 104 || startValue === 105, `start code ${startValue}`);
  let set: 'B' | 'C' = startValue === 104 ? 'B' : 'C';
  const start = set;
  let text = '';
  for (const v of values) {
    if (set === 'C' && v === 100) set = 'B';
    else if (set === 'B' && v === 99) set = 'C';
    else if (set === 'C') {
      assert.ok(v < 100, `bad subset C value ${v}`);
      text += String(v).padStart(2, '0');
    } else {
      assert.ok(v < 95, `bad subset B value ${v}`);
      text += String.fromCharCode(v + 32);
    }
  }
  return { text, start };
}

describe('Label barcode encoder (src/lib/barcode.ts)', () => {
  it('Code 128 decoder table matches known reference patterns', () => {
    const toModules = (w: string) => Array.from(w).map((n, i) => (i % 2 === 0 ? '1' : '0').repeat(Number(n))).join('');
    assert.strictEqual(toModules(C128_WIDTHS[104]), '11010010000'); // Start B
    assert.strictEqual(toModules(C128_WIDTHS[105]), '11010011100'); // Start C
    assert.strictEqual(toModules(C128_WIDTHS[100]), '10111101110'); // CODE B
    assert.strictEqual(toModules('2331112'), '1100011101011'); // Stop
    for (const w of C128_WIDTHS) {
      assert.strictEqual(Array.from(w).reduce((s, n) => s + Number(n), 0), 11, w);
    }
    assert.strictEqual(new Set(C128_WIDTHS).size, C128_WIDTHS.length);
  });

  it('EAN-13 round-trip with 11-module quiet zone', () => {
    for (const v of ['4006381333931', '8991234567891', '0000000000000']) {
      const e = encodeBarcode(v)!;
      assert.strictEqual(e.symbology, 'EAN13');
      assert.strictEqual(e.quietZone, 11);
      assert.strictEqual(e.modules.length, 95);
      assert.strictEqual(decodeEan(e.modules), v);
    }
  });

  it('EAN-8 round-trip', () => {
    for (const v of ['96385074', '40170725']) {
      const e = encodeBarcode(v)!;
      assert.strictEqual(e.symbology, 'EAN8');
      assert.strictEqual(e.quietZone, 11);
      assert.strictEqual(e.modules.length, 67);
      assert.strictEqual(decodeEan(e.modules), v);
    }
  });

  it('Code 128 subset B round-trip for text values', () => {
    for (const v of ['ACG10AAE.FROSTY02', 'BLG-PCD026', 'a b~', '7']) {
      const e = encodeBarcode(v)!;
      assert.strictEqual(e.symbology, 'CODE128');
      assert.strictEqual(e.quietZone, 10);
      assert.deepStrictEqual(decodeCode128(e.modules), { text: v, start: 'B' });
    }
  });

  it('Code 128 subset C round-trip for digit strings (even and odd length)', () => {
    // 4006381333932 = EAN-13 with a wrong check digit, 012345678905 = 12 digits: both must not become EAN
    for (const v of ['12', '0001', '1234567890123456', '123', '12345678901234567', '4006381333932', '012345678905', '00000000000000000']) {
      const e = encodeBarcode(v)!;
      assert.strictEqual(e.symbology, 'CODE128', v);
      assert.deepStrictEqual(decodeCode128(e.modules), { text: v, start: 'C' }, v);
    }
  });

  it('Subset C makes a 17-digit value about a third narrower than subset B', () => {
    const c = encodeBarcode('12345678901234567')!.modules.length;
    const bLength = (17 + 3) * 11 + 2; // start + 17 chars + checksum + stop in subset B
    assert.ok(c < bLength * 0.7, `${c} vs ${bLength}`);
  });

  it('Stored value is trimmed; empty or non-printable values encode to null', () => {
    assert.strictEqual(encodeBarcode('  4006381333931 ')!.text, '4006381333931');
    assert.strictEqual(encodeBarcode(''), null);
    assert.strictEqual(encodeBarcode(null), null);
    assert.strictEqual(encodeBarcode('kopié'), null);
  });
});
