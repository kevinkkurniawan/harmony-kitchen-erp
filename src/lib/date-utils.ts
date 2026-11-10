/**
 * Timezone-aware date utilities for Asia/Bangkok (UTC+7)
 * Ensures consistent day/month boundaries without depending on server/runtime local timezone.
 */

const BANGKOK_TZ = 'Asia/Bangkok';

// Building an Intl.DateTimeFormat is slow (~35 µs); reports format thousands of dates, so reuse these
const DATE_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: BANGKOK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const TIME_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: BANGKOK_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const MONTH_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: BANGKOK_TZ, year: 'numeric', month: '2-digit' });

/**
 * Parses a 'YYYY-MM-DD' string into a JavaScript Date corresponding to
 * 00:00:00.000+07:00 (Start of operational day in Bangkok).
 */
export function parseBangkokStartOfDay(dateStr: string): Date {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const now = new Date();
    const todayStr = formatBangkokDate(now);
    return new Date(`${todayStr}T00:00:00.000+07:00`);
  }
  return new Date(`${dateStr}T00:00:00.000+07:00`);
}

/**
 * Parses a 'YYYY-MM-DD' string into a JavaScript Date corresponding to
 * 23:59:59.999+07:00 (End of operational day in Bangkok).
 */
export function parseBangkokEndOfDay(dateStr: string): Date {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const now = new Date();
    const todayStr = formatBangkokDate(now);
    return new Date(`${todayStr}T23:59:59.999+07:00`);
  }
  return new Date(`${dateStr}T23:59:59.999+07:00`);
}

/**
 * Formats a Date object or ISO string into 'YYYY-MM-DD' in Asia/Bangkok timezone.
 */
export function formatBangkokDate(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  // 'sv-SE' locale outputs ISO-formatted date: YYYY-MM-DD
  return DATE_FMT.format(d);
}

/**
 * Formats a Date object or ISO string into 'YYYY-MM-DD HH:mm:ss' in Asia/Bangkok timezone.
 */
export function formatBangkokDateTime(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const datePart = DATE_FMT.format(d);
  const timePart = TIME_FMT.format(d);
  return `${datePart} ${timePart}`;
}

/**
 * Returns the current date in Bangkok as 'YYYY-MM-DD'.
 */
export function getTodayBangkok(): string {
  return formatBangkokDate(new Date());
}

/**
 * Formats a Date object or ISO string into 'YYYY-MM' in Asia/Bangkok timezone.
 */
export function formatBangkokMonth(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const parts = MONTH_FMT.formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  return `${year}-${month}`;
}

/**
 * A 'YYYY-MM-DD' day as the value of a Postgres DATE column (UTC midnight), or null if malformed.
 * Comparing a DATE column with a +07:00 instant shifts the range one day back, so use this for DATE columns.
 */
export function dateColumnDay(dateStr: string | null | undefined): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return new Date(`${dateStr}T00:00:00Z`);
}
