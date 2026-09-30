import { test, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, username: string, pin: string) {
  await page.goto('/');
  const usernameInput = page.locator('input[placeholder="Masukkan username"]');
  await expect(usernameInput).toBeVisible({ timeout: 15000 });
  await usernameInput.fill(username);
  await page.fill('input[placeholder="••••••••"]', pin);
  await page.click('button:has-text("Login ke ERP")');

  await expect(page.getByRole('button', { name: /Stok Opname/i }).first()).toBeVisible({ timeout: 15000 });
}

async function openStokOpnameMenu(page: Page) {
  const sidebarBtn = page.getByRole('button', { name: /Stok Opname/i }).first();
  await expect(sidebarBtn).toBeVisible({ timeout: 10000 });
  await sidebarBtn.click();

  await expect(page.getByRole('heading', { name: 'Stok Opname', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Sedang Mengambil Data...')).toBeHidden({ timeout: 25000 });
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
        await page.request.delete(`/api/inventory?id=${id}`);
      }
    } finally {
      await context.close();
    }
  });

  test('1. Unified Single Qty UI: removes Qty Sistem, Qty Fisik, Selisih, and Blind Count', async ({ page }) => {
    await loginAs(page, 'admin', '5555');
    await openStokOpnameMenu(page);

    // Verify KPI Cards show unified Qty metrics
    await expect(page.getByText('Total Item Opname')).toBeVisible();
    await expect(page.getByText('Total Qty', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Status Transaksi')).toBeVisible();
    await expect(page.getByText('Total Nilai Opname').first()).toBeVisible();

    // Verify Table Headers have unified "Qty" and NO "Qty Sistem", "Qty Fisik", or "Selisih"
    const thead = page.locator('table thead').first();
    await expect(thead.getByText('Kode Barang')).toBeVisible();
    await expect(thead.getByText('Nama Barang')).toBeVisible();
    await expect(thead.getByText('Qty', { exact: true })).toBeVisible();
    await expect(thead.getByText('Keterangan')).toBeVisible();
    await expect(thead.getByText('Aksi')).toBeVisible();

    await expect(page.getByText('Qty Sistem')).toHaveCount(0);
    await expect(page.getByText('Qty Fisik')).toHaveCount(0);
    await expect(page.getByText('Blind Count')).toHaveCount(0);
    await expect(thead.getByText('Selisih')).toHaveCount(0);
  });

  test('2. Fast Scan Entry, Catalog Add, Inline Qty Stepper, Search, Sorting & Local Draft', async ({ page }) => {
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

    // Click "Baru" to clear the auto-populated catalog and start a focused worksheet
    await page.getByRole('button', { name: 'Baru', exact: true }).click();
    await expect(page.getByText('0 Barang', { exact: true })).toBeVisible();

    // Add Item A via Barcode/SKU input + Enter
    const scanInput = page.locator('input[placeholder="Scan Barcode / SKU..."]');
    const qtyEntryInput = page.locator('span:has-text("Qty:") + input[type="number"]');
    const noteInput = page.locator('input[placeholder="Catatan Opname..."]');

    await scanInput.fill(skuA);
    await qtyEntryInput.fill('12');
    await noteInput.fill('Rak Depan');
    await scanInput.press('Enter');

    await expect(page.getByText(`Alpha Opname Item ${suffix}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('1 Barang', { exact: true })).toBeVisible();
    await expect(page.getByText('12 Unit', { exact: true }).first()).toBeVisible();

    // Add Item B via Tambah button
    await scanInput.fill(skuB);
    await qtyEntryInput.fill('5');
    await noteInput.fill('Gudang Belakang');
    await page.getByRole('button', { name: 'Tambah', exact: true }).click();

    await expect(page.getByText(`Beta Opname Item ${suffix}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('2 Barang', { exact: true })).toBeVisible();
    await expect(page.getByText('17 Unit', { exact: true }).first()).toBeVisible();

    // Test inline stepper (+1 and -1) on the top row (Item B)
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.locator('button[title="Tambah 1"]').click();
    await expect(page.getByText('18 Unit', { exact: true }).first()).toBeVisible();

    await firstRow.locator('button[title="Kurangi 1"]').click();
    await expect(page.getByText('17 Unit', { exact: true }).first()).toBeVisible();

    // Test table search filter
    const searchInput = page.locator('input[placeholder="Filter tabel opname..."]');
    await searchInput.fill('Alpha');
    await expect(page.locator('table tbody tr')).toHaveCount(1);
    await expect(page.locator('table tbody tr').first()).toContainText(`Alpha Opname Item ${suffix}`);
    await searchInput.fill('');
    await expect(page.locator('table tbody tr')).toHaveCount(2);

    // Test column sorting by Qty
    const qtyHeader = page.locator('table thead th').filter({ hasText: /^Qty/ });
    await qtyHeader.click(); // asc: Beta (5) then Alpha (12)
    await expect(page.locator('table tbody tr').first()).toContainText(`Beta Opname Item ${suffix}`);
    await qtyHeader.click(); // desc: Alpha (12) then Beta (5)
    await expect(page.locator('table tbody tr').first()).toContainText(`Alpha Opname Item ${suffix}`);

    // Test Browser Draft Save & Load
    await page.getByRole('button', { name: 'Draft', exact: true }).click();
    await expect(page.getByText(/Draft stok opname berhasil disimpan/i)).toBeVisible();

    await page.getByRole('button', { name: 'Baru', exact: true }).click();
    await expect(page.getByText('0 Barang', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await expect(page.getByText('2 Barang', { exact: true })).toBeVisible();
    await expect(page.getByText('17 Unit', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('opname-status-badge')).toHaveText('DRAFT');
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

    // Start new opname worksheet
    await page.getByRole('button', { name: 'Baru', exact: true }).click();
    await expect(page.getByText('0 Barang', { exact: true })).toBeVisible();

    // Add the item with target Qty = 25
    const scanInput = page.locator('input[placeholder="Scan Barcode / SKU..."]');
    const qtyEntryInput = page.locator('span:has-text("Qty:") + input[type="number"]');
    const noteInput = page.locator('input[placeholder="Catatan Opname..."]');

    await scanInput.fill(sku);
    await qtyEntryInput.fill('25');
    await noteInput.fill('Audit Kuartal');
    await page.getByRole('button', { name: 'Tambah', exact: true }).click();

    await expect(page.getByText('25 Unit', { exact: true }).first()).toBeVisible({ timeout: 15000 });

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
    await loginAs(page, 'merry', '1111');

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
});
