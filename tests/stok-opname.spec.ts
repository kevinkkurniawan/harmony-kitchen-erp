import { test, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, username: string, pin: string) {
  await page.goto('/');
  const usernameInput = page.locator('input[placeholder="Enter Username"]');
  await expect(usernameInput).toBeVisible({ timeout: 15000 });
  await usernameInput.fill(username);
  await page.fill('input[placeholder="••••••••"]', pin);
  await page.click('button:has-text("Log on")');

  await expect(page.getByRole('button', { name: /Stok Opname/i }).first()).toBeVisible({ timeout: 15000 });
}

async function openStokOpnameMenu(page: Page) {
  const sidebarBtn = page.getByRole('button', { name: /Stok Opname/i }).first();
  await expect(sidebarBtn).toBeVisible({ timeout: 10000 });
  await sidebarBtn.click();

  await expect(page.getByTestId('opname-status-badge')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Memuat data...')).toBeHidden({ timeout: 25000 });
}

test.describe('Menu 2: Stok Opname — E2E Audit & Unified Qty Verification', () => {
  test.setTimeout(60000);
  const createdProductIds: number[] = [];

  test.afterAll(async ({ browser }) => {
    if (createdProductIds.length === 0) return;
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await loginAs(page, 'admin', '5555');
      for (const id of createdProductIds) {
        await page.request.delete(`/api/inventory/${id}`);
      }
    } finally {
      await context.close();
    }
  });

  test('1. Legacy "Input Stock" layout: old buttons, field rows, grid columns and footer', async ({ page }) => {
    await loginAs(page, 'admin', '5555');
    await openStokOpnameMenu(page);

    await expect(page.getByText('Input Stock', { exact: true })).toBeVisible();
    for (const name of ['New Opname', 'Refresh', 'Print', 'Print Barcode', 'Input', 'Simpan']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
    for (const label of ['Barcode :', 'No. Transaksi :', 'Gudang :', 'Nama Barang :', 'Opname History :', 'Qty :', 'Desc :']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // Client-agreed mode switch stays
    await expect(page.getByRole('button', { name: 'Penyesuaian (+/-)', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cek Stok (hitung fisik)', exact: true })).toBeVisible();

    // Legacy grid columns; Price only for Admin
    const thead = page.locator('table thead').first();
    for (const caption of ['Barcode', 'No. Inventory', 'Nama Barang', 'Qty', 'Description', 'Price']) {
      await expect(thead.getByText(caption, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByText('Total = 0 barang', { exact: true })).toBeVisible();
    // Old order: &Print then Print Barcode; the ".:: Detail ::." group only appears for an unknown barcode
    const print = await page.getByRole('button', { name: 'Print', exact: true }).boundingBox();
    const printBarcode = await page.getByRole('button', { name: 'Print Barcode', exact: true }).boundingBox();
    expect(printBarcode!.x).toBeGreaterThan(print!.x);
    await expect(page.getByText('.:: Detail ::.')).toHaveCount(0);

    // Removed new-only controls
    for (const gone of ['Export CSV', 'Draft', 'Load', 'Baru', 'Tambah']) {
      await expect(page.getByRole('button', { name: gone, exact: true })).toHaveCount(0);
    }
    await expect(page.locator('input[placeholder="Nama Auditor..."]')).toHaveCount(0);
    await expect(page.locator('input[placeholder="Filter tabel opname..."]')).toHaveCount(0);
    await expect(page.getByText('Qty Sistem')).toHaveCount(0);
    await expect(page.getByText('Qty Fisik')).toHaveCount(0);
    await expect(thead.getByText('Selisih')).toHaveCount(0);
  });

  test('2. Barcode Enter + Input button, inline Qty edit, sorting and right-click Hapus', async ({ page }) => {
    await loginAs(page, 'admin', '5555');

    // Create 2 temporary items to test deterministic opname manipulation
    const suffix = Date.now().toString().slice(-6);
    const skuA = `OPN-A-${suffix}`;
    const skuB = `OPN-B-${suffix}`;

    const resA = await page.request.post('/api/inventory', {
      data: {
        inventoryNo: skuA,
        barcode: `8991${suffix}`,
        inventoryName: `Alpha Opname Item ${suffix}`,
        price: 10000,
        hpp: 7000,
        stokAwal: 5,
      },
    });
    const jsonA = await resA.json();
    expect(jsonA.success).toBe(true);
    createdProductIds.push(Number(jsonA.data.id));

    const resB = await page.request.post('/api/inventory', {
      data: {
        inventoryNo: skuB,
        barcode: `8992${suffix}`,
        inventoryName: `Beta Opname Item ${suffix}`,
        price: 20000,
        hpp: 12000,
        stokAwal: 8,
      },
    });
    const jsonB = await resB.json();
    expect(jsonB.success).toBe(true);
    createdProductIds.push(Number(jsonB.data.id));

    await openStokOpnameMenu(page);

    await page.getByRole('button', { name: 'New Opname', exact: true }).click();
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();

    const scanInput = page.locator('input[placeholder="Scan Barcode / SKU..."]');
    const qtyEntryInput = page.locator('label', { hasText: 'Qty :' }).locator('input[type="number"]');
    const noteInput = page.locator('input[placeholder="Catatan Opname..."]');

    // Item A via Barcode + Enter (Penyesuaian mode: qty is a +/- change)
    await scanInput.fill(skuA);
    await qtyEntryInput.fill('12');
    await noteInput.fill('Rak Depan');
    await scanInput.press('Enter');

    await expect(page.getByText(`Alpha Opname Item ${suffix}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByText('Total = 12 barang', { exact: true })).toBeVisible();

    // Item B via the Input button
    await scanInput.fill(skuB);
    await qtyEntryInput.fill('5');
    await noteInput.fill('Gudang Belakang');
    await page.getByRole('button', { name: 'Input', exact: true }).click();

    await expect(page.getByText(`Beta Opname Item ${suffix}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('2 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByText('Total = 17 barang', { exact: true })).toBeVisible();

    // Inline qty edit on the top row (Item B)
    const qtyBeta = page.getByLabel(`Qty Beta Opname Item ${suffix}`);
    await qtyBeta.fill('6');
    await expect(page.getByText('Total = 18 barang', { exact: true })).toBeVisible();

    // A negative adjustment can be typed key by key ("-" first); an unfinished "-" falls back on blur
    await qtyBeta.fill('');
    await qtyBeta.pressSequentially('-3');
    await qtyBeta.press('Enter');
    await expect(qtyBeta).toHaveValue('-3');
    await expect(page.getByText('Total = 9 barang', { exact: true })).toBeVisible();
    await qtyBeta.fill('');
    await qtyBeta.pressSequentially('-');
    await qtyBeta.blur();
    await expect(qtyBeta).toHaveValue('-3');

    // Refresh keeps the unsaved lines; New Opname asks first and "Batal" keeps them
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByText('2 Jenis', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New Opname', exact: true }).click();
    await expect(page.getByText('Item opname yang sudah diinput belum disimpan. Buang input ini?')).toBeVisible();
    await page.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(page.getByText('2 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByText('Total = 9 barang', { exact: true })).toBeVisible();

    // Sort by Qty
    const qtyHeader = page.locator('table thead th').filter({ hasText: /^Qty/ });
    await qtyHeader.click(); // asc: Beta (-3) then Alpha (12)
    await expect(page.locator('table tbody tr').first()).toContainText(`Beta Opname Item ${suffix}`);
    await qtyHeader.click(); // desc: Alpha (12) then Beta (-3)
    await expect(page.locator('table tbody tr').first()).toContainText(`Alpha Opname Item ${suffix}`);

    // Right-click Hapus removes a row
    await page.locator('table tbody tr', { hasText: `Alpha Opname Item ${suffix}` }).click({ button: 'right' });
    await page.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByText('Total = -3 barang', { exact: true })).toBeVisible();

    // Confirming "Buang" clears the worksheet
    await page.getByRole('button', { name: 'New Opname', exact: true }).click();
    await page.getByRole('button', { name: 'Buang', exact: true }).click();
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();
  });

  test('3. End-to-End DB Draft, Posting, Live Stock Update, and Reversal Workflow', async ({ page }) => {
    await loginAs(page, 'admin', '5555');

    const suffix = Date.now().toString().slice(-6);
    const sku = `OPN-POST-${suffix}`;
    const createRes = await page.request.post('/api/inventory', {
      data: {
        inventoryNo: sku,
        barcode: `8999${suffix}`,
        inventoryName: `Postable Opname Item ${suffix}`,
        price: 15000,
        hpp: 10000,
        stokAwal: 10,
      },
    });
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    const invId = Number(createJson.data.id);
    createdProductIds.push(invId);

    // Set initial live stock to 10 via direct opname API
    await page.request.post('/api/inventory/opname', {
      data: {
        inventoryId: invId,
        qty: 10,
        mode: 'replace',
        action: 'post',
      },
    });

    await openStokOpnameMenu(page);

    // Start a new Cek Stok (hitung fisik) worksheet: qty = counted stock
    await page.getByRole('button', { name: 'New Opname', exact: true }).click();
    await page.getByRole('button', { name: 'Cek Stok (hitung fisik)', exact: true }).click();
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();

    // Add the item with target Qty = 25
    const scanInput = page.locator('input[placeholder="Scan Barcode / SKU..."]');
    const qtyEntryInput = page.locator('label', { hasText: 'Qty :' }).locator('input[type="number"]');
    const noteInput = page.locator('input[placeholder="Catatan Opname..."]');

    await scanInput.fill(sku);
    await qtyEntryInput.fill('25');
    await noteInput.fill('Audit Kuartal');
    await page.getByRole('button', { name: 'Input', exact: true }).click();

    await expect(page.getByText('Total = 25 barang', { exact: true })).toBeVisible({ timeout: 15000 });

    // Cek Stok: the grid qty does not take a negative count
    const qtyCell = page.getByLabel(`Qty Postable Opname Item ${suffix}`);
    await qtyCell.fill('');
    await qtyCell.pressSequentially('-5');
    await qtyCell.blur();
    await expect(qtyCell).toHaveValue('25');
    await expect(page.getByText('Total = 25 barang', { exact: true })).toBeVisible();

    // Open Confirmation Preview Modal
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Konfirmasi Simpan Stok Opname' })).toBeVisible();

    // First save as DB Draft
    await page.getByRole('button', { name: 'Simpan Draft DB' }).click();
    await expect(page.getByTestId('opname-status-badge')).toHaveText('DRAFT', { timeout: 15000 });

    // Verify stock in DB is still 10 while status is DRAFT
    const checkDraftInv = await page.request.get(`/api/inventory?q=${sku}`);
    const draftInvJson = await checkDraftInv.json();
    const draftList = draftInvJson.data?.items || draftInvJson.data || [];
    const draftItem = draftList.find((i: any) => Number(i.id) === invId);
    expect(Number(draftItem.stock)).toBe(10);

    // Now open Simpan modal again and Post the adjustment
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Konfirmasi Simpan Stok Opname' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Post Adjustment' }).click();

    // Verify status transitions to POSTED and Reverse Opname button appears
    await expect(page.getByTestId('opname-status-badge')).toHaveText('POSTED', { timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Reverse Opname' })).toBeVisible();

    // Verify stock in DB is updated to 25!
    const checkPostedInv = await page.request.get(`/api/inventory?q=${sku}`);
    const postedInvJson = await checkPostedInv.json();
    const postedList = postedInvJson.data?.items || postedInvJson.data || [];
    const postedItem = postedList.find((i: any) => Number(i.id) === invId);
    expect(Number(postedItem.stock)).toBe(25);

    // Now test Reversal workflow
    await page.getByRole('button', { name: 'Reverse Opname' }).click();
    await expect(page.getByRole('heading', { name: 'Batalkan (Reverse) Opname' })).toBeVisible();

    // Clicking confirm without reason should show validation error toast
    await page.getByRole('button', { name: 'Konfirmasi Reverse' }).click();
    await expect(page.getByText(/Alasan pembatalan \(reversal\) wajib diisi/i)).toBeVisible();

    // Enter valid reason and confirm reversal
    await page.locator('textarea[placeholder*="Masukkan alasan pembatalan"]').fill('Salah hitung rak gudang');
    await page.getByRole('button', { name: 'Konfirmasi Reverse' }).click();

    // Verify status transitions to REVERSED and banner displays reason
    await expect(page.getByTestId('opname-status-badge')).toHaveText('REVERSED', { timeout: 15000 });
    await expect(page.getByText(/Salah hitung rak gudang/i)).toBeVisible();

    // Verify stock in DB is restored back to 10!
    const checkRevInv = await page.request.get(`/api/inventory?q=${sku}`);
    const revInvJson = await checkRevInv.json();
    const revList = revInvJson.data?.items || revInvJson.data || [];
    const revItem = revList.find((i: any) => Number(i.id) === invId);
    expect(Number(revItem.stock)).toBe(10);
  });

  test('4. RBAC Enforcement: non-admin user cannot post or reverse opname', async ({ page }) => {
    // Needs a real non-admin login without OPNAME_POST / OPNAME_REVERSE grants; no such user is seeded
    const staffUser = process.env.E2E_STAFF_USER;
    const staffPassword = process.env.E2E_STAFF_PASSWORD;
    test.skip(!staffUser || !staffPassword, 'Set E2E_STAFF_USER and E2E_STAFF_PASSWORD to a non-admin login');
    await loginAs(page, staffUser!, staffPassword!);

    const postRes = await page.request.post('/api/inventory/opname', {
      data: {
        noTransaction: `OPN/RBAC/${Date.now()}`,
        action: 'post',
        items: [{ inventoryId: 1, qty: 10 }],
      },
    });
    expect(postRes.status()).toBe(403);

    const revRes = await page.request.post('/api/inventory/opname', {
      data: {
        noTransaction: `OPN/RBAC/${Date.now()}`,
        action: 'reverse',
        reason: 'Test unauthorized reverse',
      },
    });
    expect(revRes.status()).toBe(403);
  });

  test('5. Print Barcode: old Rpt_OpnameBarcode A4 sheet, one label per line with barcode, name and retail price', async ({ page }) => {
    await loginAs(page, 'admin', '5555');
    const suffix = Date.now().toString().slice(-6);
    const sku = `OPN-BC-${suffix}`;
    const res = await page.request.post('/api/inventory', {
      data: { inventoryNo: sku, barcode: `8993${suffix}`, inventoryName: `Label Opname Item ${suffix}`, price: 15000, hpp: 9000 },
    });
    const json = await res.json();
    expect(json.success).toBe(true);
    createdProductIds.push(Number(json.data.id));

    await openStokOpnameMenu(page);
    await page.getByRole('button', { name: 'New Opname', exact: true }).click();
    const scanInput = page.locator('input[placeholder="Scan Barcode / SKU..."]');
    await scanInput.fill(sku);
    await scanInput.press('Enter');
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible({ timeout: 15000 });

    await page.evaluate(() => {
      const w = window as unknown as { __sheet: unknown };
      window.print = () => {
        const area = document.getElementById('opname-barcode-print')!;
        w.__sheet = {
          visibleCss: Array.from(document.querySelectorAll('style')).some((el) => (el.textContent || '').includes('#opname-barcode-print { display: block')),
          labels: area.querySelectorAll('.opname-barcode-label').length,
          bars: area.querySelectorAll('.opname-barcode-label [data-testid="barcode-svg"]').length,
          text: area.textContent || '',
        };
      };
    });
    await page.getByRole('button', { name: 'Print Barcode', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __sheet?: unknown }).__sheet)).toBeTruthy();
    const sheet = await page.evaluate(() => (window as unknown as { __sheet: { visibleCss: boolean; labels: number; bars: number; text: string } }).__sheet);
    expect(sheet.visibleCss).toBe(true);
    expect(sheet.labels).toBe(1);
    expect(sheet.bars).toBe(1);
    expect(sheet.text).toContain('No Transaksi :');
    expect(sheet.text).toContain(`8993${suffix}`);
    expect(sheet.text).toContain(`Label Opname Item ${suffix}`);
    // Retail price (not the HPP 9.000)
    expect(sheet.text).toContain('15.000');
    expect(sheet.text).not.toContain('9.000');

    // Afterwards the normal Print uses the opname report sheet again
    await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('style')).some((el) => (el.textContent || '').includes('#printable-opname-report')))).toBe(true);
  });

  test('6. Unknown barcode opens ".:: Detail ::.", Submit creates the item and adds it; clashes are refused', async ({ page }) => {
    await loginAs(page, 'admin', '5555');
    await openStokOpnameMenu(page);
    await page.getByRole('button', { name: 'New Opname', exact: true }).click();

    const suffix = Date.now().toString().slice(-6);
    const newBarcode = `7770${suffix}`;
    const scanInput = page.locator('input[placeholder="Scan Barcode / SKU..."]');
    await scanInput.fill(newBarcode);
    await scanInput.press('Enter');

    const detail = page.getByTestId('opname-detail');
    await expect(page.getByText('.:: Detail ::.')).toBeVisible({ timeout: 15000 });
    for (const label of ['Barcode :', 'Inv No. :', 'Inv Name :', 'Qty :', 'Kode Harga :', 'Desc :']) {
      await expect(detail.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(detail.getByLabel('Detail Barcode')).toHaveValue(newBarcode);
    await expect(detail.getByLabel('Inv No.')).toBeFocused();
    // No line was added for the unknown code
    await expect(page.getByText('0 Jenis', { exact: true })).toBeVisible();

    await detail.getByLabel('Inv No.').fill(`OPN-NEW-${suffix}`);
    await detail.getByLabel('Inv Name').fill(`Barang Baru Scan ${suffix}`);
    await detail.getByLabel('Detail Qty').fill('3');
    await detail.getByLabel('Kode Harga').fill('KH1');
    await detail.getByLabel('Detail Desc').fill('Ditemukan saat opname');
    const created = page.waitForResponse((r) => r.url().includes('/api/inventory/opname/item'));
    await detail.getByRole('button', { name: 'Submit' }).click();
    const createdJson = await (await created).json();
    expect(createdJson.success).toBe(true);
    createdProductIds.push(Number(createdJson.data.id));

    await expect(page.getByText('.:: Detail ::.')).toHaveCount(0);
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
    await expect(page.getByText('Total = 3 barang', { exact: true })).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toContainText(`Barang Baru Scan ${suffix}`);

    // Saved as a normal item, no stock until the opname is posted
    const inv = await (await page.request.get(`/api/inventory?q=${newBarcode}`)).json();
    const item = (inv.data || []).find((i: { id: string }) => Number(i.id) === Number(createdJson.data.id));
    expect(item).toMatchObject({ inventoryNo: `OPN-NEW-${suffix}`, kodeHarga: 'KH1', description: 'Ditemukan saat opname' });
    expect(Number(item.stokAkhir ?? item.stock)).toBe(0);

    // Scanning it again now finds the item (Penyesuaian adds up)
    await scanInput.fill(newBarcode);
    await page.locator('label', { hasText: 'Qty :' }).first().locator('input[type="number"]').fill('2');
    await scanInput.press('Enter');
    await expect(page.getByText('Total = 5 barang', { exact: true })).toBeVisible({ timeout: 15000 });

    // A second unknown barcode whose Inv No. is already used is refused, nothing is created or added
    await scanInput.fill(`7771${suffix}`);
    await scanInput.press('Enter');
    await expect(page.getByText('.:: Detail ::.')).toBeVisible({ timeout: 15000 });
    await detail.getByLabel('Inv No.').fill(`OPN-NEW-${suffix}`);
    await detail.getByLabel('Inv Name').fill(`Duplikat ${suffix}`);
    await detail.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText(new RegExp(`Barcode / Inv No\\. sudah dipakai barang OPN-NEW-${suffix}`))).toBeVisible();
    await expect(page.getByText('1 Jenis', { exact: true })).toBeVisible();
    const dup = await (await page.request.get(`/api/inventory?q=7771${suffix}`)).json();
    expect(dup.data || []).toHaveLength(0);
  });

  test('7. Create-on-scan API: required fields, and a non-admin without INVENTORY_EDIT is refused', async ({ page }) => {
    await loginAs(page, 'admin', '5555');
    const noName = await page.request.post('/api/inventory/opname/item', { data: { barcode: '1', inventoryNo: 'X', inventoryName: ' ' } });
    expect(noName.status()).toBe(400);
    const noBarcode = await page.request.post('/api/inventory/opname/item', { data: { inventoryNo: 'X', inventoryName: 'Y' } });
    expect(noBarcode.status()).toBe(400);

    const staffUser = process.env.E2E_STAFF_USER;
    const staffPassword = process.env.E2E_STAFF_PASSWORD;
    test.skip(!staffUser || !staffPassword, 'Set E2E_STAFF_USER and E2E_STAFF_PASSWORD to a non-admin login');
    const staff = await page.context().browser()!.newContext({ baseURL: 'http://localhost:3000' });
    const login = await staff.request.post('/api/auth/login', { data: { username: staffUser, password: staffPassword } });
    expect(login.status()).toBe(200);
    const res = await staff.request.post('/api/inventory/opname/item', {
      data: { barcode: `7772${Date.now()}`, inventoryNo: `OPN-RBAC-${Date.now()}`, inventoryName: 'Tidak boleh dibuat' },
    });
    expect([403]).toContain(res.status());
    // Purchase prices stay Admin-only as well
    expect((await staff.request.get('/api/inventory/251/hpp-history')).status()).toBe(403);
    await staff.close();
  });
});
