export function normalizeInventoryName(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizedInventoryNameKey(value: unknown): string {
  return normalizeInventoryName(value).toLocaleLowerCase('id-ID');
}

export function validateInventoryName(value: unknown): string | null {
  if (!normalizeInventoryName(value)) return 'Nama barang wajib diisi.';
  return null;
}
