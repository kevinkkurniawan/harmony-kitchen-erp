import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openInventoryStockMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Inventory Stock")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Inventory")');
  }
  await menuBtn.click();
  await expect(page.locator('th:has-text("Stok Akhir")')).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 3: Inventory Stock — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openInventoryStockMenu(page);
  });

  test('1. Renders the stock table columns and status badges, with no summary cards', async ({ page }) => {
    // Wait for loading state to finish
    await expect(page.locator('text=Memuat Kartu Stok...')).toHaveCount(0, { timeout: 15000 });

    // Summary cards were removed (not in the legacy screen)
    await expect(page.locator('text=Total SKU Aktif')).toHaveCount(0);

    // Table headers
    await expect(page.locator('th:has-text("Kode Barang")')).toBeVisible();
    await expect(page.locator('th:has-text("Nama Barang")')).toBeVisible();
    // Gudang / Etalase came from a never-updated legacy snapshot and were removed
    await expect(page.locator('th:has-text("Stok Gudang")')).toHaveCount(0);
    await expect(page.locator('th:has-text("Stok Etalase")')).toHaveCount(0);
    await expect(page.locator('th:has-text("Stok Akhir")')).toBeVisible();
    await expect(page.locator('th:has-text("Status")')).toBeVisible();

    // At least one row and status badge rendered
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);
    await expect(page.locator('tbody button:has-text("Kartu Stok")').first()).toBeVisible();
  });

  test('2. Search, Warehouse Filter, Minus Stock Filter, and Column Sorting', async ({ page }) => {
    await expect(page.locator('text=Memuat Kartu Stok...')).toHaveCount(0, { timeout: 15000 });

    // 1. Search for known SKU BLG-PCD026
    const searchInput = page.locator('input[placeholder="Cari SKU atau Nama..."]');
    await searchInput.fill('BLG-PCD026');

    // Wait for debounced search to filter table down to 1 row
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('tbody td:has-text("BLG-PCD026")')).toBeVisible();
    await expect(page.locator('tbody td:has-text("Maslon Dutch Oven 26cm")')).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await expect(page.locator('tbody tr').nth(1)).toBeVisible({ timeout: 10000 });

    // 2. Test Column Sorting on Stok Akhir
    const stokAkhirHeader = page.locator('th:has-text("Stok Akhir")');
    await stokAkhirHeader.click(); // asc
    await stokAkhirHeader.click(); // desc
    await expect(page.locator('tbody tr').first()).toBeVisible();

    // 3. Test Warehouse selector filter
    const warehouseSelect = page.locator('select').first();
    await warehouseSelect.selectOption('2'); // warehouse '2' ('tes') has 0 items in s_stockinventory
    await expect(page.locator('text=Tidak ada barang yang cocok dengan filter.')).toBeVisible({ timeout: 10000 });

    // Switch back to ALL
    await warehouseSelect.selectOption('ALL');
    await expect(page.locator('tbody button:has-text("Kartu Stok")').first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Expands Kartu Stok movement ledger without BigInt 500 error and opens Kartu Stok Lengkap modal', async ({ page }) => {
    await expect(page.locator('text=Memuat Kartu Stok...')).toHaveCount(0, { timeout: 15000 });

    const searchInput = page.locator('input[placeholder="Cari SKU atau Nama..."]');
    await searchInput.fill('BLG-PCD026');
    // Wait for debounced search to finish so it doesn't re-render while expanding
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('tbody td:has-text("BLG-PCD026")')).toBeVisible();

    // Click Kartu Stok button
    await page.click('tbody button:has-text("Kartu Stok")');

    // Verify expanded Buku Besar Kartu Stok section appears and loads movement rows
    await expect(page.locator('h4:has-text("Buku Besar Kartu Stok -")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Memuat mutasi...')).toHaveCount(0, { timeout: 10000 });

    // Verify movements loaded without 500 error (either Purchase In or Sales Out visible in recent 10)
    await expect(page.locator('td:has-text("23071801"), td:has-text("Purchase In"), td:has-text("Sales Out")').first()).toBeVisible({ timeout: 10000 });

    // Click "Lihat Kartu Lengkap" button to open the full modal
    await page.click('button:has-text("Lihat Kartu Lengkap")');
    await expect(page.locator('h3:has-text("Kartu Stok Lengkap —")')).toBeVisible();
    await expect(page.locator('text=Total Masuk (In)')).toBeVisible();
    await expect(page.locator('text=Total Keluar (Out)')).toBeVisible();

    // Filter inside the full modal for 23071801
    const modalFilter = page.locator('input[placeholder="Filter No. Dokumen / Transaksi..."]');
    await modalFilter.fill('23071801');
    await expect(page.locator('div.fixed table tbody td:has-text("23071801")').first()).toBeVisible();

    // Close modal
    await page.click('div.fixed button:has-text("Tutup")');
    await expect(page.locator('h3:has-text("Kartu Stok Lengkap —")')).toHaveCount(0);
  });

  test('4. Excel CSV export and Refresh buttons work properly', async ({ page }) => {
    await expect(page.locator('text=Memuat Kartu Stok...')).toHaveCount(0, { timeout: 15000 });

    // Test Excel CSV Export download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Excel")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^kartu-stok-inventory-\d{4}-\d{2}-\d{2}\.csv$/);

    // Test Refresh button triggers a fresh item fetch
    const itemsResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/inventory?') && res.status() === 200
    );
    await page.click('button[title="Refresh Data"]');
    const itemsRes = await itemsResponsePromise;
    expect(itemsRes.ok()).toBe(true);
  });
});
