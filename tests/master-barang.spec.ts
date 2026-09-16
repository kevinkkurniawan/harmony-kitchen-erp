import { test, expect } from '@playwright/test';

test.describe('Master Barang Strict Parity UI & Functional Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the inventory data so we have a row to right-click
    await page.route('**/api/inventory*', async (route) => {
      const mockData = {
        success: true,
        data: [
          {
            id: 1,
            inventoryNo: 'INV001',
            barcode: '123456789',
            inventoryName: 'Barang Dummy Test',
            brand: { brandName: 'Brand A' },
            category: { categoryName: 'Cat A' },
            productType: { productName: 'Prod A' },
            uom: { uomName: 'PCS' },
            price: 10000,
            hpp: 5000,
            grosir1: 9500,
            grosir2: 9000,
            grosir3: 8500,
            minStock: 10,
            maxStock: 100,
            stokAkhir: 50,
            isActive: true,
          },
        ],
        pagination: { total: 1, page: 1, limit: 1000 },
      };
      await route.fulfill({ json: mockData });
    });

    // Navigate to the root page (which shows login)
    await page.goto('/');
    
    // Login
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', '123');
    await page.click('button:has-text("Login ke ERP")');

    // Wait for the data table to load on the dashboard
    await expect(page.locator('input[placeholder*="Cari Barang"]')).toBeVisible();
  });

  test('Toolbar buttons exist and use correct terminology', async ({ page }) => {
    // Verify toolbar buttons
    await expect(page.locator('button', { hasText: 'Tambah Barang' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Show Detail' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Laporan Stok' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Refresh' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'List Barcode' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Export Data' })).toBeVisible();
    
    // Verify checkboxes
    await expect(page.locator('label', { hasText: 'Barang Aktif' })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Stok Minus' })).toBeVisible();
  });

  test('Data Table headers use legacy terminology', async ({ page }) => {
    const tableHeaders = page.locator('th');
    await expect(tableHeaders.filter({ hasText: 'Inventory No' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Barcode' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Nama Barang' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Brand' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Category' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Product' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'UoM' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Price (Retail)' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'HPP (Modal)' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Grosir 1' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Min/Max' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Stok Akhir' })).toBeVisible();
    await expect(tableHeaders.filter({ hasText: 'Status' })).toBeVisible();
  });

  test('Context Menu overlay opens and uses correct terminology without ampersands', async ({ page }) => {
    // Wait for at least one table row to appear
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();

    // Right click the first row
    await firstRow.click({ button: 'right' });

    // Verify context menu appears
    const contextMenu = page.locator('div.fixed.z-50.w-48');
    await expect(contextMenu).toBeVisible();

    // Verify context menu terminology (no ampersands)
    await expect(contextMenu.locator('button', { hasText: 'Detail / Edit Barang' })).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Stok Opname' })).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Cetak Barcode' })).toBeVisible();
    await expect(contextMenu.locator('button', { hasText: 'Hapus Barang' })).toBeVisible();

    // Test that clicking a row button closes context menu (bug fix verification)
    await contextMenu.locator('button', { hasText: 'Stok Opname' }).click();
    
    // Opname modal should appear
    await expect(page.locator('h3', { hasText: 'Input Qty Stok Opname' })).toBeVisible();
    
    // Context menu should be gone
    await expect(contextMenu).toBeHidden();
  });

  test('Tambah Barang modal opens and cancel button works without submitting', async ({ page }) => {
    // Click Tambah Barang
    await page.locator('button', { hasText: 'Tambah Barang' }).click();
    
    // Modal should appear
    const modal = page.locator('div.fixed.inset-0').first();
    await expect(modal).toBeVisible();

    // Verify legacy tabs structure
    await expect(modal.locator('button', { hasText: 'Informasi Umum' })).toBeVisible();
    await expect(modal.locator('button', { hasText: 'Harga & Grosir' })).toBeVisible();
    // Click Batal
    await modal.locator('button', { hasText: 'Batal' }).click();

    // Modal should close without errors or page reloads (if it submitted, the page might show toast errors or reload depending on setup)
    await expect(modal).toBeHidden();
  });

  test('Show Detail pane can be toggled', async ({ page }) => {
    // By default it might be visible or hidden depending on state, let's assume it's visible based on code
    const detailPane = page.locator('h4', { hasText: 'Detail Infobox' });
    
    // Close it using the toolbar button
    await page.locator('button', { hasText: 'Show Detail' }).click();
    
    // Toggle again
    await page.locator('button', { hasText: 'Show Detail' }).click();
    
    // Click on a row to populate detail pane
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();
    
    await expect(detailPane).toBeVisible();
    
    // Verify the 5 sections exist
    await expect(page.locator('div', { hasText: 'SKU / Barcode' }).first()).toBeVisible();
    await expect(page.locator('div', { hasText: 'Kategori / Brand' }).first()).toBeVisible();
    await expect(page.locator('div', { hasText: 'Harga Retail & HPP' }).first()).toBeVisible();
    await expect(page.locator('div', { hasText: 'Tier Harga Grosir' }).first()).toBeVisible();
    await expect(page.locator('div', { hasText: 'Status Balance Stok' }).first()).toBeVisible();
  });
});
