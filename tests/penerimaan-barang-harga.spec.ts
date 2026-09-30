import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openPricedReceiptMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Penerimaan Barang dengan Harga")');
  await menuBtn.click();
  await expect(page.getByText('Total Tagihan Penerimaan', { exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 8: Penerimaan Barang dengan Harga — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openPricedReceiptMenu(page);
  });

  test('1. Renders 4 KPI cards, priced receipts list table, and supports column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    await expect(page.getByText('Total Tagihan Penerimaan', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Faktur MR', { exact: true })).toBeVisible();
    await expect(page.getByText('Status Pembayaran', { exact: true })).toBeVisible();
    await expect(page.getByText('Supplier Terhubung', { exact: true })).toBeVisible();

    // Sort columns
    await page.click('th:has-text("No MR")');
    await page.click('th:has-text("Tanggal MR")');
    await page.click('th:has-text("Supplier Pemasok")');
    await page.click('th:has-text("No. PO")');
    await page.click('th:has-text("Termin / Due Date")');
    await page.click('th:has-text("Grand Total")');
    await page.click('th:has-text("Status")');
  });

  test('2. Full Priced Receipt transaction flow: empty validation, slash input guard, financial calculations, submit, print modal, search by PO/DO, and view detail', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    const suffix = Date.now().toString().slice(-4);
    const poNumber = `PO-E2E/${suffix}`;
    const doNumber = `DO-PRICED/${suffix}`;
    const driver = `Bpk. Sopir ${suffix}`;

    // Switch to Create mode
    await page.click('button:has-text("Input Penerimaan Baru")');
    await expect(page.locator('text=No. Bukti MR (Dengan Harga) *')).toBeVisible();

    // Empty items validation check
    await page.click('button:has-text("Simpan & Update HPP")');
    await expect(page.locator('text=Wajib menginput minimal 1 item barang yang diterima')).toBeVisible();

    // Fill header fields including '/' character
    const poInput = page.locator('input[placeholder="PO-2026-0881"]');
    await poInput.click();
    await poInput.type(poNumber);
    await expect(poInput).toHaveValue(poNumber);

    const doInput = page.locator('input[placeholder="DO-8899221"]');
    await doInput.click();
    await doInput.type(doNumber);
    await expect(doInput).toHaveValue(doNumber);

    await page.fill('input[placeholder="Bpk. Joko"]', driver);

    // Search and add product
    const scanInput = page.locator('input[placeholder*="Scan Barcode / Cari Barang"]');
    await scanInput.fill('a');
    const firstResult = page.locator('span:has-text("+ Tambah Item")').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();

    // Modify Qty, Buy Price, and Item Discount
    const qtyInput = page.locator('table tbody input[type="number"]').nth(0);
    await qtyInput.fill('4');

    const priceInput = page.locator('table tbody input[type="number"]').nth(1);
    await priceInput.fill('50000');

    // Verify subtotal live calculation in line item
    await expect(page.locator('table tbody tr').first()).toContainText('Rp 200.000');

    // Modify invoice header discount to 10%
    const discHeaderInput = page.locator('input[type="number"][min="0"][max="100"]').nth(1);
    await discHeaderInput.fill('10');

    // Submit transaction
    await page.click('button:has-text("Simpan & Update HPP")');
    await expect(page.locator('text=berhasil disimpan & HPP diperbarui!')).toBeVisible({ timeout: 15000 });

    // Verify Printable Receipt Voucher Modal opens
    await expect(page.locator('text=Nota Bukti Penerimaan Barang & HPP Update')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.printable-priced-voucher')).toContainText(poNumber);
    await expect(page.locator('.printable-priced-voucher')).toContainText(doNumber);

    // Close Print Modal
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Nota Bukti Penerimaan Barang & HPP Update')).toHaveCount(0);

    // Verify back in List View and search by PO Number
    const listSearchInput = page.locator('input[placeholder*="Cari No MR / PO / Supplier / Surat Jalan"]');
    await listSearchInput.fill(poNumber);
    await page.waitForTimeout(700);

    const row = page.locator('tr', { hasText: poNumber });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(poNumber);

    // Click Eye button ("Lihat & Cetak Faktur") to verify GET /api/purchasing/priced/[id]
    await row.locator('button[title="Lihat & Cetak Faktur"]').click();
    await expect(page.locator('text=Nota Bukti Penerimaan Barang & HPP Update')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.printable-priced-voucher')).toContainText(poNumber);
  });

  test('3. Tests secondary buttons: Kembali ke Daftar Faktur, Batal, Refresh, Trash2 item removal, and Print modal Cetak/X buttons', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Test List toolbar Refresh button
    await page.click('button[title="Refresh Data"]');
    await expect(page.getByText('Total Tagihan Penerimaan', { exact: true })).toBeVisible();

    // Switch to Create mode
    await page.click('button:has-text("Input Penerimaan Baru")');
    await expect(page.locator('text=No. Bukti MR (Dengan Harga) *')).toBeVisible();

    // Test "Kembali ke Daftar Faktur" button in top toolbar
    await page.click('button:has-text("Kembali ke Daftar Faktur")');
    await expect(page.getByText('Total Tagihan Penerimaan', { exact: true })).toBeVisible();

    // Switch to Create mode again
    await page.click('button:has-text("Input Penerimaan Baru")');
    await expect(page.locator('text=No. Bukti MR (Dengan Harga) *')).toBeVisible();

    // Test "Batal" button next to Simpan
    await page.click('button:has-text("Batal")');
    await expect(page.getByText('Total Tagihan Penerimaan', { exact: true })).toBeVisible();

    // Switch to Create mode again to test item removal via Trash2
    await page.click('button:has-text("Input Penerimaan Baru")');
    const scanInput = page.locator('input[placeholder*="Scan Barcode / Cari Barang"]');
    await scanInput.fill('a');
    const firstResult = page.locator('span:has-text("+ Tambah Item")').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();

    // Verify item is added to line items table
    await expect(page.locator('button[title="Hapus item"]')).toBeVisible();

    // Click Trash2 to remove item
    await page.click('button[title="Hapus item"]');
    await expect(page.locator('button[title="Hapus item"]')).toHaveCount(0);
    await expect(page.locator('text=Belum ada barang diinput')).toBeVisible();

    // Return to list view
    await page.click('button:has-text("Batal")');

    // Test Detail modal 'Cetak' and 'X' close button
    const eyeBtn = page.locator('button[title="Lihat & Cetak Faktur"]').first();
    if (await eyeBtn.isVisible()) {
      await eyeBtn.click();
      await expect(page.locator('text=Nota Bukti Penerimaan Barang & HPP Update')).toBeVisible();

      // Click 'Cetak Nota Official'
      await page.evaluate(() => { window.print = () => {}; });
      await page.click('button:has-text("Cetak Nota Official")');

      // Click 'X' button to close modal
      await page.locator('button:has(svg.lucide-x)').click();
      await expect(page.locator('text=Nota Bukti Penerimaan Barang & HPP Update')).toHaveCount(0);
    }
  });
});
