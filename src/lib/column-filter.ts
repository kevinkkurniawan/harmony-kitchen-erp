import { parseBangkokStartOfDay, parseBangkokEndOfDay } from './date-utils';

export interface ColumnFilterConfig {
  whitelist: string[];
  exactMatchFields?: string[];
  enumFields?: Record<string, string[]>; // field -> allowed enum values
  numberFields?: string[];
  numericRangeFields?: string[]; // will look for min_field, max_field or field
  booleanFields?: string[];
  dateRangeFields?: string[]; // will look for start_field, end_field, or field
  containsFields?: string[];
}

export interface ParsedFilters {
  where: Record<string, any>;
  unsupportedFilters: string[];
}

/**
 * Normalizes a string for exact comparison: trims whitespace and lowercases.
 */
export function normalizeFilterValue(val: string): string {
  return val ? val.trim() : '';
}

/**
 * Strict whitelisted per-column query filter parser.
 * Produces deterministic Prisma `where` objects with exact matching, typed conversions, and Bangkok date range boundaries.
 */
export function parseColumnFilters(
  searchParams: URLSearchParams,
  config: ColumnFilterConfig
): ParsedFilters {
  const where: Record<string, any> = {};
  const unsupportedFilters: string[] = [];

  const allowedSet = new Set(config.whitelist);
  const exactSet = new Set(config.exactMatchFields || []);
  const enumMap = config.enumFields || {};
  const numberSet = new Set(config.numberFields || []);
  const numericRangeSet = new Set(config.numericRangeFields || []);
  const booleanSet = new Set(config.booleanFields || []);
  const dateRangeSet = new Set(config.dateRangeFields || []);
  const containsSet = new Set(config.containsFields || []);

  // Handled keys set to prevent processing subkeys twice
  const processedKeys = new Set<string>();

  searchParams.forEach((value, key) => {
    // Skip pagination, sorting, and global search keywords
    if (['page', 'limit', 'skip', 'take', 'q', 'sort', 'order', 'status'].includes(key) && !allowedSet.has(key)) {
      return;
    }

    if (processedKeys.has(key)) return;

    // Check if key is a range prefix (min_*, max_*, start_*, end_*)
    let baseField = key;
    let isRange = false;

    if (key.startsWith('min_') || key.startsWith('max_')) {
      baseField = key.replace(/^(min_|max_)/, '');
      isRange = true;
    } else if (key.startsWith('start_') || key.startsWith('end_')) {
      baseField = key.replace(/^(start_|end_)/, '');
      isRange = true;
    }

    if (!allowedSet.has(baseField) && !allowedSet.has(key)) {
      unsupportedFilters.push(key);
      return;
    }

    const trimmed = normalizeFilterValue(value);
    if (!trimmed) return;

    // 1. Date Range Fields
    if (dateRangeSet.has(baseField)) {
      processedKeys.add(`start_${baseField}`);
      processedKeys.add(`end_${baseField}`);
      processedKeys.add(baseField);

      const startVal = searchParams.get(`start_${baseField}`) || (key === `start_${baseField}` ? trimmed : null);
      const endVal = searchParams.get(`end_${baseField}`) || (key === `end_${baseField}` ? trimmed : null);
      const exactVal = searchParams.get(baseField);

      if (startVal || endVal) {
        where[baseField] = {};
        if (startVal) where[baseField].gte = parseBangkokStartOfDay(startVal);
        if (endVal) where[baseField].lte = parseBangkokEndOfDay(endVal);
      } else if (exactVal) {
        where[baseField] = {
          gte: parseBangkokStartOfDay(exactVal),
          lte: parseBangkokEndOfDay(exactVal),
        };
      }
      return;
    }

    // 2. Numeric Range Fields
    if (numericRangeSet.has(baseField)) {
      processedKeys.add(`min_${baseField}`);
      processedKeys.add(`max_${baseField}`);
      processedKeys.add(baseField);

      const minVal = searchParams.get(`min_${baseField}`);
      const maxVal = searchParams.get(`max_${baseField}`);
      const directVal = searchParams.get(baseField);

      if (minVal !== null || maxVal !== null) {
        where[baseField] = {};
        if (minVal !== null && !isNaN(Number(minVal))) where[baseField].gte = Number(minVal);
        if (maxVal !== null && !isNaN(Number(maxVal))) where[baseField].lte = Number(maxVal);
      } else if (directVal !== null && !isNaN(Number(directVal))) {
        where[baseField] = Number(directVal);
      }
      return;
    }

    // 3. Exact Enum Fields
    if (enumMap[key]) {
      const allowedEnums = enumMap[key].map((e) => e.toUpperCase());
      const upperVal = trimmed.toUpperCase();
      if (allowedEnums.includes(upperVal)) {
        where[key] = upperVal;
      } else {
        unsupportedFilters.push(`${key}:${value}`);
      }
      processedKeys.add(key);
      return;
    }

    // 4. Number Fields
    if (numberSet.has(key)) {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        where[key] = num;
      }
      processedKeys.add(key);
      return;
    }

    // 5. Boolean Fields
    if (booleanSet.has(key)) {
      if (trimmed.toLowerCase() === 'true' || trimmed === '1') {
        where[key] = true;
      } else if (trimmed.toLowerCase() === 'false' || trimmed === '0') {
        where[key] = false;
      }
      processedKeys.add(key);
      return;
    }

    // 6. Exact Match Text Fields
    if (exactSet.has(key)) {
      where[key] = { equals: trimmed, mode: 'insensitive' };
      processedKeys.add(key);
      return;
    }

    // 7. Contains Text Fields (explicitly configured)
    if (containsSet.has(key)) {
      where[key] = { contains: trimmed, mode: 'insensitive' };
      processedKeys.add(key);
      return;
    }

    // Default to exact match for any other whitelisted column
    where[key] = { equals: trimmed, mode: 'insensitive' };
    processedKeys.add(key);
  });

  return { where, unsupportedFilters };
}

/** Splits a free-text search into non-empty whitespace-separated tokens. */
export function tokenizeSearch(value: string | null | undefined): string[] {
  return (value || '').trim().split(/\s+/).filter(Boolean);
}

/**
 * Per-column "contains" filters (f_* params) plus the tokenized global search (q) for m_inventory.
 * Returns Prisma conditions to be combined with AND; shared by the inventory list and stock metrics routes.
 */
export function buildInventorySearchConditions(searchParams: URLSearchParams): Record<string, any>[] {
  const conditions: Record<string, any>[] = [];
  const contains = (v: string) => ({ contains: v, mode: 'insensitive' });

  // Every token must match name, barcode or SKU (so "onyx sambal" finds "Onyx Tempat Sambal")
  for (const token of tokenizeSearch(searchParams.get('q'))) {
    conditions.push({
      OR: [
        { inventoryname: contains(token) },
        { barcode: contains(token) },
        { inventoryno: contains(token) },
      ],
    });
  }

  const textColumns: Record<string, string> = {
    f_inventoryno: 'inventoryno',
    f_barcode: 'barcode',
    f_description: 'description',
  };
  for (const [param, column] of Object.entries(textColumns)) {
    const v = normalizeFilterValue(searchParams.get(param) || '');
    if (v) conditions.push({ [column]: contains(v) });
  }

  for (const token of tokenizeSearch(searchParams.get('f_inventoryname'))) {
    conditions.push({ inventoryname: contains(token) });
  }

  const uom = normalizeFilterValue(searchParams.get('f_uom') || '');
  if (uom) conditions.push({ m_uom: { uomname: contains(uom) } });

  return conditions;
}
