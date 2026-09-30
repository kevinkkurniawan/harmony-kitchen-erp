import { test, expect } from '@playwright/test';

const MOCK_LOOKUPS = {
  success: true,
  data: {
    brands: [
      { id: 1, brandName: 'Maspion' },
      { id: 2, brandName: 'Maxim' },
    ],
    productTypes: [
      { id: 1, productName: 'Cookware' },
      { id: 2, productName: 'Glassware' },
    ],
    uoms: [
      { id: 1, uomName: 'PCS' },
      { id: 2, uomName: 'SET' },
    ],
    wholesaleCategories: [
      {
        id: 1,
        code: 'STD',
        name: 'Standard Grosir',
        tier1_minqty: 3,
        tier2_minqty: 6,
        tier3_minqty: 12,
      },
      {
        id: 2,
        code: 'LUSIN',
        name: 'Grosir Lusinan',
        tier1_minqty: 6,
        tier2_minqty: 12,
        tier3_minqty: 24,
      },
    ],
  },
};

const MOCK_PRODUCTS = [
  {
    id: '101',
    inventoryNo: 'MSP-PN-24',
    barcode: '8990001000101',
    inventoryName: 'Panci Maspion 24cm',
    inventoryBrandId: 1,
    brandName: 'Maspion',
    inventoryProductId: 1,
    productName: 'Cookware',
    uoMId: 1,
    uomName: 'PCS',
    wholesaleCategoryId: 1,
    wholesaleCategoryName: 'Standard Grosir',
    wholesaleCategory: {
      id: 1,
      code: 'STD',
      name: 'Standard Grosir',
      tier1_minqty: 3,
      tier2_minqty: 6,
      tier3_minqty: 12,
    },
    kodeHarga: 'STD',
    description: 'Panci aluminium tebal',
    price: 85000,
    hpp: 65000,
    priceBuy: 64000,
    grosir1: 82000,
    grosir2: 79000,
    grosir3: 75000,
    stokAwal: 10,
    stokAkhir: 25,
    isActive: true,
  },
  {
    id: '102',
    inventoryNo: 'MXM-WJ-30',
    barcode: '8990001000102',
    inventoryName: 'Wajan Maxim Teflon 30cm',
    inventoryBrandId: 2,
    brandName: 'Maxim',
    inventoryProductId: 1,
    productName: 'Cookware',
    uoMId: 1,
    uomName: 'PCS',
    wholesaleCategoryId: 2,
    wholesaleCategoryName: 'Grosir Lusinan',
    wholesaleCategory: {
      id: 2,
      code: 'LUSIN',
      name: 'Grosir Lusinan',
      tier1_minqty: 6,
      tier2_minqty: 12,
      tier3_minqty: 24,
    },
    kodeHarga: 'STD',
    description: 'Wajan anti lengket',
    price: 150000,
    hpp: 115000,
    priceBuy: 110000,
    grosir1: 145000,
    grosir2: 140000,
    grosir3: 135000,
    stokAwal: 5,
    stokAkhir: -2,
    isActive: true,
  },
];

test.describe('Master Barang E2E Suite (Admin Role)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          user: {
            id: 5,
            username: 'admin',
            fullName: 'Admin ERP',
            userLevel: 'Admin',
            isActive: true,
          },
          permissions: [],
        },
      });
    });

    await page.route('**/api/inventory/lookups', async (route) => {
      await route.fulfill({ json: MOCK_LOOKUPS });
    });

    await page.route('**/api/inventory/*/hpp-history', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: 'hpp-1',
              mrNo: 'MR-2026-0001',
              mrDate: '2026-09-15',
              supplierName: 'PT Maspion',
              hpp: 65000,
            },
          ],
        },
      });
    });

    await page.route('**/api/inventory?*', async (route) => {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const status = url.searchParams.get('status') || 'active';
      const minusStock = url.searchParams.get('minusStock') === 'true';

      let filtered = [...MOCK_PRODUCTS];
      if (status === 'active') filtered = filtered.filter((p) => p.isActive);
      if (status === 'inactive') filtered = filtered.filter((p) => !p.isActive);
      if (minusStock) filtered = filtered.filter((p) => p.stokAkhir < 0);
      if (q) {
        filtered = filtered.filter(
          (p) =>
            p.inventoryName.toLowerCase().includes(q) ||
            p.inventoryNo.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)
        );
      }

      await route.fulfill({
        json: {
          success: true,
          data: filtered,
          pagination: { total: filtered.length, page: 1, limit: 1000 },
        },
      });
    });

    await page.goto('/');
    await expect(page.locator('input[placeholder*="Cari Barang"]')).toBeVisible();
  });

  test('1. Layout, Toolbar & Table Headers adhere to streamlined OpenSpec', async ({ page }) => {
    // Toolbar buttons
    await expect(page.locator('button', { hasText: 'Tambah Barang' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Detail Info' })).toBeVisible();
    await expect(page.locator('a[href="/inventory/barcode"]', { hasText: 'Cetak Barcode' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Laporan Stok' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Refresh' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Export Excel' })).toBeVisible();

    // 3-state status filter buttons
    await expect(page.getByRole('button', { name: 'Semua', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aktif', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nonaktif', exact: true })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Minus' })).toBeVisible();

    // Active table headers
    const headers = page.locator('thead th');
    await expect(headers.filter({ hasText: 'Inventory No' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Barcode' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Nama Barang' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Brand' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Product' })).toBeVisible();
    await expect(headers.filter({ hasText: 'UoM' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Price (Retail)' })).toBeVisible();
    await expect(headers.filter({ hasText: 'HPP (Modal)' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Keterangan' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Grosir 1' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Grosir 2' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Grosir 3' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Stok Akhir' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Status' })).toBeVisible();
    await expect(headers.filter({ hasText: 'Aksi' })).toBeVisible();

    // Obsolete fields MUST NOT be present
    await expect(headers.filter({ hasText: 'Category' })).toHaveCount(0);
    await expect(headers.filter({ hasText: 'Min/Max' })).toHaveCount(0);
    await expect(page.locator('button', { hasText: 'List Barcode' })).toHaveCount(0);
  });

  test('2. Search input, "/" shortcut, Status/Brand/Minus filters & Sorting', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Cari Barang"]');

    // Pressing "/" outside input focuses the search input
    await page.locator('body').click();
    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();

    // Typing "/" inside search input works (not blocked by shortcut)
    await searchInput.fill('GN 1/2');
    await expect(searchInput).toHaveValue('GN 1/2');

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('tbody tr')).toHaveCount(2);

    // Filter by Minus Stock
    await page.locator('label', { hasText: 'Minus' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText('MXM-WJ-30');

    // Reset filter button appears and restores all items
    const resetBtn = page.locator('button[title="Reset Filter"]');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await expect(page.locator('tbody tr')).toHaveCount(2);

    // Filter by Brand dropdown
    const brandSelect = page.locator('select').filter({ hasText: 'Semua Brand' });
    await brandSelect.selectOption('1'); // Maspion
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText('Panci Maspion 24cm');
    await brandSelect.selectOption('all');
    await expect(page.locator('tbody tr')).toHaveCount(2);

    // Column sorting: Price (Retail) asc -> desc
    const priceHeader = page.locator('thead th', { hasText: 'Price (Retail)' });
    await priceHeader.click(); // asc: 85000 first
    await expect(page.locator('tbody tr').first()).toContainText('MSP-PN-24');
    await priceHeader.click(); // desc: 150000 first
    await expect(page.locator('tbody tr').first()).toContainText('MXM-WJ-30');
  });

  test('3. Detail Infobox displays wholesale thresholds & Quick Opname (Add & Set)', async ({ page }) => {
    // Select second row (Grosir Lusinan: thresholds 6, 12, 24)
    const secondRow = page.locator('tbody tr').nth(1);
    await secondRow.click();

    await expect(page.locator('h4', { hasText: 'Detail Infobox: Wajan Maxim Teflon 30cm' })).toBeVisible();
    await expect(page.locator('div', { hasText: 'Tier Grosir (Grosir Lusinan)' }).first()).toBeVisible();
    await expect(page.locator('div', { hasText: 'G1 (≥6): Rp 145.000' }).first()).toBeVisible();
    await expect(page.locator('div', { hasText: 'G2 (≥12): Rp 140.000 | G3 (≥24): Rp 135.000' }).first()).toBeVisible();

    // Test Quick Opname (Add & Set)
    const opnamePayloads: any[] = [];
    await page.route('**/api/inventory/opname', async (route) => {
      const body = route.request().postDataJSON();
      opnamePayloads.push(body);
      await route.fulfill({ json: { success: true, message: 'Opname berhasil' } });
    });

    const opnameInput = page.locator('#input-opname');
    await opnameInput.fill('15');
    await page.locator('button[title="Tambah Stok"]').click();
    await expect.poll(() => opnamePayloads.length).toBe(1);
    expect(opnamePayloads[0]).toMatchObject({
      action: 'POST_DIRECT',
      inventoryId: '102',
      qtyOpname: 15,
      mode: 'add',
    });

    await opnameInput.fill('30');
    await page.locator('button[title="Set Stok"]').click();
    await expect.poll(() => opnamePayloads.length).toBe(2);
    expect(opnamePayloads[1]).toMatchObject({
      action: 'POST_DIRECT',
      inventoryId: '102',
      qtyOpname: 30,
      mode: 'set',
    });
  });

  test('4. Unified Create Form, Validation Error Preservation & Successful Save', async ({ page }) => {
    await page.locator('button', { hasText: 'Tambah Barang' }).click();

    // Verify single-workspace responsive form sections (no tabs)
    await expect(page.locator('h3', { hasText: 'Tambah Barang Baru' })).toBeVisible();
    await expect(page.locator('text=1. Informasi Dasar Produk')).toBeVisible();
    await expect(page.locator('text=2. Harga Jual Retail & Skema Tier Grosir')).toBeVisible();
    await expect(page.locator('text=3. Harga Modal (HPP) & Pembelian')).toBeVisible();

    const nameInput = page.locator('input[placeholder="Nama Barang Lengkap"]');
    await nameInput.fill('   panci   supra   20cm  ');
    await nameInput.blur();
    // Should normalize extra whitespace on blur
    await expect(nameInput).toHaveValue('panci supra 20cm');

    // Simulate server validation failure first (verify error message is NOT [object Object] and form stays open)
    let shouldFail = true;
    let savedPayload: any = null;
    await page.route('**/api/inventory', async (route) => {
      if (route.request().method() === 'POST') {
        if (shouldFail) {
          await route.fulfill({
            status: 400,
            json: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'SKU sudah terdaftar di database',
              },
            },
          });
        } else {
          savedPayload = route.request().postDataJSON();
          await route.fulfill({
            status: 201,
            json: { success: true, data: { id: 999 } },
          });
        }
      } else {
        await route.continue();
      }
    });

    await page.locator('button', { hasText: 'Simpan Barang' }).click();

    // Error toast shows human-readable message, NOT [object Object]
    await expect(page.locator('span', { hasText: 'Gagal menyimpan: SKU sudah terdaftar di database' })).toBeVisible();
    // Form remains open and preserves user input
    await expect(page.locator('h3', { hasText: 'Tambah Barang Baru' })).toBeVisible();
    await expect(nameInput).toHaveValue('panci supra 20cm');

    // Now succeed on retry
    shouldFail = false;
    await page.locator('button', { hasText: 'Simpan Barang' }).click();
    await expect.poll(() => savedPayload).not.toBeNull();
    expect(savedPayload.inventoryName).toBe('panci supra 20cm');
    await expect(page.locator('h3', { hasText: 'Tambah Barang Baru' })).toBeHidden();
  });

  test('5. Inline Edit, HPP History Toggle & Context Menu (Duplicate, Toggle Status, Delete)', async ({ page }) => {
    const firstRow = page.locator('tbody tr').first();

    // Right-click first row to open context menu
    await firstRow.click({ button: 'right' });
    const contextMenu = page.locator('div.fixed.z-50.w-48');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Detail / Edit Barang' })).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Duplikat Barang' })).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Stok Adjust' })).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Hapus Barang' })).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Set Non-Aktif' })).toBeVisible();

    // Click Duplikat Barang -> must open the inline create form pre-filled with item name and blank SKU
    await contextMenu.locator('button', { hasText: 'Duplikat Barang' }).click();
    await expect(page.locator('h3', { hasText: 'Tambah Barang Baru' })).toBeVisible();
    await expect(page.locator('input[placeholder="Nama Barang Lengkap"]')).toHaveValue('Panci Maspion 24cm');
    await expect(page.locator('input[placeholder="SKU-XXXX"]')).toHaveValue('');

    // Close form via Escape key
    await page.keyboard.press('Escape');
    await expect(page.locator('h3', { hasText: 'Tambah Barang Baru' })).toBeHidden();

    // Open inline Edit via Edit button in row
    await firstRow.locator('button[title="Edit Detail Barang"]').click();
    await expect(page.locator('h3', { hasText: 'Edit Barang: Panci Maspion 24cm' })).toBeVisible();

    // Toggle HPP History inside Edit form
    const historyToggle = page.locator('button', { hasText: /Lihat Riwayat Penerimaan/ });
    await expect(historyToggle).toBeVisible();
    await historyToggle.click();
    await expect(page.locator('td.font-mono', { hasText: 'MR-2026-0001' })).toBeVisible();

    // Close edit form
    await page.locator('button', { hasText: 'Batal' }).click();

    // Test Delete via row button
    let deletedId = '';
    await page.route('**/api/inventory/101', async (route) => {
      if (route.request().method() === 'DELETE') {
        deletedId = '101';
        await route.fulfill({ json: { success: true } });
      } else {
        await route.fulfill({ json: { success: true } });
      }
    });
    page.once('dialog', (dialog) => dialog.accept());
    await firstRow.locator('button[title="Hapus Barang"]').click();
    await expect.poll(() => deletedId).toBe('101');
  });

  test('6. Laporan Stok Modal opens, displays valuation summary, and closes', async ({ page }) => {
    await page.locator('button', { hasText: 'Laporan Stok' }).click();
    await expect(page.locator('h3', { hasText: 'Laporan Mutasi & Saldo Stok Barang' })).toBeVisible();
    await expect(page.getByText('2 Barang', { exact: true })).toBeVisible();
    await expect(page.locator('text=Total Nilai Persediaan (HPP)')).toBeVisible();

    // Close modal via Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('h3', { hasText: 'Laporan Mutasi & Saldo Stok Barang' })).toBeHidden();
  });
});

test.describe('Master Barang E2E Suite (Restricted Non-Admin Role without HPP Permission)', () => {
  test('7. HPP columns and cost inputs are hidden when user lacks view-hpp / canViewPrice', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          user: {
            id: 1,
            username: 'merry',
            fullName: 'Merry Kasir',
            userLevel: 'Kasir',
            isActive: true,
          },
          permissions: [
            { moduleCode: 'master-barang', canView: true, canViewPrice: false },
            { moduleCode: 'view-hpp', canView: false },
          ],
        },
      });
    });

    await page.route('**/api/inventory/lookups', async (route) => {
      await route.fulfill({ json: MOCK_LOOKUPS });
    });

    await page.route('**/api/inventory?*', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: MOCK_PRODUCTS.map((p) => ({ ...p, hpp: 0 })),
          pagination: { total: 2, page: 1, limit: 1000 },
        },
      });
    });

    await page.goto('/');
    await expect(page.locator('input[placeholder*="Cari Barang"]')).toBeVisible();

    // Table header MUST NOT show HPP (Modal)
    await expect(page.locator('thead th', { hasText: 'HPP (Modal)' })).toHaveCount(0);

    // Detail Infobox MUST NOT show HPP Modal
    await expect(page.locator('text=HPP Modal:')).toHaveCount(0);

    // Inline form MUST NOT show Section 3 (Harga Modal / HPP)
    await page.locator('button', { hasText: 'Tambah Barang' }).click();
    await expect(page.locator('text=1. Informasi Dasar Produk')).toBeVisible();
    await expect(page.locator('text=3. Harga Modal (HPP) & Pembelian')).toHaveCount(0);
  });
});

test.describe('Master Barang Real Database & API Integration', () => {
  test('8. Real login and live PostgreSQL inventory query with Minus Stock consistency', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Masukkan username"]', 'admin');
    await page.fill('input[placeholder="••••••••"]', '5555');
    await page.click('button:has-text("Login ke ERP")');

    await expect(page.locator('input[placeholder*="Cari Barang"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15000 });

    // Check Minus filter against real DB and verify displayed Stok Akhir is actually negative
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/inventory') && res.url().includes('minusStock=true')),
      page.locator('label', { hasText: 'Minus' }).click(),
    ]);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    // Every returned item must have stokAkhir < 0
    for (const item of json.data.slice(0, 10)) {
      expect(item.stokAkhir).toBeLessThan(0);
    }
  });
});

