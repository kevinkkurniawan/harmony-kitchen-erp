import type { ERPProduct } from '@/types/erp';

export interface InventorySearchResult {
  items: ERPProduct[];
  error?: string;
}

function extractApiError(json: any, fallback: string): string {
  if (typeof json?.error === 'string') return json.error;
  if (typeof json?.error?.message === 'string') return json.error.message;
  if (typeof json?.message === 'string') return json.message;
  return fallback;
}

/** Calls /api/inventory search and reports failures instead of swallowing them. */
export async function searchInventory(query: string, limit = 20): Promise<InventorySearchResult> {
  try {
    const res = await fetch(`/api/inventory?q=${encodeURIComponent(query.trim())}&limit=${limit}&status=active`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !Array.isArray(json.data)) {
      return { items: [], error: extractApiError(json, `Pencarian barang gagal (HTTP ${res.status})`) };
    }
    return { items: json.data };
  } catch {
    return { items: [], error: 'Gagal terhubung ke server saat mencari barang' };
  }
}

/** Picks the exact barcode / SKU match from a result list, if any. */
export function findExactScanMatch<T extends { barcode?: string | null; inventoryNo?: string | null }>(
  items: T[],
  raw: string
): T | undefined {
  const q = raw.trim().toLowerCase();
  return items.find(
    (i) => (i.barcode || '').trim().toLowerCase() === q || (i.inventoryNo || '').trim().toLowerCase() === q
  );
}

/**
 * Immediate lookup for a scanned / typed value (barcode scanners press Enter before any debounce fires).
 * Prefers an exact barcode / SKU match, otherwise the first search hit.
 */
export async function lookupInventoryByScan(raw: string): Promise<{ item: ERPProduct | null; error?: string }> {
  if (!raw.trim()) return { item: null };
  const { items, error } = await searchInventory(raw, 20);
  if (error) return { item: null, error };
  return { item: findExactScanMatch(items, raw) || items[0] || null };
}
