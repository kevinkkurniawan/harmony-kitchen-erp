import { test, expect, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openBarcodePrintMenu(page: Page) {
  const menuBtn = page.locator('aside button:has-text("Cetak Barcode")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Master Data")');
  }
  await menuBtn.click();
  await expect(page.locator('text=.: Barcode Print List :.')).toBeVisible({ timeout: 10000 });
}

// After a reload the menu is rendered open again; wait for it instead of toggling Master Data
async function reloadBarcodePage(page: Page) {
  await page.reload();
  const menuBtn = page.locator('aside button:has-text("Cetak Barcode")');
  await expect(menuBtn).toBeVisible({ timeout: 15000 });
  await menuBtn.click();
  await expect(page.locator('text=.: Barcode Print List :.')).toBeVisible({ timeout: 10000 });
}

const searchInput = (page: Page) => page.locator('label:has-text("Cari Barang :") input');

async function addBySearch(page: Page) {
  await searchInput(page).fill('BLG-PCD026');
  await expect(page.locator('text=Maslon Dutch Oven 26cm').first()).toBeVisible({ timeout: 10000 });
  await searchInput(page).press('Enter');
  await expect(page.locator('tbody td span[title="BLG-PCD026"]')).toBeVisible({ timeout: 10000 });
}

// The print list is saved in m_invprintbarcode (shared, like the old app): start every test from an empty list
async function clearList(page: Page) {
  const res = await page.request.delete('/api/barcode-list?all=1');
  expect(res.status()).toBe(200);
}

test.describe('Menu 4: Cetak Barcode — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await clearList(page);
    await openBarcodePrintMenu(page);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await clearList(page);
    await page.close();
  });

  test('1. Old Barcode Print List: Barcode | Inventory No | Qty grid and the old buttons', async ({ page }) => {
    const headers = page.locator('thead tr').first().locator('th');
    await expect(headers).toHaveText(['Barcode', 'Inventory No', 'Qty']);
    // Old order under the grid: Hapus Data List Barcode, Print A4, then the two roll buttons side by side
    const buttons = page.locator('button', { hasText: /^(Hapus Data List Barcode|Print A4|Barcode Print w\/o Price|Barcode Print With Price)$/ });
    await expect(buttons).toHaveText(['Hapus Data List Barcode', 'Print A4', 'Barcode Print w/o Price', 'Barcode Print With Price']);
    const del = await page.locator('button:has-text("Hapus Data List Barcode")').boundingBox();
    const a4 = await page.locator('button:has-text("Print A4")').boundingBox();
    const noPrice = await page.locator('button:has-text("Barcode Print w/o Price")').boundingBox();
    const withPrice = await page.locator('button:has-text("Barcode Print With Price")').boundingBox();
    expect(a4!.y).toBeGreaterThan(del!.y);
    expect(noPrice!.y).toBeGreaterThan(a4!.y);
    expect(Math.abs(noPrice!.y - withPrice!.y)).toBeLessThan(2);
    expect(withPrice!.x).toBeGreaterThan(noPrice!.x);
  });

  test('2. 3-column print rows: 1/2/3 labels fill row 1, 4 labels wrap to row 2', async ({ page }) => {
    await addBySearch(page);
    const qty = page.locator('tbody input[aria-label="Qty"]');
    const rows = page.locator('#print-label-area .barcode-label-row');
    const filledCells = page.locator('#print-label-area .barcode-label-cell:has([data-testid="barcode-svg"])');

    await expect(qty).toHaveValue('1');
    await expect(rows).toHaveCount(1);
    await expect(filledCells).toHaveCount(1);

    await qty.fill('3');
    await expect(rows).toHaveCount(1);
    await expect(filledCells).toHaveCount(3);

    await qty.fill('4');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('#print-label-area .barcode-label-cell')).toHaveCount(6);
    await expect(filledCells).toHaveCount(4);
  });

  test('3. Search empty state, scanner Enter adds, Enter again adds qty, Delete Row', async ({ page }) => {
    await searchInput(page).fill('ZZZZNONEXISTENT99999');
    await expect(page.locator('text=Barang tidak ditemukan untuk kata kunci')).toBeVisible({ timeout: 10000 });

    await addBySearch(page);
    await expect(page.locator('tbody tr')).toHaveCount(1);

    // Same item again -> qty 2, still one row
    await searchInput(page).fill('BLG-PCD026');
    await searchInput(page).press('Enter');
    await expect(page.locator('tbody input[aria-label="Qty"]')).toHaveValue('2', { timeout: 10000 });
    await expect(page.locator('tbody tr')).toHaveCount(1);

    // Right-click -> Delete Row
    await page.locator('tbody tr').first().click({ button: 'right' });
    await page.click('button:has-text("Delete Row")');
    await expect(page.locator('text=List barcode kosong.')).toBeVisible();
  });

  test('4. Print w/o Price and With Price: audit API call, price line follows the button, Hapus Data List Barcode', async ({ page }) => {
    await addBySearch(page);

    await page.evaluate(() => {
      (window as unknown as { __printCalled: number }).__printCalled = 0;
      window.print = () => {
        (window as unknown as { __printCalled: number }).__printCalled += 1;
      };
    });
    const cell0 = page.locator('#print-label-area .barcode-label-cell').first();

    const noPrice = page.waitForResponse((res) => res.url().includes('/api/barcode/print') && res.request().method() === 'POST');
    await page.click('button:has-text("Barcode Print w/o Price")');
    expect((await noPrice).status()).toBe(200);
    expect((await noPrice).request().postDataJSON().includePrice).toBe(false);
    await expect(cell0).not.toContainText('Rp ');

    const withPrice = page.waitForResponse((res) => res.url().includes('/api/barcode/print') && res.request().method() === 'POST');
    await page.click('button:has-text("Barcode Print With Price")');
    expect((await withPrice).request().postDataJSON().includePrice).toBe(true);
    await expect(cell0).toContainText('Rp ');
    expect(await page.evaluate(() => (window as unknown as { __printCalled: number }).__printCalled)).toBe(2);

    // Header Toko still toggles the store name on the label
    await expect(cell0).toContainText('HARMONY KITCHEN');
    await page.click('label:has-text("Header Toko")');
    await expect(cell0).not.toContainText('HARMONY KITCHEN');

    await page.click('button:has-text("Hapus Data List Barcode")');
    await expect(page.locator('text=List barcode kosong.')).toBeVisible();
  });

  test('5. Clearing the search drops a slow in-flight search: no spinner, no stale results', async ({ page }) => {
    // Hold the search response until the box has been cleared
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    await page.route('**/api/inventory?q=BLG-PCD026*', async (route) => {
      await held;
      await route.continue();
    });
    const spinner = page.locator('label:has-text("Cari Barang :") svg.animate-spin');

    await searchInput(page).fill('BLG-PCD026');
    await expect(spinner).toBeVisible({ timeout: 5000 });
    await searchInput(page).fill('');
    await expect(spinner).toHaveCount(0);
    const late = page.waitForResponse((r) => r.url().includes('/api/inventory?q=BLG-PCD026'));
    release();
    await late;

    // The late response must not come back under a new query
    await searchInput(page).fill('ZZZZNONEXISTENT99999');
    await expect(page.locator('text=Barang tidak ditemukan untuk kata kunci')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Maslon Dutch Oven 26cm')).toHaveCount(0);
  });

  test('6. The list is saved: it survives a reload, a Qty edit is stored when the cell is left', async ({ page }) => {
    await addBySearch(page);
    await reloadBarcodePage(page);
    const qty = page.locator('tbody input[aria-label="Qty"]');
    await expect(qty).toHaveValue('1', { timeout: 10000 });
    // Old grid: "Inventory No" shows the item name (the SP aliased the name), No. Barang as tooltip
    await expect(page.locator('tbody td span[title="BLG-PCD026"]')).toHaveText('Maslon Dutch Oven 26cm');

    const saved = page.waitForResponse((res) => res.url().endsWith('/api/barcode-list') && res.request().method() === 'PUT');
    await qty.fill('5');
    await qty.press('Enter');
    expect((await saved).status()).toBe(200);

    const list = await (await page.request.get('/api/barcode-list')).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({ inventoryNo: 'BLG-PCD026', qty: 5 });

    await reloadBarcodePage(page);
    await expect(page.locator('tbody input[aria-label="Qty"]')).toHaveValue('5', { timeout: 10000 });
  });

  test('7. Print A4: old Rpt_PrintOpname sheet, 3 columns of real barcodes, one cell per qty', async ({ page }) => {
    await addBySearch(page);
    await page.locator('tbody input[aria-label="Qty"]').fill('4');

    // Capture what the print dialog would get
    await page.evaluate(() => {
      const w = window as unknown as { __a4: { cells: number; bars: number; pages: number; css: string; text: string } };
      window.print = () => {
        const area = document.getElementById('print-label-area')!;
        w.__a4 = {
          cells: area.querySelectorAll('.a4-label').length,
          bars: area.querySelectorAll('.a4-label [data-testid="barcode-svg"]').length,
          pages: area.querySelectorAll('.a4-page').length,
          css: Array.from(document.querySelectorAll('style')).map((el) => el.textContent).join('\n'),
          text: area.textContent || '',
        };
      };
    });
    const audit = page.waitForResponse((res) => res.url().includes('/api/barcode/print') && res.request().method() === 'POST');
    await page.click('button:has-text("Print A4")');
    expect((await audit).request().postDataJSON()).toMatchObject({ labelSize: 'A4-3col', totalLabels: 4 });

    const a4 = await page.evaluate(() => (window as unknown as { __a4: { cells: number; bars: number; pages: number; css: string; text: string } }).__a4);
    expect(a4.cells).toBe(4);
    expect(a4.bars).toBe(4);
    expect(a4.pages).toBe(1);
    expect(a4.css).toContain('size: A4');
    expect(a4.text).toContain('Maslon Dutch Oven 26cm');
    expect(a4.text).not.toContain('Rp ');

    // The roll buttons switch back to the 108mm roll layout
    await page.click('button:has-text("Barcode Print w/o Price")');
    await expect(page.locator('#print-label-area .barcode-label-row')).toHaveCount(2);
  });

  test('8. Delete Row and Hapus Data List Barcode remove the saved rows, with the old messages', async ({ page }) => {
    await addBySearch(page);
    const removed = page.waitForResponse((res) => res.url().includes('/api/barcode-list?inventoryId=') && res.request().method() === 'DELETE');
    await page.locator('tbody tr').first().click({ button: 'right' });
    await page.click('button:has-text("Delete Row")');
    expect((await removed).status()).toBe(200);
    await expect(page.getByText('Perintah Hapus Berhasil: Maslon Dutch Oven 26cm DIHAPUS')).toBeVisible();
    expect((await (await page.request.get('/api/barcode-list')).json()).data).toHaveLength(0);

    await addBySearch(page);
    await page.click('button:has-text("Hapus Data List Barcode")');
    await expect(page.getByText('Perintah Hapus Berhasil: Menghapus Semua Daftar Antrian Cetak Barcode')).toBeVisible();
    await expect(page.locator('text=List barcode kosong.')).toBeVisible();
    expect((await (await page.request.get('/api/barcode-list')).json()).data).toHaveLength(0);
  });

  test('9. List API: bare DELETE removes nothing, bad qty is rejected, no session is 401', async ({ page, playwright }) => {
    await addBySearch(page);
    const bare = await page.request.delete('/api/barcode-list');
    expect(bare.status()).toBe(400);
    expect((await (await page.request.get('/api/barcode-list')).json()).data).toHaveLength(1);

    const { inventoryId } = (await (await page.request.get('/api/barcode-list')).json()).data[0];
    expect((await page.request.put('/api/barcode-list', { data: { inventoryId, qty: 0 } })).status()).toBe(400);
    expect((await page.request.post('/api/barcode-list', { data: { inventoryId: 0 } })).status()).toBe(400);

    const anon = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    expect((await anon.get('/api/barcode-list')).status()).toBe(401);
    await anon.dispose();
  });
});
