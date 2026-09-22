import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Sales Unvoid Atomic Stock Validation Suite', () => {
  function validateUnvoidStock(
    details: Array<{ inventoryid: number; qty: number; name: string }>,
    stockMap: Map<number, number>
  ) {
    for (const item of details) {
      const currentStock = stockMap.get(item.inventoryid) ?? 0;
      if (currentStock < item.qty) {
        throw new Error(
          `Stok tidak mencukupi untuk unvoid item "${item.name}". Sisa stok: ${currentStock}, dibutuhkan: ${item.qty}`
        );
      }
    }
    return true;
  }

  it('Permits unvoid when all items have sufficient current stock', () => {
    const details = [
      { inventoryid: 101, qty: 5, name: 'Panci Stainless 24cm' },
      { inventoryid: 102, qty: 2, name: 'Spatula Silikon' },
    ];
    const stockMap = new Map([
      [101, 10],
      [102, 5],
    ]);

    assert.doesNotThrow(() => validateUnvoidStock(details, stockMap));
  });

  it('Rejects unvoid atomically when any item has insufficient stock', () => {
    const details = [
      { inventoryid: 101, qty: 5, name: 'Panci Stainless 24cm' },
      { inventoryid: 102, qty: 8, name: 'Wajan Wok 32cm' },
    ];
    const stockMap = new Map([
      [101, 10],
      [102, 3], // Only 3 in stock, but 8 needed
    ]);

    assert.throws(
      () => validateUnvoidStock(details, stockMap),
      /Stok tidak mencukupi untuk unvoid item "Wajan Wok 32cm"/
    );
  });
});
