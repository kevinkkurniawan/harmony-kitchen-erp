import { test, expect } from '@playwright/test';
import { Client } from 'pg';

const MOCK_LOOKUPS = {
  success: true,
  data: {
    brands: [
      { id: 1, brandName: 'Maspion' },
      { id: 2, brandName: 'Maxim' },
    ],
    categories: [
      { id: 1, categoryName: 'Panci' },
      { id: 2, categoryName: 'Wajan' },
    ],
    productTypes: [
      { id: 1, productName: 'Cookware' },
      { id: 2, productName: 'Glassware' },
    ],
    uoms: [
      { id: 1, uomName: 'PCS' },
      { id: 2, uomName: 'SET' },
    ],
    wholesaleCategories: [
      {
        id: 1,
        code: 'STD',
        name: 'Standard Grosir',
        tier1_minqty: 3,
        tier2_minqty: 6,
        tier3_minqty: 12,
      },
      {
        id: 2,
        code: 'LUSIN',
        name: 'Grosir Lusinan',
        tier1_minqty: 6,
        tier2_minqty: 12,
        tier3_minqty: 24,
      },
    ],
  },
};

const MOCK_PRODUCTS = [
  {
    id: '101',
    inventoryNo: 'MSP-PN-24',
    barcode: '8990001000101',
    inventoryName: 'Panci Maspion 24cm',
    inventoryBrandId: 1,
    brandName: 'Maspion',
    inventoryProductId: 1,
    productName: 'Cookware',
    uoMId: 1,
    uomName: 'PCS',
    wholesaleCategoryId: 1,
    wholesaleCategoryName: 'Standard Grosir',
    wholesaleCategory: {
      id: 1,
      code: 'STD',
      name: 'Standard Grosir',
      tier1_minqty: 3,
      tier2_minqty: 6,
      tier3_minqty: 12,
    },
    kodeHarga: 'STD',
    description: 'Panci aluminium tebal',
    price: 85000,
    hpp: 65000,
    priceBuy: 64000,
    grosir1: 82000,
    grosir2: 79000,
    grosir3: 75000,
    stokAwal: 10,
    stokAkhir: 25,
    isActive: true,
  },
  {
    id: '102',
    inventoryNo: 'MXM-WJ-30',
    barcode: '8990001000102',
    inventoryName: 'Wajan Maxim Teflon 30cm',
    inventoryBrandId: 2,
    brandName: 'Maxim',
    inventoryProductId: 1,
    productName: 'Cookware',
    uoMId: 1,
    uomName: 'PCS',
    wholesaleCategoryId: 2,
    wholesaleCategoryName: 'Grosir Lusinan',
    wholesaleCategory: {
      id: 2,
      code: 'LUSIN',
      name: 'Grosir Lusinan',
      tier1_minqty: 6,
      tier2_minqty: 12,
      tier3_minqty: 24,
    },
    kodeHarga: 'STD',
    description: 'Wajan anti lengket',
    price: 150000,
    hpp: 115000,
    priceBuy: 110000,
    grosir1: 145000,
    grosir2: 140000,
    grosir3: 135000,
    stokAwal: 5,
    stokAkhir: -2,
    isActive: true,
  },
];

const SEARCH = 'input[placeholder="-- Ketik di sini untuk filter pencarian"]';

// Movement rows of the stock card (newest first): two months, so the monthly summary has two rows
const MOCK_MOVEMENT = {
  success: true,
  data: [
    { id: 'sale-2', date: '2026-10-20T03:00:00.000Z', transactionNo: 'POS-0002', type: 'Penjualan', qtyIn: 0, qtyOut: 2, price: 0, balance: 25 },
    { id: 'receive-1', date: '2026-09-15T03:00:00.000Z', transactionNo: 'MR-2026-0001', type: 'Penerimaan', qtyIn: 10, qtyOut: 0, price: 0, balance: 27 },
  ],
  total: 2,
  currentStock: 25,
  lastOpnameDate: null,
};

// Old GV_HPP rows of "Detail Barang" (GET /api/inventory/[id]/hpp-history)
const MOCK_HPP = {
  success: true,
  data: [
    { id: 9, mrNo: 'MR-RCV-0009', mrDate: '2026-10-02', supplierName: 'PT Maspion', hpp: 66600 },
    { id: 8, mrNo: 'MR-EXP-0008', mrDate: '2026-09-01', supplierName: 'CV Ekspres', hpp: null },
  ],
};

function mockTotals(rows: typeof MOCK_PRODUCTS) {
  return rows.reduce(
    (acc, p) => ({
      stock: acc.stock + p.stokAkhir,
      stockValue: acc.stockValue + p.stokAkhir * p.priceBuy,
      retailValue: acc.retailValue + p.stokAkhir * p.price,
    }),
    { stock: 0, stockValue: 0, retailValue: 0 }
  );
}

// Legacy Master_Data.Frm_Inventory ("Master Barang")
test.describe('Master Barang E2E Suite (Admin Role)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          user: { id: 5, username: 'admin', fullName: 'Admin ERP', userLevel: 'Admin', isActive: true },
          permissions: [],
        },
      });
    });

    await page.route('**/api/inventory/lookups', async (route) => {
      await route.fulfill({ json: MOCK_LOOKUPS });
    });

    await page.route('**/api/inventory/*/movement*', async (route) => {
      await route.fulfill({ json: MOCK_MOVEMENT });
    });

    await page.route('**/api/inventory/*/hpp-history', async (route) => {
      await route.fulfill({ json: MOCK_HPP });
    });

    await page.route('**/api/inventory?*', async (route) => {
      const url = new URL(route.request().url());
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const status = url.searchParams.get('status') || 'active';
      const minusStock = url.searchParams.get('minusStock') === 'true';
      const fName = (url.searchParams.get('f_inventoryname') || '').toLowerCase();
      const fSku = (url.searchParams.get('f_inventoryno') || '').toLowerCase();
      const sort = url.searchParams.get('sort');
      const desc = url.searchParams.get('order') === 'desc';

      let filtered = [...MOCK_PRODUCTS];
      if (status === 'active') filtered = filtered.filter((p) => p.isActive);
      if (minusStock) filtered = filtered.filter((p) => p.stokAkhir < 0);
      if (fName) filtered = filtered.filter((p) => p.inventoryName.toLowerCase().includes(fName));
      if (fSku) filtered = filtered.filter((p) => p.inventoryNo.toLowerCase().includes(fSku));
      if (q) {
        filtered = filtered.filter(
          (p) =>
            p.inventoryName.toLowerCase().includes(q) ||
            p.inventoryNo.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)
        );
      }
      if (sort === 'price') filtered.sort((a, b) => (desc ? b.price - a.price : a.price - b.price));

      await route.fulfill({
        json: {
          success: true,
          data: filtered,
          pagination: { total: filtered.length, page: 1, limit: 1000 },
          ...(url.searchParams.get('totals') === 'true' ? { totals: mockTotals(filtered) } : {}),
        },
      });
    });

    await page.goto('/');
    await expect(page.locator(SEARCH)).toBeVisible();
  });

  test('1. Legacy title, toolbar, columns in order and footer totals', async ({ page }) => {
    await expect(page.getByText('Master Barang', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Cari Barang :', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible();
    await expect(page.getByLabel('Tampilkan Barang Aktif Saja')).toBeChecked();
    await expect(page.getByLabel('Tampilkan Stok Minus')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Show Detail', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Laporan Stok', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Data', exact: true })).toBeVisible();

    // Legacy GV_Inventory columns (admin sees Harga Beli / Total H.Stok); the 5th is the Aktif check column
    const headers = page.locator('main table').first().locator('thead tr').first().locator('th');
    await expect(headers).toHaveText(['No. Barang', 'Barcode', 'Nama', 'Stok', '', 'Harga Retail', 'Harga Beli', 'Total H.Stok', 'Total H.Jual']);

    // Footer sums come from the server totals: Stok 25 + -2 = 23; Total H.Jual = 25*85000 - 2*150000
    const footer = page.locator('main table').first().locator('tfoot td');
    await expect(footer.nth(3)).toHaveText('23');
    await expect(footer.nth(8)).toHaveText('1.825.000');

    // New-only UI removed
    await expect(page.locator('button', { hasText: 'Tambah Barang' })).toHaveCount(0);
    await expect(page.locator('button', { hasText: 'Export Excel' })).toHaveCount(0);
    await expect(page.locator('a[href="/inventory/barcode"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nonaktif', exact: true })).toHaveCount(0);
    await expect(headers.filter({ hasText: 'Aksi' })).toHaveCount(0);
    await expect(headers.filter({ hasText: 'S. Gudang' })).toHaveCount(0);
  });

  test('2. Search, "/" shortcut, checkboxes, column filter row and server sorting', async ({ page }) => {
    const rows = page.locator('main table').first().locator('tbody tr');
    const searchInput = page.locator(SEARCH);

    await page.locator('body').click();
    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();
    await searchInput.fill('GN 1/2');
    await expect(searchInput).toHaveValue('GN 1/2');
    await searchInput.fill('');
    await expect(rows).toHaveCount(2);

    // Tampilkan Stok Minus -> only negative stock
    await page.getByLabel('Tampilkan Stok Minus').check();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('MXM-WJ-30');
    await page.getByLabel('Tampilkan Stok Minus').uncheck();
    await expect(rows).toHaveCount(2);

    // Unticking "Tampilkan Barang Aktif Saja" asks for every item (status=all)
    const allResponse = page.waitForResponse((res) => res.url().includes('/api/inventory?') && res.url().includes('status=all'));
    await page.getByLabel('Tampilkan Barang Aktif Saja').uncheck();
    expect((await allResponse).ok()).toBe(true);

    // Auto-filter row (sent as f_* params)
    const nameFilter = page.locator('input[aria-label="Filter inventoryname"]');
    await nameFilter.fill('maspion');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Panci Maspion 24cm');
    await nameFilter.fill('');
    await expect(rows).toHaveCount(2);

    // Harga Retail asc -> desc (server sort)
    const priceHeader = page.locator('thead th', { hasText: 'Harga Retail' });
    await priceHeader.click();
    await expect(rows.first()).toContainText('MSP-PN-24');
    await priceHeader.click();
    await expect(rows.first()).toContainText('MXM-WJ-30');
  });

  test('3. Show Detail: monthly summary, Tambahkan Stok Opname and Reset Stok ke Nol', async ({ page }) => {
    await page.locator('main table').first().locator('tbody tr').nth(1).click();
    await page.getByRole('button', { name: 'Show Detail', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hide Detail', exact: true })).toBeVisible();
    await expect(page.getByTitle('Wajan Maxim Teflon 30cm', { exact: true })).toBeVisible();

    // Bulan / Tahun / Qty: one row per month; clicking a month shows its transactions
    await expect(page.locator('th', { hasText: 'Bulan' })).toBeVisible();
    await page.locator('td', { hasText: 'Oktober' }).click();
    await expect(page.locator('td', { hasText: 'POS-0002' })).toBeVisible();

    const opnamePayloads: any[] = [];
    await page.route('**/api/inventory/opname', async (route) => {
      opnamePayloads.push(route.request().postDataJSON());
      await route.fulfill({ json: { success: true, message: 'Opname berhasil' } });
    });

    await page.locator('#input-opname').fill('15');
    await page.getByRole('button', { name: 'Tambahkan Stok Opname' }).click();
    await expect.poll(() => opnamePayloads.length).toBe(1);
    expect(opnamePayloads[0]).toMatchObject({ action: 'POST_DIRECT', inventoryId: '102', qtyOpname: 15, mode: 'add' });

    // Reset asks for confirmation, then sets the stock to 0
    await page.getByRole('button', { name: 'Reset Stok ke Nol' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Reset' }).click();
    await expect.poll(() => opnamePayloads.length).toBe(2);
    expect(opnamePayloads[1]).toMatchObject({ action: 'POST_DIRECT', inventoryId: '102', qtyOpname: 0, mode: 'set' });
  });

  test('4. New row: edit form with legacy labels, error preservation and save', async ({ page }) => {
    await page.getByRole('button', { name: 'Click here to add a new row' }).click();

    for (const label of ['No. Barang :', 'Barcode :', 'Nama Barang :', 'Merk :', 'Kategori :', 'Satuan :', 'Harga Retail :', 'Harga Beli :', 'Keterangan :']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByLabel('Barang Aktif', { exact: true })).toBeChecked();

    const nameInput = page.getByLabel('Nama Barang :');
    await nameInput.fill('   panci   supra   20cm  ');
    await nameInput.blur();
    await expect(nameInput).toHaveValue('panci supra 20cm');

    let shouldFail = true;
    let savedPayload: any = null;
    await page.route('**/api/inventory', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (shouldFail) {
        await route.fulfill({ status: 400, json: { success: false, error: { code: 'VALIDATION_ERROR', message: 'SKU sudah terdaftar di database' } } });
      } else {
        savedPayload = route.request().postDataJSON();
        await route.fulfill({ status: 201, json: { success: true, data: { id: 999 } } });
      }
    });

    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(page.locator('span', { hasText: 'Gagal menyimpan: SKU sudah terdaftar di database' })).toBeVisible();
    await expect(nameInput).toHaveValue('panci supra 20cm');

    shouldFail = false;
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect.poll(() => savedPayload).not.toBeNull();
    expect(savedPayload.inventoryName).toBe('panci supra 20cm');
    await expect(page.getByRole('button', { name: 'Update', exact: true })).toBeHidden();
  });

  test('5. Double-click edit, right-click menu (Detail Barang, Stok Opname, Hapus Barang)', async ({ page }) => {
    const firstRow = page.locator('main table').first().locator('tbody tr').first();

    // Double-click opens the edit form on that item
    await firstRow.dblclick();
    await expect(page.getByLabel('Nama Barang :')).toHaveValue('Panci Maspion 24cm');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByLabel('Nama Barang :')).toHaveCount(0);

    // Legacy popup menu items, in order; no Duplikat / Set Non-Aktif
    await firstRow.click({ button: 'right' });
    const menu = page.locator('div.fixed.z-50').filter({ hasText: 'Hapus Barang' });
    await expect(menu.locator('button')).toHaveText(['Hapus Barang', 'Detail Barang', 'Stok Opname', 'Cetak Barcode']);

    // Detail Barang window: Mode / No. Transaksi / Tgl. Transaksi / Masuk / Keluar
    await menu.getByRole('button', { name: 'Detail Barang' }).click();
    const dialog = page.getByRole('dialog', { name: 'Detail Barang' });
    await expect(dialog.locator('table').first().locator('thead th')).toHaveText(['Mode', 'No. Transaksi', 'Tgl. Transaksi', 'Masuk', 'Keluar']);
    await expect(dialog.locator('td', { hasText: 'MR-2026-0001' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Stok Opname opens Show Detail on that item
    await firstRow.click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Stok Opname' }).click();
    await expect(page.getByRole('button', { name: 'Hide Detail', exact: true })).toBeVisible();
    await expect(page.locator('#input-opname')).toBeFocused();

    // Hapus Barang uses the existing confirm dialog
    let deletedId = '';
    await page.route('**/api/inventory/101', async (route) => {
      if (route.request().method() === 'DELETE') deletedId = '101';
      await route.fulfill({ json: { success: true } });
    });
    await firstRow.click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Hapus Barang' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus' }).click();
    await expect.poll(() => deletedId).toBe('101');
  });

  test('6. Laporan Stok opens the Laporan Stok Akhir report and closes', async ({ page }) => {
    await page.getByRole('button', { name: 'Laporan Stok', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Laporan Stok Akhir' });
    await expect(dialog.locator('thead th')).toHaveText(['PLU', 'Barcode', 'Nama Barang', 'H. Jual', 'Stok', 'IN HPP', 'IN H. Jual']);
    await expect(dialog.locator('tbody tr')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
  test('9. Aktif toggle and edit keep an empty stored barcode (no copy of the No. Barang)', async ({ page }) => {
    // GET shows the No. Barang as barcode when none is stored; rawBarcode is the stored value
    await page.route('**/api/inventory?*', async (route) => {
      const data = MOCK_PRODUCTS.map((p, i) => (i === 0 ? { ...p, barcode: p.inventoryNo, rawBarcode: '' } : { ...p, rawBarcode: p.barcode }));
      await route.fulfill({ json: { success: true, data, pagination: { total: data.length, page: 1, limit: 100 }, totals: mockTotals(data) } });
    });
    const puts: Record<string, unknown>[] = [];
    await page.route('**/api/inventory/101', async (route) => {
      if (route.request().method() === 'PUT') puts.push(route.request().postDataJSON());
      await route.fulfill({ json: { success: true } });
    });
    await page.getByRole('button', { name: 'Refresh' }).click();
    const firstRow = page.locator('main table').first().locator('tbody tr').first();
    await expect(firstRow).toContainText('MSP-PN-24');

    await page.getByLabel('Aktif MSP-PN-24').click();
    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0]).toEqual({ isActive: false });

    await firstRow.dblclick();
    await expect(page.getByLabel('Barcode :')).toHaveValue('');
    await page.getByRole('button', { name: 'Update', exact: true }).click();
    await expect.poll(() => puts.length).toBe(2);
    expect(puts[1].inventoryName).toBe('Panci Maspion 24cm');
    expect(puts[1]).not.toHaveProperty('barcode');
    expect(puts[1]).not.toHaveProperty('inventoryNo');
  });

  test('10. A reload that removes the last page moves to the new last page', async ({ page }) => {
    let total = 250;
    const requestedPages: number[] = [];
    await page.route('**/api/inventory?*', async (route) => {
      const url = new URL(route.request().url());
      const pageNo = Number(url.searchParams.get('page'));
      requestedPages.push(pageNo);
      const data = pageNo <= Math.ceil(total / 100) ? MOCK_PRODUCTS : [];
      await route.fulfill({ json: { success: true, data, pagination: { total, page: pageNo, limit: 100 }, totals: mockTotals(MOCK_PRODUCTS) } });
    });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Halaman 1 / 3')).toBeVisible();
    await page.getByRole('button', { name: 'Berikutnya' }).click();
    await page.getByRole('button', { name: 'Berikutnya' }).click();
    await expect(page.getByText('Halaman 3 / 3')).toBeVisible();

    // e.g. items deleted / deactivated elsewhere: page 3 no longer exists
    total = 150;
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Halaman 2 / 2')).toBeVisible();
    await expect(page.locator('main table').first().locator('tbody tr')).toHaveCount(2);
    expect(requestedPages.at(-1)).toBe(2);
  });

  test('11. Show Detail and Detail Barang say when only the newest movements are shown', async ({ page }) => {
    await page.route('**/api/inventory/*/movement*', async (route) => {
      await route.fulfill({ json: { ...MOCK_MOVEMENT, total: 7500 } });
    });
    await page.getByRole('button', { name: 'Show Detail', exact: true }).click();
    await expect(page.getByText('Menampilkan 2 dari 7.500 mutasi terbaru.')).toBeVisible();

    await page.locator('main table').first().locator('tbody tr').first().click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Detail Barang' }).click();
    await expect(page.getByRole('dialog', { name: 'Detail Barang' }).getByText('Menampilkan 2 dari 7.500 mutasi terbaru.')).toBeVisible();
  });
  test('12. Right-click Cetak Barcode: old confirm, adds the item to the saved print list, old alert text', async ({ page }) => {
    const posted: unknown[] = [];
    await page.route('**/api/barcode-list', async (route) => {
      if (route.request().method() === 'POST') posted.push(route.request().postDataJSON());
      await route.fulfill({ json: { success: true, data: { inventoryId: 101 } } });
    });
    const firstRow = page.locator('main table').first().locator('tbody tr').first();

    // "No" (Batal) adds nothing
    await firstRow.click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Cetak Barcode' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm.getByText('Confirmation', { exact: true })).toBeVisible();
    await expect(confirm.getByText('Benar Barang Ini Yang Anda Maksud?')).toBeVisible();
    await confirm.getByRole('button', { name: 'Batal' }).click();
    expect(posted).toHaveLength(0);

    await firstRow.click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Cetak Barcode' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes' }).click();
    // Old alert: "Perintah Masukan Berhasil" + Description + " DITAMBAHKAN"
    await expect(page.getByText('Perintah Masukan Berhasil: Panci aluminium tebal DITAMBAHKAN')).toBeVisible();
    expect(posted).toEqual([{ inventoryId: 101 }]);
  });

  test('13. Detail Barang: purchase prices (No. Pembelian | Tgl. Beli | Supplier | Harga Beli) right of the history', async ({ page }) => {
    await page.locator('main table').first().locator('tbody tr').first().click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Detail Barang' }).click();
    const dialog = page.getByRole('dialog', { name: 'Detail Barang' });
    const hpp = dialog.getByTestId('hpp-history');
    await expect(hpp.locator('thead th')).toHaveText(['No. Pembelian', 'Tgl. Beli', 'Supplier', 'Harga Beli']);
    await expect(hpp.locator('tbody tr').first()).toContainText('MR-RCV-0009');
    await expect(hpp.locator('tbody tr').first()).toContainText('PT Maspion');
    await expect(hpp.locator('tbody tr').first()).toContainText('66.600');
    // A receipt without prices shows an empty Harga Beli, like the old SP
    await expect(hpp.locator('tbody tr').nth(1).locator('td').last()).toHaveText('');

    const history = await dialog.locator('table').first().boundingBox();
    const hppBox = await hpp.boundingBox();
    expect(hppBox!.x).toBeGreaterThan(history!.x + history!.width - 1);
  });
});

test.describe('Master Barang E2E Suite (Restricted Non-Admin Role without HPP Permission)', () => {
  test('7. Purchase-price columns and cost inputs are hidden without view-hpp / canViewPrice', async ({ page }) => {
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          user: { id: 1, username: 'merry', fullName: 'Merry Kasir', userLevel: 'Kasir', isActive: true },
          permissions: [
            { moduleCode: 'master-barang', canView: true, canViewPrice: false },
            { moduleCode: 'view-hpp', canView: false },
          ],
        },
      });
    });
    await page.route('**/api/inventory/lookups', async (route) => {
      await route.fulfill({ json: MOCK_LOOKUPS });
    });
    await page.route('**/api/inventory?*', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: MOCK_PRODUCTS.map((p) => ({ ...p, hpp: 0, priceBuy: 0 })),
          pagination: { total: 2, page: 1, limit: 1000 },
          totals: { stock: 23, stockValue: 0, retailValue: 1825000 },
        },
      });
    });

    await page.goto('/');
    await expect(page.locator(SEARCH)).toBeVisible();

    await expect(page.locator('thead th', { hasText: 'Harga Beli' })).toHaveCount(0);
    await expect(page.locator('thead th', { hasText: 'Total H.Stok' })).toHaveCount(0);
    await expect(page.locator('thead th', { hasText: 'Total H.Jual' })).toBeVisible();

    await page.getByRole('button', { name: 'Click here to add a new row' }).click();
    await expect(page.getByText('Nama Barang :', { exact: true })).toBeVisible();
    await expect(page.getByText('Harga Beli :', { exact: true })).toHaveCount(0);
    await expect(page.getByText('HPP :', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Detail Barang without HPP rights: history only, the purchase-price grid is not even requested
    let hppRequested = false;
    await page.route('**/api/inventory/*/hpp-history', async (route) => {
      hppRequested = true;
      await route.fulfill({ json: MOCK_HPP });
    });
    await page.route('**/api/inventory/*/movement*', async (route) => {
      await route.fulfill({ json: MOCK_MOVEMENT });
    });
    await page.locator('main table').first().locator('tbody tr').first().click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Detail Barang' }).click();
    const dialog = page.getByRole('dialog', { name: 'Detail Barang' });
    await expect(dialog.locator('td', { hasText: 'MR-2026-0001' })).toBeVisible();
    await expect(dialog.getByTestId('hpp-history')).toHaveCount(0);
    await expect(dialog.getByText('No. Pembelian')).toHaveCount(0);
    expect(hppRequested).toBe(false);
  });
});

test.describe('Master Barang Real Database & API Integration', () => {
  test('8. Real login and live inventory query with Minus Stock consistency and footer totals', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Username"]', 'admin');
    await page.fill('input[placeholder="••••••••"]', '5555');
    await page.click('button:has-text("Log on")');

    await expect(page.locator(SEARCH)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('main table').first().locator('tbody tr').first()).toBeVisible({ timeout: 15000 });

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/inventory') && res.url().includes('minusStock=true')),
      page.getByLabel('Tampilkan Stok Minus').check(),
    ]);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    for (const item of json.data.slice(0, 10)) {
      expect(item.stokAkhir).toBeLessThan(0);
    }
    // A filter change asks for the footer totals of all matching items
    expect(json.totals.stock).toBeLessThan(0);
  });

  test('14. Real DB: hpp-history follows sp_MDInventory_GetHPPHistory; Cetak Barcode writes the print list', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder="Enter Username"]', 'admin');
    await page.fill('input[placeholder="••••••••"]', '5555');
    await page.click('button:has-text("Log on")');
    await expect(page.locator(SEARCH)).toBeVisible({ timeout: 15000 });

    // Item 251 has many goods receipts in the local copy
    const res = await page.request.get('/api/inventory/251/hpp-history');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    for (const row of json.data) {
      expect(Object.keys(row).sort()).toEqual(['hpp', 'id', 'mrDate', 'mrNo', 'supplierName']);
      if (row.hpp !== null) expect(typeof row.hpp).toBe('number');
    }
    // Newest receipt first
    const dates = json.data.map((r: { mrDate: string | null }) => r.mrDate || '');
    expect([...dates].sort().reverse()).toEqual(dates);

    // Same rows and Harga Beli as the old SP formula run directly on the local copy
    const dbUrl = process.env.DATABASE_URL || '';
    if (/@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
      const db = new Client({ connectionString: dbUrl });
      await db.connect();
      try {
        const { rows } = await db.query(`
          SELECT th.mrno, ROUND(td.subtotal / NULLIF(td.qty, 0) + COALESCE(td.incometaxpercentage, 0) * (td.subtotal / NULLIF(td.qty, 0)) / 100)::float8 AS hpp
          FROM t_materialreceivedetail td JOIN t_materialreceiveheader th ON th.id = td.mrid
          WHERE td.inventoryid = '251' AND COALESCE(th.isvoid, false) = false`);
        expect(rows.length).toBeGreaterThan(0);
        const expected = new Map(rows.map((r) => [r.mrno, r.hpp]));
        expect(json.data).toHaveLength(rows.length);
        for (const row of json.data) expect(row.hpp).toBe(expected.get(row.mrNo) ?? null);
      } finally {
        await db.end();
      }
    }

    // Right-click Cetak Barcode on the first grid row -> saved list has that item
    const firstRow = page.locator('main table').first().locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    const before = (await (await page.request.get('/api/barcode-list')).json()).data as { inventoryNo: string; qty: number }[];
    const rowNo = (await firstRow.locator('td').first().textContent())?.trim() || '';
    await firstRow.click({ button: 'right' });
    await page.locator('div.fixed.z-50').getByRole('button', { name: 'Cetak Barcode' }).click();
    const added = page.waitForResponse((r) => r.url().endsWith('/api/barcode-list') && r.request().method() === 'POST');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes' }).click();
    const addedJson = await (await added).json();
    expect(addedJson.success).toBe(true);
    await expect(page.getByText(/^Perintah Masukan Berhasil: .+ DITAMBAHKAN$/)).toBeVisible();
    const after = (await (await page.request.get('/api/barcode-list')).json()).data as { inventoryNo: string; qty: number }[];
    const prevQty = before.find((r) => r.inventoryNo === rowNo)?.qty || 0;
    expect(after.find((r) => r.inventoryNo === rowNo)?.qty).toBe(prevQty + 1);

    // Leave the list as it was
    if (prevQty === 0) await page.request.delete(`/api/barcode-list?inventoryId=${addedJson.data.inventoryId}`);
    else await page.request.put('/api/barcode-list', { data: { inventoryId: addedJson.data.inventoryId, qty: prevQty } });
  });
});
