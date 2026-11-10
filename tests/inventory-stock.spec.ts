import { test, expect, type Page } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', username);
  await page.fill('input[placeholder="••••••••"]', password);
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

const N0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

async function openInventoryStockMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Inventory Stock")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Master Data")');
  }
  await menuBtn.click();
  await expect(page.locator('th:has-text("Stok Terbaru")')).toBeVisible({ timeout: 10000 });
}

// Legacy Frm_InventoryStock (" Sync Stok dan Laporan")
test.describe('Menu 3: Inventory Stock — legacy Sync Stok dan Laporan', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openInventoryStockMenu(page);
  });

  test('1. Renders the legacy title, columns in order and the .:: Detail group', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByText('Sync Stok dan Laporan', { exact: true })).toBeVisible();

    // Legacy GV_Header columns, in order (admin sees HPP and Total)
    const headers = page.locator('main table').first().locator('thead tr').first().locator('th');
    await expect(headers).toHaveText(['No', 'PLU', 'Barcode', 'Nama Barang', 'Price', 'HPP', 'Total', 'Stok Terbaru', '=>', 'Last Sync']);

    // New-only UI was removed: status badges, warehouse selector, minus filter, Excel / Cetak
    await expect(page.locator('th:has-text("Status")')).toHaveCount(0);
    await expect(page.locator('th:has-text("Stok Gudang")')).toHaveCount(0);
    await expect(page.locator('text=Semua Gudang & Lokasi')).toHaveCount(0);
    await expect(page.locator('text=Tampilkan Stok Minus')).toHaveCount(0);
    await expect(page.locator('button:has-text("Excel")')).toHaveCount(0);

    // The .:: Detail group appears only once an item is opened with "=>"
    await expect(page.getByText('.:: Detail', { exact: true })).toHaveCount(0);
    await page.locator('button[title="Detail"]').first().click();
    await expect(page.getByText('.:: Detail', { exact: true })).toBeVisible();
  });

  test('2. Search and server-side column sorting', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const grid = page.locator('main table').first();

    const searchInput = page.locator('input[placeholder="Enter text to search..."]');
    await searchInput.fill('BLG-PCD026');
    await expect(grid.locator('tbody tr')).toHaveCount(1, { timeout: 10000 });
    await expect(grid.locator('tbody td:has-text("BLG-PCD026")')).toBeVisible();
    await expect(grid.locator('tbody td:has-text("Maslon Dutch Oven 26cm")')).toBeVisible();

    await searchInput.fill('');
    await expect(grid.locator('tbody tr').nth(1)).toBeVisible({ timeout: 10000 });

    // Sorting is sent to the API (whole catalog, not one page)
    const sortResponse = page.waitForResponse((res) => res.url().includes('/api/inventory?') && res.url().includes('sort=stokAkhir'));
    await grid.locator('th:has-text("Stok Terbaru")').click();
    expect((await sortResponse).ok()).toBe(true);
  });

  test('3. "=>" opens the item in .:: Detail with the monthly summary and the stock card', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const grid = page.locator('main table').first();

    await page.locator('input[placeholder="Enter text to search..."]').fill('BLG-PCD026');
    await expect(grid.locator('tbody tr')).toHaveCount(1, { timeout: 10000 });

    const movementResponse = page.waitForResponse((res) => res.url().includes('/movement'));
    await grid.locator('button[title="Detail"]').click();
    expect((await movementResponse).ok()).toBe(true);

    // Monthly summary (Tahun / Bulan / Qty Transaksi) and the ledger (client doc item 5)
    await expect(page.locator('th:has-text("Qty Transaksi")')).toBeVisible();
    await expect(page.locator('th:has-text("Tgl. Transaksi")')).toBeVisible();
    await expect(page.locator('th:has-text("Saldo Akhir")')).toBeVisible();
    await expect(page.locator('text=Terakhir opname:')).toBeVisible();
    await expect(page.locator('td:has-text("23071801")').first()).toBeVisible({ timeout: 10000 });
  });

  test('5. Laporan Stok Akhir: toolbar button after Refresh, report of every active item with the legacy sums', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });

    // Legacy toolbar order: Refresh, then "Laporan Stok Akhir"; the hidden "Tampilkan Stok Tidak Sama" and Sync stay out
    const toolbarButtons = page.locator('main button').filter({ hasText: /^(Refresh|Laporan Stok Akhir)$/ });
    await expect(toolbarButtons).toHaveText(['Refresh', 'Laporan Stok Akhir']);
    await expect(page.locator('text=Tampilkan Stok Tidak Sama')).toHaveCount(0);
    await expect(page.locator('th', { hasText: /^Sync$/ })).toHaveCount(0);

    // Expected sums straight from the API totals over the same list (active items)
    const totalsJson = await (await page.request.get('/api/inventory?onlyActive=true&totals=true&limit=1')).json();
    expect(totalsJson.success).toBe(true);

    await page.getByRole('button', { name: 'Laporan Stok Akhir', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Laporan Stok Akhir' });
    await expect(dialog.locator('thead th')).toHaveText(['PLU', 'Barcode', 'Nama Barang', 'H. Jual', 'Stok', 'IN HPP', 'IN H. Jual']);
    await expect(dialog.locator('tbody tr')).toHaveCount(totalsJson.pagination.total, { timeout: 60000 });

    const footer = dialog.locator('tfoot td');
    await expect(footer.nth(4)).toHaveText(N0.format(totalsJson.totals.stock));
    await expect(footer.nth(6)).toHaveText(N0.format(totalsJson.totals.retailValue));

    await dialog.getByTitle('Close').click();
    await expect(dialog).toHaveCount(0);
  });

  test('4. Refresh reloads the list', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const itemsResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/inventory?') && res.status() === 200
    );
    await page.click('button:has-text("Refresh")');
    expect((await itemsResponsePromise).ok()).toBe(true);
  });
});

// HPP stays Admin-only in the report (server sends hpp 0 and the column is not rendered)
test.describe('Menu 3: Inventory Stock — non-admin', () => {
  test('6. Laporan Stok Akhir without IN HPP for a non-admin', async ({ page }) => {
    const staffUser = process.env.E2E_STAFF_USER;
    const staffPassword = process.env.E2E_STAFF_PASSWORD;
    test.skip(!staffUser || !staffPassword, 'Set E2E_STAFF_USER and E2E_STAFF_PASSWORD to a non-admin login');
    await loginAs(page, staffUser!, staffPassword!);
    await openInventoryStockMenu(page);

    await page.getByRole('button', { name: 'Laporan Stok Akhir', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Laporan Stok Akhir' });
    await expect(dialog.locator('thead th')).toHaveText(['PLU', 'Barcode', 'Nama Barang', 'H. Jual', 'Stok', 'IN H. Jual']);
    await expect(dialog.locator('tbody tr').first()).toBeVisible({ timeout: 60000 });
  });
});
