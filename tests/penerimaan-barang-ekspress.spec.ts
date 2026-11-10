import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openExpressReceiptMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Penerimaan Barang Ekspress")');
  await menuBtn.click();
  await expect(page.getByText('No. Nota Penerimaan', { exact: true })).toBeVisible({ timeout: 10000 });
}

// Legacy Frm_PurchaseReceivementNoPrice: list group and ">> Detail Nota Penerimaan" group in one window
test.describe('Menu 7: Penerimaan Barang Ekspress — legacy layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openExpressReceiptMenu(page);
  });

  test('1. Shows the old window, groups, fields and list columns; new-only columns are gone', async ({ page }) => {
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });

    await expect(page.getByText('Penerimaan Barang', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('>> Detail Nota Penerimaan', { exact: true })).toBeVisible();
    for (const label of ['Tgl. Awal :', 'Tgl. Akhir :', 'Search :', 'No. Order :', 'Tanggal :', 'Gudang :', 'Keterangan :', 'Supplier :', 'Alamat Supp. :', 'Kota Supp. :']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Input Nota', exact: true })).toBeVisible();
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();

    const listHead = page.locator('table thead').first();
    for (const caption of ['MR No', 'MR Date', 'Supplier', 'Keterangan']) {
      await expect(listHead.getByText(caption, { exact: true })).toBeVisible();
    }
    const detailHead = page.locator('table thead').nth(1);
    for (const caption of ['Barang', 'Qty', 'Description']) {
      await expect(detailHead.getByText(caption, { exact: true })).toBeVisible();
    }

    // Removed new-only inputs / columns
    for (const gone of ['No. Surat Jalan (DO)', 'Sopir / Vehicle', 'Total Qty Item', 'Transporter / Ekspedisi', 'Nama Sopir / Driver']) {
      await expect(page.getByText(gone)).toHaveCount(0);
    }

    // Sortable list headers
    await listHead.getByText('MR No', { exact: true }).click();
    await listHead.getByText('MR Date', { exact: true }).click();
  });

  test('2. Input Nota flow: empty validation, "#" qty + search add, save, then the receipt shows read-only', async ({ page }) => {
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const suffix = Date.now().toString().slice(-4);
    const note = `E2E ekspress / ${suffix}`;

    await page.getByRole('button', { name: 'New', exact: true }).click();

    // Empty items validation
    await page.getByRole('button', { name: 'Input Nota', exact: true }).click();
    await expect(page.getByText('Wajib menginput minimal 1 item barang yang diterima')).toBeVisible();

    // Keterangan accepts "/" (the "/" shortcut must not steal it)
    const detail = page.locator('section', { hasText: '>> Detail Nota Penerimaan' });
    const keterangan = detail.locator('label', { hasText: 'Keterangan :' }).locator('input');
    await keterangan.click();
    await keterangan.type(note);
    await expect(keterangan).toHaveValue(note);

    // "#" qty 3, then pick the first search result
    await page.getByLabel('Qty', { exact: true }).fill('3');
    await page.locator('input[placeholder*="Scan Barcode / Cari Barang"]').fill('a');
    const firstResult = page.locator('div.cursor-pointer:has(div.font-mono)').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
    await expect(page.locator('table tbody input[type="number"]').first()).toHaveValue('3');

    // Clearing the line qty and typing 5 gives 5 (it used to snap to 1 and become 15); an empty box reverts on blur
    const lineQty = page.locator('table tbody input[type="number"]').first();
    await lineQty.fill('');
    await lineQty.pressSequentially('5');
    await expect(lineQty).toHaveValue('5');
    await lineQty.fill('');
    await lineQty.blur();
    await expect(lineQty).toHaveValue('5');

    await page.getByRole('button', { name: 'Input Nota', exact: true }).click();
    await expect(page.getByText('berhasil disimpan & stok diperbarui!')).toBeVisible({ timeout: 15000 });

    // Saved receipt shows read-only in the detail group (no print modal)
    await expect(page.getByRole('button', { name: 'Input Nota', exact: true })).toHaveCount(0);
    await expect(keterangan).toHaveValue(note);

    // The list finds it by search and loads it on click
    await page.locator('label', { hasText: 'Search :' }).locator('input').fill(suffix);
    const row = page.locator('tr', { hasText: note });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
  });

  test('3. Right-click "Hapus" removes an item; New asks before discarding typed items', async ({ page }) => {
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await page.getByRole('button', { name: 'New', exact: true }).click();

    await page.locator('input[placeholder*="Scan Barcode / Cari Barang"]').fill('a');
    const firstResult = page.locator('div.cursor-pointer:has(div.font-mono)').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();

    // New with unsaved items asks first; cancelling keeps them
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.getByText('Barang yang sudah diinput belum disimpan. Buang input ini?')).toBeVisible();
    await page.getByRole('button', { name: 'Batal' }).click();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();

    // Right-click menu on the item row
    await page.locator('table').nth(1).locator('tbody tr').first().click({ button: 'right' });
    await page.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByText('Belum ada barang diinput')).toBeVisible();
  });

  test('4. Old functions: Terbayar toggle, Daily Report, Tambah / Refresh Supplier, Recreate Invoice', async ({ page }) => {
    test.setTimeout(120000);
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const suffix = Date.now().toString().slice(-5);
    const note = `E2E eks oldfn / ${suffix}`;
    const supplierName = `E2E Supplier ${suffix}`;
    const detail = page.locator('section', { hasText: '>> Detail Nota Penerimaan' });

    // "Tambah Supplier" (old Input Supplier window): AUTO code, saved supplier becomes the chosen one
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByRole('button', { name: 'Tambah Supplier', exact: true }).click();
    const dlg = page.getByRole('dialog', { name: 'Input Supplier' });
    for (const label of ['Sup. Code :', 'Sup. Name :', 'Alamat :', 'Kota :', 'No. Telp :', 'No. HP :']) {
      await expect(dlg.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(dlg.locator('label', { hasText: 'Sup. Code :' }).locator('input')).toHaveValue('AUTO');
    await dlg.locator('label', { hasText: 'Sup. Name :' }).locator('input').fill(supplierName);
    await dlg.locator('label', { hasText: 'Kota :' }).locator('input').fill('Kota E2E');
    await dlg.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText('Success On Save Supplier')).toBeVisible({ timeout: 15000 });
    const supplierSelect = detail.locator('label', { hasText: 'Supplier :' }).locator('select');
    await expect(supplierSelect.locator('option:checked')).toContainText(supplierName, { timeout: 10000 });
    await expect(detail.locator('label', { hasText: 'Kota Supp. :' }).locator('input')).toHaveValue('Kota E2E');

    // "Refresh Supplier" reloads the list and keeps the choice
    await page.getByRole('button', { name: 'Refresh Supplier', exact: true }).click();
    await expect(supplierSelect.locator('option:checked')).toContainText(supplierName);

    // Save a receipt dated yesterday, so "Recreate Invoice" (same date) differs from "New" (today)
    const tanggal = detail.locator('label', { hasText: 'Tanggal :' }).locator('input');
    const today = await tanggal.inputValue();
    const y = new Date(`${today}T00:00:00Z`);
    y.setUTCDate(y.getUTCDate() - 1);
    const yesterday = y.toISOString().slice(0, 10);
    await tanggal.fill(yesterday);
    await detail.locator('label', { hasText: 'Keterangan :' }).locator('input').fill(note);
    await page.locator('input[placeholder*="Scan Barcode / Cari Barang"]').fill('a');
    const firstResult = page.locator('div.cursor-pointer:has(div.font-mono)').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();
    await page.getByRole('button', { name: 'Input Nota', exact: true }).click();
    await expect(page.getByText('berhasil disimpan & stok diperbarui!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Tambah Supplier', exact: true })).toBeDisabled();

    await page.getByRole('button', { name: 'Recreate Invoice', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Input Nota', exact: true })).toBeVisible();
    await expect(tanggal).toHaveValue(yesterday);
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recreate Invoice', exact: true })).toHaveCount(0);

    // "Belum Terbayar" (default) lists the unpaid express receipt; "Terbayar" does not
    const search = page.locator('label', { hasText: 'Search :' }).locator('input');
    await search.fill(suffix);
    const row = page.locator('tr', { hasText: note });
    await expect(row).toBeVisible({ timeout: 10000 });
    const toggle = page.getByRole('switch', { name: 'Terbayar' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByText('Belum Terbayar', { exact: true })).toBeVisible();
    await toggle.click();
    await expect(page.getByText('Terbayar', { exact: true })).toBeVisible();
    await expect(row).toHaveCount(0, { timeout: 10000 });
    await toggle.click();
    await expect(row).toBeVisible({ timeout: 10000 });

    // "Daily Report" (old Rpt_PReceivement_SummaryCashier): today's receipts with Nama Barang | Qty | Harga | Sub Total
    await page.getByRole('button', { name: 'Daily Report', exact: true }).click();
    const report = page.locator('.printable-daily-report');
    await expect(report).toContainText('Laporan Penerimaan Barang');
    await expect(report.getByText('Memuat data...')).toHaveCount(0, { timeout: 10000 });
    const anyReceipt = report.locator('[data-mrno]').first();
    if (await anyReceipt.count()) {
      for (const caption of ['No. Penerimaan :', 'Supplier :', 'Nama Barang', 'Qty', 'Harga', 'Sub Total']) {
        await expect(anyReceipt.getByText(caption, { exact: true })).toBeVisible();
      }
    }
    // The receipt dated yesterday is not in today's report, but "Tanggal :" set to yesterday shows it
    // (this report prints no Keterangan, so it is found by its new supplier)
    await expect(report).not.toContainText(supplierName);
    await page.getByLabel('Tanggal Daily Report').fill(yesterday);
    await expect(report).toContainText(supplierName, { timeout: 10000 });
    await page.getByRole('dialog', { name: 'Daily Report' }).getByRole('button', { name: 'Tutup' }).click();
    await expect(report).toHaveCount(0);
  });
});
