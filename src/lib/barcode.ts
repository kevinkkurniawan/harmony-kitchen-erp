/**
 * Minimal barcode encoders for the label printer (no dependency).
 * Output is a string of modules, '1' = bar and '0' = space, each one module wide.
 * Symbology: EAN-13 / EAN-8 only for values that already are valid EAN codes (nearly all items),
 * Code 128-B for anything else, so a scan always returns exactly the stored value.
 */

export interface EncodedBarcode {
  modules: string;
  symbology: 'EAN13' | 'EAN8' | 'CODE128';
  /** Text printed under the bars (always the stored value). */
  text: string;
}

// EAN L/G/R digit patterns (7 modules each)
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
// EAN-13 first digit selects the L/G parity of the left half
const EAN13_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** EAN/UPC check digit: weights 3,1,3,1... from the rightmost data digit. */
export function eanCheckDigit(data: string): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const weight = (data.length - i) % 2 === 1 ? 3 : 1;
    sum += Number(data[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function encodeEan13(digits12: string): string {
  const full = digits12 + eanCheckDigit(digits12);
  const parity = EAN13_PARITY[Number(full[0])];
  let m = '101';
  for (let i = 1; i <= 6; i++) m += (parity[i - 1] === 'L' ? EAN_L : EAN_G)[Number(full[i])];
  m += '01010';
  for (let i = 7; i <= 12; i++) m += EAN_R[Number(full[i])];
  return m + '101';
}

function encodeEan8(digits7: string): string {
  const full = digits7 + eanCheckDigit(digits7);
  let m = '101';
  for (let i = 0; i < 4; i++) m += EAN_L[Number(full[i])];
  m += '01010';
  for (let i = 4; i < 8; i++) m += EAN_R[Number(full[i])];
  return m + '101';
}

// Code 128 bar/space widths for values 0..106 (106 = stop, plus a final 2-module bar)
const C128 = [
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
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function widthsToModules(widths: string): string {
  let m = '';
  for (let i = 0; i < widths.length; i++) m += (i % 2 === 0 ? '1' : '0').repeat(Number(widths[i]));
  return m;
}

/** Code 128 subset B (printable ASCII 32..126). */
function encodeCode128B(text: string): string {
  const START_B = 104;
  const values = [START_B, ...Array.from(text).map((ch) => ch.charCodeAt(0) - 32)];
  const checksum = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  return [...values, checksum, 106].map((v) => widthsToModules(C128[v])).join('');
}

/** Encodes a stored barcode value; null when there is nothing printable to encode. */
export function encodeBarcode(raw: string | null | undefined): EncodedBarcode | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  if (/^\d{13}$/.test(value) && eanCheckDigit(value.slice(0, 12)) === Number(value[12])) {
    return { modules: encodeEan13(value.slice(0, 12)), symbology: 'EAN13', text: value };
  }
  if (/^\d{8}$/.test(value) && eanCheckDigit(value.slice(0, 7)) === Number(value[7])) {
    return { modules: encodeEan8(value.slice(0, 7)), symbology: 'EAN8', text: value };
  }
  if (/^[\x20-\x7e]+$/.test(value)) {
    return { modules: encodeCode128B(value), symbology: 'CODE128', text: value };
  }
  return null;
}
