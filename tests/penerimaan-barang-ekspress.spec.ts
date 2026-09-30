import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openExpressReceiptMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Penerimaan Barang Ekspress")');
  await menuBtn.click();
  await expect(page.getByText('Total Transaksi', { exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 7: Penerimaan Barang Ekspress — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openExpressReceiptMenu(page);
  });

  test('1. Renders 4 KPI cards, express receipts list table, and supports column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    await expect(page.getByText('Total Transaksi', { exact: true })).toBeVisible();
    await expect(page.getByText('Supplier Terhubung', { exact: true })).toBeVisible();
    await expect(page.getByText('Penerimaan Selesai', { exact: true })).toBeVisible();
    await expect(page.getByText('Gudang Utama', { exact: true })).toBeVisible();

    // Sort columns
    await page.click('th:has-text("No MR")');
    await page.click('th:has-text("Tanggal MR")');
    await page.click('th:has-text("Supplier Pemasok")');
    await page.click('th:has-text("No. Surat Jalan (DO)")');
    await page.click('th:has-text("Total Qty Item")');
  });

  test('2. Full Express Receipt transaction flow: empty validation, slash input guard, product search & add, submit, print modal, search by DO/driver, and view detail', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    const suffix = Date.now().toString().slice(-4);
    const doNumber = `DO-E2E/${suffix}`;
    const driver = `Bpk. E2E ${suffix}`;
    const vehicle = `L ${suffix} XY`;

    // Switch to Create mode
    await page.click('button:has-text("Input Penerimaan Baru")');
    await expect(page.locator('text=No. Bukti MR (Ekspress) *')).toBeVisible();

    // Empty items validation check
    await page.click('button:has-text("Simpan & Update Stok")');
    await expect(page.locator('text=Wajib menginput minimal 1 item barang yang diterima')).toBeVisible();

    // Fill header fields including '/' character
    const doInput = page.locator('input[placeholder="DO-8899221"]');
    await doInput.click();
    await doInput.type(doNumber);
    await expect(doInput).toHaveValue(doNumber);

    await page.fill('input[placeholder="Bpk. Joko"]', driver);
    await page.fill('input[placeholder="L 9872 AB"]', vehicle);
    await page.fill('input[placeholder="Dakota Cargo / JTR"]', 'Dakota / JTR');
    await page.fill('input[placeholder="Catatan fisik..."]', 'Kondisi baik / lengkap');

    // Search and add product
    const scanInput = page.locator('input[placeholder*="Scan Barcode / Cari Barang"]');
    await scanInput.fill('a');
    const firstResult = page.locator('span:has-text("+ Tambah Item")').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();

    // Update Qty Masuk to 3 and fill item description
    const qtyInput = page.locator('table tbody input[type="number"]').first();
    await expect(qtyInput).toBeVisible();
    await qtyInput.fill('3');
    await page.fill('input[placeholder="Keterangan fisik item..."]', 'Box utuh / segel');

    // Submit transaction
    await page.click('button:has-text("Simpan & Update Stok")');
    await expect(page.locator('text=berhasil disimpan & stok diperbarui!')).toBeVisible({ timeout: 15000 });

    // Verify Printable Receipt Voucher Modal opens
    await expect(page.locator('text=Bukti Penerimaan Barang Ekspress (Gudang)')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.printable-express-voucher')).toContainText(doNumber);
    await expect(page.locator('.printable-express-voucher')).toContainText(driver);

    // Close Print Modal
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Bukti Penerimaan Barang Ekspress (Gudang)')).toHaveCount(0);

    // Verify back in List View and search by DO Number
    const listSearchInput = page.locator('input[placeholder*="Cari No MR / Supplier / Surat Jalan / Sopir"]');
    await listSearchInput.fill(doNumber);
    await page.waitForTimeout(700);

    const row = page.locator('tr', { hasText: doNumber });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(driver);
    await expect(row).toContainText('3 Items');

    // Click Eye button ("Lihat & Cetak Bukti") to verify GET /api/purchasing/express/[id]
    await row.locator('button[title="Lihat & Cetak Bukti"]').click();
    await expect(page.locator('text=Bukti Penerimaan Barang Ekspress (Gudang)')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.printable-express-voucher')).toContainText(doNumber);
  });

  test('3. Tests secondary buttons: Kembali ke Daftar Transaksi, Batal, Refresh, Trash2 item removal, and Print modal Cetak/X buttons', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Test List toolbar Refresh button
    await page.click('button[title="Refresh Data"]');
    await expect(page.getByText('Total Transaksi', { exact: true })).toBeVisible();

    // Switch to Create mode
    await page.click('button:has-text("Input Penerimaan Baru")');
    await expect(page.locator('text=No. Bukti MR (Ekspress) *')).toBeVisible();

    // Test "Kembali ke Daftar Transaksi" button in top toolbar
    await page.click('button:has-text("Kembali ke Daftar Transaksi")');
    await expect(page.getByText('Total Transaksi', { exact: true })).toBeVisible();

    // Switch to Create mode again
    await page.click('button:has-text("Input Penerimaan Baru")');
    await expect(page.locator('text=No. Bukti MR (Ekspress) *')).toBeVisible();

    // Test "Batal" button next to Simpan
    await page.click('button:has-text("Batal")');
    await expect(page.getByText('Total Transaksi', { exact: true })).toBeVisible();

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
    const eyeBtn = page.locator('button[title="Lihat & Cetak Bukti"]').first();
    if (await eyeBtn.isVisible()) {
      await eyeBtn.click();
      await expect(page.locator('text=Bukti Penerimaan Barang Ekspress (Gudang)')).toBeVisible();

      // Click 'Cetak Surat Jalan Masuk'
      await page.evaluate(() => { window.print = () => {}; });
      await page.click('button:has-text("Cetak Surat Jalan Masuk")');

      // Click 'X' button to close modal
      await page.locator('button:has(svg.lucide-x)').click();
      await expect(page.locator('text=Bukti Penerimaan Barang Ekspress (Gudang)')).toHaveCount(0);
    }
  });
});
