// Display formats of the legacy DevExpress grids: "n0" numbers and "dd MMM yyyy" dates.

const N0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });

/** "n0": thousands separator, no decimals (e.g. 1.250.000). Empty for null/undefined. */
export function fmtN0(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? N0.format(n) : String(value);
}

/** "dd MMM yyyy" (e.g. 10 Nov 2026). Accepts Date, ISO string or YYYY-MM-DD. */
export function fmtDate(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value).length === 10 ? `${value}T00:00:00+07:00` : String(value));
  return Number.isNaN(d.getTime()) ? String(value) : DATE.format(d);
}
