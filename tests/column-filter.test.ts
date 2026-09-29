import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseColumnFilters } from '../src/lib/column-filter';
import { parseBangkokStartOfDay, parseBangkokEndOfDay, formatBangkokDate } from '../src/lib/date-utils';

describe('Strict Column Filtering and Bangkok Timezone Suite', () => {
  it('Whitelisted exact text and enum filtering', () => {
    const params = new URLSearchParams({
      paymenttypecode: 'QRIS',
      status: 'COMPLETED',
    });

    const result = parseColumnFilters(params, {
      whitelist: ['paymenttypecode', 'status'],
      exactMatchFields: ['paymenttypecode', 'status'],
      enumFields: {
        paymenttypecode: ['CASH', 'QRIS', 'TRANSFER', 'EDC BCA', 'EDC MANDIRI'],
      },
    });

    assert.deepStrictEqual(result.unsupportedFilters, []);
    assert.deepStrictEqual(result.where, {
      paymenttypecode: 'QRIS',
      status: { equals: 'COMPLETED', mode: 'insensitive' },
    });
  });

  it('Rejects unsupported query parameters with non-empty unsupportedFilters array', () => {
    const params = new URLSearchParams({
      paymenttypecode: 'CASH',
      maliciousField: 'drop table',
      unsupportedCol: '123',
    });

    const result = parseColumnFilters(params, {
      whitelist: ['paymenttypecode', 'createduser'],
      exactMatchFields: ['paymenttypecode'],
    });

    assert.ok(result.unsupportedFilters.includes('maliciousField'));
    assert.ok(result.unsupportedFilters.includes('unsupportedCol'));
    assert.deepStrictEqual(result.where, {
      paymenttypecode: { equals: 'CASH', mode: 'insensitive' },
    });
  });

  it('Numeric range filtering with min_ and max_ prefixes', () => {
    const params = new URLSearchParams({
      min_price: '50000',
      max_price: '150000',
    });

    const result = parseColumnFilters(params, {
      whitelist: ['price'],
      numericRangeFields: ['price'],
    });

    assert.deepStrictEqual(result.unsupportedFilters, []);
    assert.deepStrictEqual(result.where, {
      price: {
        gte: 50000,
        lte: 150000,
      },
    });
  });

  it('Bangkok operational-day boundaries (+07:00)', () => {
    const start = parseBangkokStartOfDay('2026-09-22');
    const end = parseBangkokEndOfDay('2026-09-22');

    // 2026-09-22 00:00:00 Bangkok is 2026-09-21 17:00:00 UTC
    assert.strictEqual(start.toISOString(), '2026-09-21T17:00:00.000Z');
    // 2026-09-22 23:59:59.999 Bangkok is 2026-09-22 16:59:59.999 UTC
    assert.strictEqual(end.toISOString(), '2026-09-22T16:59:59.999Z');

    assert.strictEqual(formatBangkokDate(start), '2026-09-22');
    assert.strictEqual(formatBangkokDate(end), '2026-09-22');
  });
});
