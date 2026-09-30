import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openBarcodePrintMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Cetak Barcode")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Master Data")');
  }
  await menuBtn.click();
  await expect(page.locator('h2:has-text("Generator & Cetak Barcode Label (3 Kolom / Baris)")')).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 4: Cetak Barcode — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openBarcodePrintMenu(page);
  });

  test('1. 3-Column Row Layout: 1 label uses Col 1, 2 labels use Col 1-2, 3 labels fill Row 1, 4 labels wrap to Row 2 Col 1', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Cari barang untuk dicetak barcode"]');
    await searchInput.fill('BLG-PCD026');

    const dropdownItem = page.locator('text=Maslon Dutch Oven 26cm').first();
    await expect(dropdownItem).toBeVisible({ timeout: 10000 });
    await dropdownItem.click();

    // Case 1: 1 label -> Row 1: Col 1 filled, Col 2 & Col 3 empty
    await expect(page.getByTestId('barcode-preview-row-0')).toBeVisible();
    await expect(page.getByTestId('barcode-preview-row-1')).toHaveCount(0);
    await expect(page.getByTestId('barcode-preview-cell-0-0')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('barcode-preview-cell-0-1')).toHaveAttribute('data-filled', 'false');
    await expect(page.getByTestId('barcode-preview-cell-0-2')).toHaveAttribute('data-filled', 'false');

    // Case 2: 2 labels -> Row 1: Col 1 & Col 2 filled, Col 3 empty
    await page.click('tbody button:has-text("+")');
    await expect(page.getByTestId('barcode-preview-row-1')).toHaveCount(0);
    await expect(page.getByTestId('barcode-preview-cell-0-0')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('barcode-preview-cell-0-1')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('barcode-preview-cell-0-2')).toHaveAttribute('data-filled', 'false');

    // Case 3: 3 labels -> Row 1: Col 1, Col 2, Col 3 all filled
    await page.click('tbody button:has-text("+")');
    await expect(page.getByTestId('barcode-preview-row-1')).toHaveCount(0);
    await expect(page.getByTestId('barcode-preview-cell-0-0')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('barcode-preview-cell-0-1')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('barcode-preview-cell-0-2')).toHaveAttribute('data-filled', 'true');

    // Case 4: 4 labels -> Row 1 full (3 cols), Row 2 has Col 1 filled and Col 2 & 3 empty
    await page.click('tbody button:has-text("+")');
    await expect(page.getByTestId('barcode-preview-row-1')).toBeVisible();
    await expect(page.getByTestId('barcode-preview-cell-1-0')).toHaveAttribute('data-filled', 'true');
    await expect(page.getByTestId('barcode-preview-cell-1-1')).toHaveAttribute('data-filled', 'false');
    await expect(page.getByTestId('barcode-preview-cell-1-2')).toHaveAttribute('data-filled', 'false');

    // Verify hidden #print-label-area DOM has 2 .barcode-label-row elements and 6 .barcode-label-cell elements
    await expect(page.locator('#print-label-area .barcode-label-row')).toHaveCount(2);
    await expect(page.locator('#print-label-area .barcode-label-cell')).toHaveCount(6);
  });

  test('2. Search empty state, Enter key scanner addition, and quantity input resilience', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Cari barang untuk dicetak barcode"]');

    // Search for non-existent item -> shows empty state
    await searchInput.fill('ZZZZNONEXISTENT99999');
    await expect(page.locator('text=Barang tidak ditemukan untuk kata kunci')).toBeVisible({ timeout: 10000 });

    // Search for valid SKU and press Enter to add
    await searchInput.fill('BLG-PCD026');
    await expect(page.locator('text=Maslon Dutch Oven 26cm').first()).toBeVisible({ timeout: 10000 });
    await searchInput.press('Enter');

    // Item is in queue table
    await expect(page.locator('tbody tr')).toHaveCount(1);
    const qtyInput = page.locator('tbody input[type="number"]');
    await expect(qtyInput).toHaveValue('1');

    // Clearing or typing a new number does NOT delete the row
    await qtyInput.fill('5');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByTestId('barcode-preview-row-0')).toBeVisible();
    await expect(page.getByTestId('barcode-preview-row-1')).toBeVisible();
  });

  test('3. Toggle Sertakan Harga & Header Toko, Print Audit API call, and Kosongkan Antrian', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Cari barang untuk dicetak barcode"]');
    await searchInput.fill('BLG-PCD026');
    await expect(page.locator('text=Maslon Dutch Oven 26cm').first()).toBeVisible({ timeout: 10000 });
    await searchInput.press('Enter');

    const cell0 = page.getByTestId('barcode-preview-cell-0-0');
    await expect(cell0).toContainText('HARMONY KITCHEN');
    await expect(cell0).toContainText('Rp ');

    // Toggle Header Toko off
    await page.click('label:has-text("Header Toko")');
    await expect(cell0).not.toContainText('HARMONY KITCHEN');

    // Toggle Sertakan Harga off
    await page.click('label:has-text("Sertakan Harga")');
    await expect(cell0).not.toContainText('Rp ');

    // Intercept window.print and verify POST /api/barcode/print
    await page.evaluate(() => {
      (window as any).__printCalled = false;
      window.print = () => {
        (window as any).__printCalled = true;
      };
    });

    const printApiPromise = page.waitForResponse(
      (res) => res.url().includes('/api/barcode/print') && res.request().method() === 'POST'
    );
    await page.click('button:has-text("Cetak 1 Label")');
    const printRes = await printApiPromise;
    expect(printRes.status()).toBe(200);
    const printCalled = await page.evaluate(() => (window as any).__printCalled);
    expect(printCalled).toBe(true);

    // Kosongkan Antrian
    await page.click('button:has-text("Kosongkan Antrian")');
    await expect(page.locator('text=Belum ada barang di antrian cetak.')).toBeVisible();
  });
});
