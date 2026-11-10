import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openPricedReceiptMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Penerimaan Barang dengan Harga")');
  await menuBtn.click();
  await expect(page.getByText('Date Start', { exact: true })).toBeVisible({ timeout: 10000 });
}

// Legacy Frm_PurchaseReceivement: list view, and the detail view in the same window ("Back")
test.describe('Menu 8: Penerimaan Barang dengan Harga — legacy layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openPricedReceiptMenu(page);
  });

  test('1. List view shows the old filters and columns; new-only columns are gone', async ({ page }) => {
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });

    await expect(page.getByText('Date End', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible();

    const head = page.locator('table thead').first();
    for (const caption of ['MR No', 'MR Date', 'Supplier', 'Keterangan', 'Jatuh Tempo', 'GrandTotal']) {
      await expect(head.getByText(caption, { exact: true })).toBeVisible();
      await head.getByText(caption, { exact: true }).click(); // sortable
    }
    for (const gone of ['No. PO', 'Termin / Due Date', 'Status', 'Total Tagihan Penerimaan']) {
      await expect(head.getByText(gone, { exact: true })).toHaveCount(0);
    }
  });

  test('2. New receipt: validation, "#" qty + search add, line subtotal, totals group, save, print voucher, read-only detail', async ({ page }) => {
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const suffix = Date.now().toString().slice(-4);
    const note = `E2E harga / ${suffix}`;

    await page.getByRole('button', { name: 'New', exact: true }).click();
    for (const label of ['No. Order :', 'Tanggal :', 'Gudang :', 'Keterangan :', 'Pembayaran :', 'Supplier :', 'Alamat Supp. :', 'Kota Supp. :',
      'Sub Total :', 'Diskon :', 'PPn :', 'Total Keseluruhan :', 'Uang Muka :', 'Saldo Terhutang :', 'Lama Termin :', 'Hari', 'Multi Disc']) {
      // "Diskon :" is both the discount input row and the totals row, as in the old form
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    const itemHead = page.locator('table thead').first();
    for (const caption of ['Barang', 'Qty', 'Harga', 'Disc 1(%)', 'Disc 2(%)', 'Disc 3(%)', 'Disc (Rp)', 'Subtotal', 'Description']) {
      await expect(itemHead.getByText(caption, { exact: true })).toBeVisible();
    }

    // Empty items validation
    await page.getByRole('button', { name: 'Submit Header', exact: true }).click();
    await expect(page.getByText('Wajib menginput minimal 1 item barang yang diterima')).toBeVisible();

    // Keterangan accepts "/"
    const keterangan = page.locator('label', { hasText: 'Keterangan :' }).locator('input');
    await keterangan.click();
    await keterangan.type(note);
    await expect(keterangan).toHaveValue(note);

    // "#" qty 4, pick the first result, price 50.000 -> subtotal 200.000
    await page.getByLabel('Qty', { exact: true }).fill('4');
    await page.locator('input[placeholder*="Scan Barcode / Cari Barang"]').fill('a');
    const firstResult = page.locator('div.cursor-pointer:has(div.font-mono)').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
    await page.locator('table tbody input[type="number"]').nth(1).fill('50000');
    await expect(page.locator('table tbody tr').first()).toContainText('200.000');

    // Clearing the line qty and typing 5 gives 5 (it used to snap to 1 and become 15); an empty box reverts on blur
    const lineQty = page.locator('table tbody input[type="number"]').first();
    await lineQty.fill('');
    await lineQty.pressSequentially('5');
    await expect(lineQty).toHaveValue('5');
    await expect(page.locator('table tbody tr').first()).toContainText('250.000');
    await lineQty.fill('');
    await lineQty.blur();
    await expect(lineQty).toHaveValue('5');
    await lineQty.fill('');
    await lineQty.pressSequentially('4');
    await lineQty.blur();
    await expect(page.locator('table tbody tr').first()).toContainText('200.000');

    // Header discount 10% -> Diskon 20.000
    await page.getByLabel('Diskon (%)').fill('10');
    await expect(page.getByLabel('Diskon (Rp)')).toHaveValue('20.000');

    // PPn 0% must stay 0% (the API used to turn 0 into 11%); Cash has no due date
    await page.getByLabel('PPn (%)').fill('0');
    await page.locator('label', { hasText: 'Pembayaran :' }).locator('select').selectOption('CASH');
    await expect(page.getByText('Jatuh Tempo :', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Submit Header', exact: true }).click();
    await expect(page.getByText('berhasil disimpan & HPP diperbarui!')).toBeVisible({ timeout: 15000 });

    // After saving, the print voucher opens; Escape closes it
    await expect(page.getByText('Nota Bukti Penerimaan Barang & HPP Update')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.printable-priced-voucher')).toContainText('FAKTUR PENERIMAAN BARANG DENGAN HARGA');
    await expect(page.locator('.printable-priced-voucher')).toContainText('PPn (0%)');
    await expect(page.locator('.printable-priced-voucher')).toContainText('Pembayaran : Cash');
    await expect(page.locator('.printable-priced-voucher')).not.toContainText('Jatuh Tempo');
    await page.keyboard.press('Escape');
    await expect(page.getByText('Nota Bukti Penerimaan Barang & HPP Update')).toHaveCount(0);

    // Saved receipt: lines read-only (no Submit Header); "Cetak" reopens the voucher
    await expect(page.getByRole('button', { name: 'Submit Header', exact: true })).toHaveCount(0);
    await expect(keterangan).toHaveValue(note);
    await page.getByRole('button', { name: 'Cetak', exact: true }).click();
    await page.evaluate(() => { window.print = () => {}; });
    await page.getByRole('button', { name: 'Cetak Nota Official', exact: true }).click();
    await page.getByRole('button', { name: 'Tutup', exact: true }).click();
    await expect(page.locator('.printable-priced-voucher')).toHaveCount(0);

    // Back to the list, find it, double-click opens the detail again (a cash receipt is paid on entry: "Terbayar")
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('switch', { name: 'Terbayar' }).click();
    await page.locator('input[placeholder*="Search No. MR"]').fill(suffix);
    const row = page.locator('tr', { hasText: note });
    await expect(row).toBeVisible({ timeout: 10000 });
    // Jatuh Tempo column stays blank for a Cash receipt
    await expect(row.locator('td').nth(4)).toHaveText('');
    await row.dblclick();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
  });

  test('3. Price > 0 check, right-click "Hapus", and Back asks before discarding typed items', async ({ page }) => {
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await page.getByRole('button', { name: 'New', exact: true }).click();

    await page.locator('input[placeholder*="Scan Barcode / Cari Barang"]').fill('a');
    const firstResult = page.locator('div.cursor-pointer:has(div.font-mono)').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();

    // A zero price would overwrite HPP with 0
    await page.locator('table tbody input[type="number"]').nth(1).fill('0');
    await page.getByRole('button', { name: 'Submit Header', exact: true }).click();
    await expect(page.getByText('Harga beli setiap barang wajib diisi (lebih dari 0)')).toBeVisible();

    // Back with unsaved items asks first; cancelling stays
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByText('Barang yang sudah diinput belum disimpan. Kembali ke daftar?')).toBeVisible();
    await page.getByRole('button', { name: 'Batal' }).click();

    await page.locator('table tbody tr').first().click({ button: 'right' });
    await page.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByText('Date Start', { exact: true })).toBeVisible();
  });

  test('4. Old functions: Disc 2/3/(Rp), Multi Disc, Lama Termin, Saldo Terhutang, Apply  Changes, Lihat Stok, Daily Report, Cash Payment, Terbayar, Lunas, Recreate Invoice', async ({ page }) => {
    test.setTimeout(120000);
    await expect(page.getByText('Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const suffix = Date.now().toString().slice(-5);
    const note = `E2E oldfn / ${suffix}`;

    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.locator('label', { hasText: 'Keterangan :' }).locator('input').fill(note);
    await page.getByLabel('Qty', { exact: true }).fill('2');
    await page.locator('input[placeholder*="Scan Barcode / Cari Barang"]').fill('a');
    const firstResult = page.locator('div.cursor-pointer:has(div.font-mono)').first();
    await expect(firstResult).toBeVisible({ timeout: 10000 });
    await firstResult.click();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();

    // Old detail SP: 10.000 - (10% = 1.000) - (5% of 9.000 = 450) - Rp 50 = 8.500 per unit; x2 = 17.000
    const row = page.locator('table tbody tr').first();
    await page.locator('table tbody input[type="number"]').nth(1).fill('10000');
    await row.getByLabel(/^Disc 1 /).fill('10');
    await row.getByLabel(/^Disc 2 /).fill('5');
    await row.getByLabel(/^Disc \(Rp\) /).fill('50');
    await expect(row).toContainText('17.000');

    // Header: Multi Disc 10% then 50% = 1.700 + 7.650 = 9.350; PPn 10% of 7.650 = 765; total 8.415; Uang Muka 415 -> Saldo 8.000
    await expect(page.getByLabel('Diskon 2 (%)')).toBeDisabled();
    await page.getByText('Multi Disc', { exact: true }).click();
    await page.getByLabel('Diskon (%)').fill('10');
    await page.getByLabel('Diskon 2 (%)').fill('50');
    await page.getByLabel('PPn (%)').fill('10');
    await page.getByLabel('Uang Muka').fill('415');
    await expect(page.getByLabel('Diskon (Rp)')).toHaveValue('9.350');
    await expect(page.getByLabel('PPn (Rp)')).toHaveValue('765');
    await expect(page.locator('label', { hasText: 'Total Keseluruhan :' }).locator('input')).toHaveValue('8.415');
    await expect(page.locator('label', { hasText: 'Saldo Terhutang :' }).locator('input')).toHaveValue('8.000');

    // Credit: Lama Termin 15 Hari -> due date = Tanggal + 15
    await page.locator('label', { hasText: 'Pembayaran :' }).locator('select').selectOption('TEMPO');
    const tanggal = await page.locator('label', { hasText: 'Tanggal :' }).locator('input').inputValue();
    const due = new Date(`${tanggal}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 15);
    const dueText = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(due);
    await page.getByLabel('Lama Termin').fill('15');
    await expect(page.getByLabel('Jatuh Tempo')).toHaveValue(dueText);

    // "Lihat Stok" before saving: current stock of the line
    await page.getByRole('button', { name: 'Lihat Stok', exact: true }).click();
    const stockDialog = page.getByRole('dialog', { name: 'Lihat Stok' });
    for (const caption of ['Barcode', 'Nama Barang', 'Stok']) await expect(stockDialog.getByText(caption, { exact: true })).toBeVisible();
    const stockCell = stockDialog.locator('tbody tr').first().locator('td').nth(2);
    await expect(stockCell).not.toHaveText('');
    const stockBefore = Number((await stockCell.innerText()).replace(/\./g, ''));
    await stockDialog.getByRole('button', { name: 'Tutup' }).click();

    await page.getByRole('button', { name: 'Submit Header', exact: true }).click();
    await expect(page.getByText('berhasil disimpan & HPP diperbarui!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Nota Bukti Penerimaan Barang & HPP Update')).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');

    // Saved: the stored values come back from the server (same formula)
    await expect(page.locator('table tbody tr').first()).toContainText('17.000');
    await expect(page.locator('label', { hasText: 'Saldo Terhutang :' }).locator('input')).toHaveValue('8.000');
    await expect(page.getByLabel('Jatuh Tempo')).toHaveValue(dueText);
    const mrNo = await page.locator('label', { hasText: 'No. Order :' }).locator('input').inputValue();

    // Stock went up by the received qty
    await page.getByRole('button', { name: 'Lihat Stok', exact: true }).click();
    await expect(stockDialog.locator('tbody tr').first().locator('td').nth(2)).toHaveText(new Intl.NumberFormat('id-ID').format(stockBefore + 2));
    await stockDialog.getByRole('button', { name: 'Tutup' }).click();

    // "Apply  Changes": header only; Uang Muka 1.415 -> Saldo 7.000
    const apply = page.getByRole('button', { name: 'Apply  Changes', exact: true });
    await expect(apply).toBeDisabled();
    await page.getByLabel('Uang Muka').fill('1415');
    await expect(page.locator('label', { hasText: 'Saldo Terhutang :' }).locator('input')).toHaveValue('7.000');
    await expect(page.getByRole('button', { name: 'Cash Payment', exact: true })).toBeDisabled(); // unsaved change first
    await apply.click();
    await expect(page.getByText(`Perubahan nota ${mrNo} berhasil disimpan`)).toBeVisible({ timeout: 15000 });
    await expect(apply).toBeDisabled();
    await expect(page.locator('label', { hasText: 'Saldo Terhutang :' }).locator('input')).toHaveValue('7.000');

    // "Daily Report" (today): the receipt under "Pembayaran Kredit" with its totals
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Daily Report', exact: true }).click();
    const report = page.locator('.printable-daily-report');
    await expect(report).toContainText('Laporan Harian Penerimaan Barang');
    const block = report.locator(`[data-mrno="${mrNo}"]`);
    await expect(block).toBeVisible({ timeout: 10000 });
    await expect(report).toContainText('Pembayaran Kredit');
    await expect(report).toContainText('Total Terhutang :');
    await expect(report).toContainText('Total Pembayaran Cash :');
    await expect(block).toContainText('8.415');
    await page.getByRole('dialog', { name: 'Daily Report' }).getByRole('button', { name: 'Tutup' }).click();

    // Unpaid: listed under "Belum Terbayar", not under "Terbayar"
    await page.locator('input[placeholder*="Search No. MR"]').fill(mrNo);
    const listRow = page.locator('tr', { hasText: note });
    await expect(listRow).toBeVisible({ timeout: 10000 });
    await page.getByRole('switch', { name: 'Terbayar' }).click();
    await expect(listRow).toHaveCount(0, { timeout: 10000 });
    await page.getByRole('switch', { name: 'Terbayar' }).click();
    await listRow.dblclick();

    // "Cash Payment": pays the Saldo Terhutang, then asks whether to continue
    await page.getByRole('button', { name: 'Cash Payment', exact: true }).click();
    const cash = page.getByRole('dialog', { name: 'PopUp_CashPayment' });
    await expect(cash.locator('label', { hasText: 'Total Transaksi :' }).locator('input')).toHaveValue('7.000');
    await expect(cash.locator('label', { hasText: 'No. Penerimaan :' }).locator('input')).toHaveValue(mrNo);
    await cash.getByRole('button', { name: 'Proses', exact: true }).click();
    await expect(page.getByText('Transaksi telah berhasil dilunasi, apakah anda ingin melanjutkan transaksi penerimaan')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Batal' }).click();
    await expect(page.getByText('Date Start', { exact: true })).toBeVisible();

    // Now "Terbayar"; a paid receipt is locked (no Cash Payment / Apply  Changes); "Lunas" stamps the print
    await page.locator('input[placeholder*="Search No. MR"]').fill(mrNo);
    await expect(listRow).toHaveCount(0, { timeout: 10000 });
    await page.getByRole('switch', { name: 'Terbayar' }).click();
    await expect(listRow).toBeVisible({ timeout: 10000 });
    await listRow.dblclick();
    await expect(page.getByRole('button', { name: 'Cash Payment', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Apply  Changes', exact: true })).toBeDisabled();
    await expect(page.getByLabel('Uang Muka')).toHaveAttribute('readonly', '');
    const lunas = page.getByLabel('Lunas', { exact: true });
    await expect(lunas).toBeChecked();
    await page.getByRole('button', { name: 'Cetak', exact: true }).click();
    await expect(page.locator('.printable-priced-voucher')).toContainText('LUNAS');
    await page.keyboard.press('Escape');
    await lunas.uncheck();
    await page.getByRole('button', { name: 'Cetak', exact: true }).click();
    await expect(page.locator('.printable-priced-voucher')).not.toContainText('LUNAS');
    await page.keyboard.press('Escape');

    // "Recreate Invoice": next receipt on the same date
    await page.getByRole('button', { name: 'Recreate Invoice', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Submit Header', exact: true })).toBeVisible();
    await expect(page.locator('label', { hasText: 'Tanggal :' }).locator('input')).toHaveValue(tanggal);
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();
  });
});

// Uang Muka is purchase money: Admin only, like the totals (API level, local test DB only)
test.describe('Menu 8: Penerimaan Barang dengan Harga — non-admin', () => {
  test('5. Uang Muka is masked for a non-admin, and their Apply  Changes keeps the stored value', async ({ playwright }) => {
    const staffUser = process.env.E2E_STAFF_USER;
    const staffPassword = process.env.E2E_STAFF_PASSWORD;
    test.skip(!staffUser || !staffPassword, 'Set E2E_STAFF_USER and E2E_STAFF_PASSWORD to a non-admin login');
    const baseURL = 'http://localhost:3000';
    const admin = await playwright.request.newContext({ baseURL });
    const staff = await playwright.request.newContext({ baseURL });
    expect((await admin.post('/api/auth/login', { data: { username: 'admin', password: '5555' } })).ok()).toBe(true);
    expect((await staff.post('/api/auth/login', { data: { username: staffUser, password: staffPassword } })).ok()).toBe(true);

    // A credit receipt with Uang Muka 1.000, saved by the admin
    const inv = (await (await admin.get('/api/inventory?limit=1&page=1')).json()).data[0];
    const supplier = (await (await admin.get('/api/suppliers?limit=1')).json()).data[0];
    const saved = await (await admin.post('/api/purchasing/priced', {
      data: {
        mrDate: new Date().toISOString().slice(0, 10), supplierId: supplier.id, whId: 1, paymentType: 'TEMPO', longTerm: 30,
        downPayment: 1000, discPercentage: 0, ppnPercentage: 0, description: `E2E uang muka ${Date.now()}`,
        items: [{ inventoryId: inv.id, qty: 1, price: 5000 }],
      },
    })).json();
    expect(saved.success).toBe(true);
    const id = saved.id;

    const staffDetail = (await (await staff.get(`/api/purchasing/priced/${id}`)).json()).data;
    expect(staffDetail.down_payment).toBeNull();
    const staffList = (await (await staff.get(`/api/purchasing/priced?q=${encodeURIComponent(saved.mrNo)}`)).json()).data;
    expect(staffList.every((r: { downPayment: unknown }) => r.downPayment === null)).toBe(true);
    expect((await (await admin.get(`/api/purchasing/priced/${id}`)).json()).data.down_payment).toBe(1000);

    // The staff screen sends Uang Muka 0 (it never saw the value): the stored 1.000 stays
    const put = await staff.put(`/api/purchasing/priced/${id}`, {
      data: { mrDate: staffDetail.mr_date, supplierId: supplier.id, whId: 1, paymentType: 'TEMPO', longTerm: 30, downPayment: 0, discPercentage: 0, ppnPercentage: 0 },
    });
    expect([200, 403]).toContain(put.status());
    expect((await (await admin.get(`/api/purchasing/priced/${id}`)).json()).data.down_payment).toBe(1000);
    await admin.dispose();
    await staff.dispose();
  });
});
