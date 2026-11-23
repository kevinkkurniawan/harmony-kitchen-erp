import { test, expect, type Page } from '@playwright/test';

// Konfirmasi Stok (client, 23 Nov), mocked: no request reaches the database.
const ITEM = { id: 77, barcode: '8990001112223', inventoryNo: 'HK-077', inventoryName: 'Panci Uji 20cm', lastSync: null };

async function mockSession(page: Page, userLevel: 'Admin' | 'Staff', username = userLevel === 'Admin' ? 'admin' : 'siti') {
  await page.route('**/api/auth/session', (route) => route.fulfill({
    json: {
      success: true,
      user: { id: 9, username, fullName: username, userLevel, isActive: true },
      // Staff with only the new tab ticked
      permissions: userLevel === 'Admin' ? [] : [
        'master-barang', 'inventory-stok', 'stok-opname', 'cetak-barcode', 'master-promo', 'master-supplier',
        'penerimaan-barang', 'penerimaan-barang-harga', 'sales-monitoring', 'laporan-penjualan',
      ].map((moduleCode) => ({ moduleCode, canView: false })).concat({ moduleCode: 'konfirmasi-stok', canView: true }),
    },
  }));
}

test.describe('Konfirmasi Stok (mocked)', () => {
  test('1. Staff sees only the new tab, counts blind, match confirms and mismatch is refused', async ({ page }) => {
    await mockSession(page, 'Staff');
    const posts: unknown[] = [];
    const log: object[] = [];
    await page.route('**/api/inventory/stock-confirm?*', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('log') === '1') return route.fulfill({ json: { success: true, data: log } });
      return route.fulfill({ json: { success: true, data: [ITEM] } });
    });
    await page.route('**/api/inventory/stock-confirm', async (route) => {
      const body = route.request().postDataJSON();
      posts.push(body);
      const match = body.qty === 12;
      log.unshift({ ...ITEM, id: String(log.length), time: new Date().toISOString(), user: 'siti', countedQty: body.qty, systemQty: null, match });
      return match
        ? route.fulfill({ json: { success: true, data: { ...ITEM, noTransaction: 'SCO-2611231' } } })
        : route.fulfill({ status: 409, json: { success: false, error: { code: 'STOCK_MISMATCH', message: 'Stok tidak sama dengan sistem. Hubungi admin.' } } });
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Konfirmasi Stok', exact: true })).toBeVisible();
    for (const hidden of ['Stok Opname', 'Inventory Stock', 'Master Barang']) {
      await expect(page.getByRole('button', { name: hidden, exact: true })).toHaveCount(0);
    }

    // Scan: Enter takes the exact barcode match; no system stock anywhere on screen
    const scan = page.getByPlaceholder('Scan barcode atau ketik nama barang');
    await scan.fill(ITEM.barcode);
    await scan.press('Enter');
    await expect(page.getByText(ITEM.inventoryName)).toBeVisible();
    // A scanner's Enter moves the cursor to Qty Hitung, so the count is not typed into the scan box
    await expect(page.getByRole('textbox', { name: 'Qty Hitung', exact: true })).toBeFocused();
    await expect(page.getByText(/Stok Sistem/)).toHaveCount(0);

    await page.getByRole('textbox', { name: 'Qty Hitung', exact: true }).fill('10');
    await page.getByRole('button', { name: 'Konfirmasi', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Stok tidak sama dengan sistem. Hubungi admin.');
    await expect(page.getByText('Tidak Sama', { exact: true })).toBeVisible();

    await page.getByRole('textbox', { name: 'Qty Hitung', exact: true }).fill('12');
    await page.getByRole('button', { name: 'Konfirmasi', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('stok sesuai, berhasil dikonfirmasi');
    await expect(page.getByText('Sesuai', { exact: true })).toBeVisible();
    expect(posts).toEqual([{ inventoryId: 77, qty: 10 }, { inventoryId: 77, qty: 12 }]);
    await expect(page.getByText('Hari ini: 2 konfirmasi, 1 tidak sama')).toBeVisible();
  });

  test('2. The owner (admin login) sees every user and the system stock in the list', async ({ page }) => {
    await mockSession(page, 'Admin');
    await page.route('**/api/inventory?*', (route) => route.fulfill({ json: { success: true, data: [], pagination: { total: 0, page: 1, limit: 100 } } }));
    await page.route('**/api/inventory/lookups', (route) => route.fulfill({ json: { success: true, data: { promoBundles: [] } } }));
    await page.route('**/api/inventory/stock-confirm?*', (route) => route.fulfill({
      json: { success: true, data: [{ ...ITEM, id: '1', time: new Date().toISOString(), user: 'siti', countedQty: 10, systemQty: 12, match: false }] },
    }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Konfirmasi Stok', exact: true }).click();
    await expect(page.getByText('.:: Konfirmasi Hari Ini (semua user) ::.')).toBeVisible();
    const row = page.locator('tbody tr', { hasText: ITEM.inventoryName });
    await expect(row).toContainText('siti');
    await expect(row).toContainText(ITEM.barcode);
    await expect(row).toContainText('12');
    await expect(row).toContainText('Tidak Sama');
  });

  test('3. Another Admin (User Type Admin, not the owner) counts blind and cannot open Stok Opname', async ({ page }) => {
    await mockSession(page, 'Admin', 'siti');
    await page.route('**/api/inventory?*', (route) => route.fulfill({ json: { success: true, data: [], pagination: { total: 0, page: 1, limit: 100 } } }));
    await page.route('**/api/inventory/lookups', (route) => route.fulfill({ json: { success: true, data: { promoBundles: [] } } }));
    await page.route('**/api/inventory/stock-confirm?*', (route) => route.fulfill({ json: { success: true, data: [] } }));
    await page.goto('/');
    await page.getByRole('button', { name: 'Konfirmasi Stok', exact: true }).click();
    await expect(page.getByText('.:: Konfirmasi Saya Hari Ini ::.')).toBeVisible();
    await expect(page.getByText('Stok Sistem')).toHaveCount(0);
    await page.getByRole('button', { name: 'Stok Opname', exact: true }).click();
    await expect(page.getByText('Stock opname hanya untuk akun admin (owner).', { exact: true })).toBeVisible();
  });
});
