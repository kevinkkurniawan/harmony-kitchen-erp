/**
 * Strict per-column query filter parser for ERP tables and reporting.
 * Validates requested columns against an explicit whitelist to prevent SQL injection or unindexed scans.
 */

export interface ColumnFilterConfig {
  whitelist: string[];
  numberFields?: string[];
  booleanFields?: string[];
  dateFields?: string[];
}

export interface ParsedFilters {
  where: Record<string, any>;
  unsupportedFilters: string[];
}

export function parseColumnFilters(
  searchParams: URLSearchParams,
  config: ColumnFilterConfig
): ParsedFilters {
  const where: Record<string, any> = {};
  const unsupportedFilters: string[] = [];

  const numberSet = new Set(config.numberFields || []);
  const booleanSet = new Set(config.booleanFields || []);
  const dateSet = new Set(config.dateFields || []);
  const allowedSet = new Set(config.whitelist);

  searchParams.forEach((value, key) => {
    // Skip pagination and reserved system query params
    if (['page', 'limit', 'skip', 'take', 'q', 'sort', 'order', 'status'].includes(key)) {
      return;
    }

    if (!allowedSet.has(key)) {
      unsupportedFilters.push(key);
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) return;

    if (numberSet.has(key)) {
      const num = Number(trimmed);
      if (!isNaN(num)) {
        where[key] = num;
      }
    } else if (booleanSet.has(key)) {
      if (trimmed.toLowerCase() === 'true' || trimmed === '1') {
        where[key] = true;
      } else if (trimmed.toLowerCase() === 'false' || trimmed === '0') {
        where[key] = false;
      }
    } else if (dateSet.has(key)) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        where[key] = date;
      }
    } else {
      // Case-insensitive contains filter for string fields
      where[key] = { contains: trimmed, mode: 'insensitive' };
    }
  });

  return { where, unsupportedFilters };
}
