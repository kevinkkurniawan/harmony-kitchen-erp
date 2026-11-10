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
  it('Date-only (DATE column) ranges compare by calendar day, not +07:00 instants', () => {
    const config = { whitelist: ['mrdate'], dateOnlyFields: ['mrdate'] };

    const range = parseColumnFilters(new URLSearchParams({ start_mrdate: '2026-11-06', end_mrdate: '2026-11-06' }), config);
    assert.deepStrictEqual(range.unsupportedFilters, []);
    // A DATE value is UTC midnight; gte must not reach back to 2026-11-05 (the old 2026-11-05T17:00Z bound did)
    assert.strictEqual(range.where.mrdate.gte.toISOString(), '2026-11-06T00:00:00.000Z');
    assert.strictEqual(range.where.mrdate.lte.toISOString(), '2026-11-06T00:00:00.000Z');

    const startOnly = parseColumnFilters(new URLSearchParams({ start_mrdate: '2026-11-01' }), config);
    assert.deepStrictEqual(Object.keys(startOnly.where.mrdate), ['gte']);

    const exact = parseColumnFilters(new URLSearchParams({ mrdate: '2026-11-06' }), config);
    assert.strictEqual(exact.where.mrdate.toISOString(), '2026-11-06T00:00:00.000Z');

    // Malformed days add no bound instead of falling back to today
    const bad = parseColumnFilters(new URLSearchParams({ start_mrdate: '06/11/2026' }), config);
    assert.deepStrictEqual(bad.where, {});
  });

  it('dateRangeFields (timestamp columns) keep +07:00 operational-day bounds', () => {
    const result = parseColumnFilters(new URLSearchParams({ start_createddate: '2026-11-06', end_createddate: '2026-11-06' }), {
      whitelist: ['createddate'],
      dateRangeFields: ['createddate'],
    });
    assert.strictEqual(result.where.createddate.gte.toISOString(), '2026-11-05T17:00:00.000Z');
    assert.strictEqual(result.where.createddate.lte.toISOString(), '2026-11-06T16:59:59.999Z');
  });
});
