/**
 * Timezone-aware date utilities for Asia/Bangkok (UTC+7)
 * Ensures consistent day/month boundaries without depending on server/runtime local timezone.
 */

const BANGKOK_TZ = 'Asia/Bangkok';

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
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Formats a Date object or ISO string into 'YYYY-MM-DD HH:mm:ss' in Asia/Bangkok timezone.
 */
export function formatBangkokDateTime(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const datePart = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
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
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: BANGKOK_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d);
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  return `${year}-${month}`;
}
