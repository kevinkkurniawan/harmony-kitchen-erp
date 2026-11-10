import { test, expect, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openMasterPromoMenu(page: Page) {
  const menuBtn = page.locator('aside button:has-text("Master Promo")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Master Data")');
  }
  await menuBtn.click();
  await expect(page.locator('text=.:: Header ::.')).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 5: Master Promo — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openMasterPromoMenu(page);
  });

  test('1. Legacy Frm_Promo layout: Header group, global and grosir grids with old captions, grouped by Promo Name', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });

    await expect(page.getByText('Master Promo', { exact: true }).first()).toBeVisible();
    await expect(page.locator('button:has-text("New Promo")')).toBeVisible();
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();

    // Global promo grid (old GV_GroupPromo)
    for (const caption of ['Promo Global No.', 'Promo Global Name', 'Promo Percentage', 'Description', 'Aktif']) {
      await expect(page.locator(`th:has-text("${caption}")`).first()).toBeVisible();
    }
    // Grosir promo grid (old GV_Promo), rows grouped by Promo Name
    for (const caption of ['Promo Grosir', 'Qty Min', 'Qty Max', 'Keterangan']) {
      await expect(page.locator(`th:has-text("${caption}")`).first()).toBeVisible();
    }
    await expect(page.locator('td:has-text("Promo Name: ")').first()).toBeVisible();
    await expect(page.locator('td', { hasText: /^Grosir [123]$/ }).first()).toBeVisible();

    // New-only elements are gone
    await expect(page.locator('button:has-text("Export CSV")')).toHaveCount(0);
    await expect(page.locator('text=Hanya Promo Aktif')).toHaveCount(0);
    await expect(page.locator('text=Kelompok Group')).toHaveCount(0);
  });

  test('2. Grosir promo CRUD: slash in name, qtyMin > qtyMax validation, edit via right-click, Aktif, delete', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });

    const uniqueName = `E2E Rule / Grosir ${Date.now().toString().slice(-4)}`;

    // New Promo opens the Detail group
    await page.click('button:has-text("New Promo")');
    await expect(page.locator('text=.:: Detail ::.')).toBeVisible();
    await expect(page.locator('text=Promo Grosir Jumlah Barang')).toBeVisible();

    // Typing '/' must stay in the input
    const nameInput = page.locator('label:has-text("Promo Name:") input');
    await nameInput.click();
    await page.keyboard.type(uniqueName);
    await expect(nameInput).toHaveValue(uniqueName);

    // qtyMin > qtyMax is rejected
    const qtyMin = page.locator('label:has-text("Qty Min:") input');
    const qtyMax = page.locator('label:has-text("Qty Max:") input');
    await qtyMin.fill('50');
    await qtyMax.fill('10');
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Qty Minimum tidak boleh lebih besar dari Qty Maksimum')).toBeVisible();

    await qtyMin.fill('5');
    await qtyMax.fill('50');
    await page.locator('label:has-text("Keterangan Promo :") textarea').fill('E2E keterangan');
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Promo baru dibuat!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=.:: Detail ::.')).toHaveCount(0);

    // New row shows under its own Promo Name group
    await expect(page.locator(`td:has-text("Promo Name: ${uniqueName}")`)).toBeVisible({ timeout: 10000 });
    const row = page.locator('tr', { hasText: 'E2E keterangan' });
    await expect(row).toBeVisible();

    // Right-click -> Edit Promo, untick Aktif, Submit
    await row.click({ button: 'right' });
    await expect(page.locator('button:has-text("Add Promo")')).toBeVisible();
    await page.click('button:has-text("Edit Promo")');
    await expect(page.locator('label:has-text("Promo Name:") input')).toHaveValue(uniqueName);
    await page.locator('label:has-text("Aktif") input[type="checkbox"]').uncheck();
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=Promo diperbarui!')).toBeVisible({ timeout: 10000 });

    // Inactive rows stay listed (muted)
    await expect(row).toHaveClass(/line-through/, { timeout: 10000 });

    // Right-click -> Hapus Promo, confirm in the app dialog
    await row.click({ button: 'right' });
    await page.click('button:has-text("Hapus Promo")');
    await page.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(page.locator(`td:has-text("Promo Name: ${uniqueName}")`)).toHaveCount(0, { timeout: 10000 });
  });

  test('3. Global promo: Edit Promo opens the global detail with read-only Qty and Promo %', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });

    const globalRow = page.locator('table').first().locator('tbody tr').first();
    test.skip((await globalRow.locator('td').count()) < 2, 'No global promo rows in this database');

    await globalRow.click({ button: 'right' });
    await expect(page.locator('button:has-text("Add Promo")')).toHaveCount(0);
    await page.click('button:has-text("Edit Promo")');
    await expect(page.locator('text=.:: Detail ::.')).toBeVisible();
    await expect(page.locator('text=Promo Grosir Jumlah Barang')).toHaveCount(0);
    await expect(page.locator('label:has-text("Promo % :") input')).toBeDisabled();
    await expect(page.locator('label:has-text("Qty Min:") input')).toBeDisabled();

    // Back closes the Detail group without saving
    await page.click('button:has-text("Back")');
    await expect(page.locator('text=.:: Detail ::.')).toHaveCount(0);
  });

  test('4. Grosir tiers: New Promo picks the tier, Add Promo joins the same bundle, rename keeps the bundle together', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const name = `E2E Tier ${Date.now().toString().slice(-5)}`;
    const renamed = `${name} R`;
    const nameInput = page.locator('label:has-text("Promo Name:") input');
    const note = page.locator('label:has-text("Keterangan Promo :") textarea');
    const radio = (n: number) => page.getByRole('radio', { name: `Grosir ${n}` });
    const groupHeader = (promoName: string) => page.locator('td', { hasText: new RegExp(`^Promo Name: ${promoName}$`) });
    // Rows are found by their unique Keterangan
    const tierRow = (n: number) => page.locator('tr', { hasText: `${name} t${n}` });
    let bundle = 0;

    try {
      // New Promo: tier radio is selectable (default Grosir 1); pick Grosir 2
      await page.click('button:has-text("New Promo")');
      await expect(radio(1)).toBeChecked();
      await radio(2).check();
      await nameInput.fill(name);
      await note.fill(`${name} t2`);
      const created = page.waitForResponse((r) => r.url().endsWith('/api/promos/items') && r.request().method() === 'POST');
      await page.click('button:has-text("Submit")');
      const first = await (await created).json();
      expect(first.data.promogrosir).toBe(2);
      bundle = first.data.promobundle;

      // Add Promo on that row: same bundle, used tier disabled, first free tier preselected, name fixed
      await expect(tierRow(2)).toBeVisible({ timeout: 10000 });
      await tierRow(2).click({ button: 'right' });
      await page.click('button:has-text("Add Promo")');
      await expect(page.locator('label:has-text("Promo Bundle:") input')).toHaveValue(String(bundle));
      await expect(radio(2)).toBeDisabled();
      await expect(radio(1)).toBeChecked();
      await expect(nameInput).toBeDisabled();
      await page.getByRole('radiogroup', { name: 'Promo Grosir' }).getByText('Grosir 3', { exact: true }).click();
      await expect(radio(3)).toBeChecked();
      await note.fill(`${name} t3`);
      const added = page.waitForResponse((r) => r.url().endsWith('/api/promos/items') && r.request().method() === 'POST');
      await page.click('button:has-text("Submit")');
      const second = await (await added).json();
      expect(second.data.promobundle).toBe(bundle);
      expect(second.data.promogrosir).toBe(3);
      await expect(tierRow(3)).toBeVisible({ timeout: 10000 });
      await expect(groupHeader(name)).toHaveCount(1);

      // API: a duplicate tier in the bundle is refused, an out-of-range tier too
      const dup = await page.request.post('/api/promos/items', { data: { promoName: name, promoBundle: bundle, promoGrosir: 3, isGroup: false } });
      expect(dup.status()).toBe(409);
      const badTier = await page.request.post('/api/promos/items', { data: { promoName: name, promoBundle: bundle, promoGrosir: 4, isGroup: false } });
      expect(badTier.status()).toBe(400);

      // Rename one row (tier fixed in Edit): both tiers move to the new name, still one group
      await tierRow(2).click({ button: 'right' });
      await page.click('button:has-text("Edit Promo")');
      await expect(radio(2)).toBeChecked();
      await expect(radio(1)).toBeDisabled();
      await nameInput.fill(renamed);
      await page.click('button:has-text("Submit")');
      await expect(page.locator('text=Promo diperbarui!')).toBeVisible({ timeout: 10000 });
      await expect(groupHeader(renamed)).toHaveCount(1, { timeout: 10000 });
      await expect(groupHeader(name)).toHaveCount(0);
      const list = await (await page.request.get(`/api/promos/items?q=${encodeURIComponent(name)}`)).json();
      const names = list.data.filter((r: { promoBundle: number }) => r.promoBundle === bundle).map((r: { promoName: string }) => r.promoName);
      expect(names).toEqual([renamed, renamed]);
    } finally {
      // Clean up every row of the test bundle
      if (bundle) {
        const list = await (await page.request.get(`/api/promos/items?q=${encodeURIComponent(name)}`)).json();
        for (const r of list.data.filter((x: { promoBundle: number }) => x.promoBundle === bundle)) {
          await page.request.delete(`/api/promos/items/${r.id}`);
        }
      }
    }
  });
});
