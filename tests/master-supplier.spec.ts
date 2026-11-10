import { test, expect, type Locator, type Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

// Scroll the row into view and let that scroll event fire first: the context menu closes on any scroll,
// and Playwright's own scroll-into-view during the right-click would otherwise close it right after it opens.
async function rightClick(page: Page, row: Locator) {
  await row.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await row.click({ button: 'right' });
}

async function openMasterSupplierMenu(page: Page) {
  const menuBtn = page.locator('aside button:has-text("Master Supplier")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Master Data")');
  }
  await menuBtn.click();
  await expect(page.locator('th:has-text("No. Supplier")')).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 6: Master Supplier — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openMasterSupplierMenu(page);
  });

  test('1. Legacy Frm_Supplier grid: old columns, no new-only extras, column sorting', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });

    const headers = page.locator('thead tr').first().locator('th');
    await expect(headers).toHaveText(['No. Supplier', 'Nama', 'Alamat', 'Kota', 'No. Kontak', 'Status']);

    await expect(page.locator('button:has-text("Export CSV")')).toHaveCount(0);
    await expect(page.locator('text=Hanya PKP')).toHaveCount(0);
    await expect(page.locator('text=Contact Person')).toHaveCount(0);

    await page.click('th:has-text("No. Supplier")');
    await page.click('th:has-text("Nama")');
    await page.click('th:has-text("Status")');
  });

  test('2. CRUD: New with slash in name, View Supplier Data edit, toggle active, Hapus Supplier', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });

    const suffix = Date.now().toString().slice(-4);
    const supCode = `S9${suffix}`;
    const supName = `PT. E2E Supplier / Grosir ${suffix}`;
    const supCity = `Sidoarjo-${suffix}`;
    const supPhone = `031999${suffix}`;

    // New opens the Detail group with the old labels
    await page.click('button:has-text("New")');
    await expect(page.locator('text=.:: Detail ::.')).toBeVisible();

    await page.locator('label:has-text("No. Supplier :") input').fill(supCode);
    const nameInput = page.locator('label:has-text("Nama Supplier :") input');
    await nameInput.click();
    await page.keyboard.type(supName);
    await expect(nameInput).toHaveValue(supName);
    await page.locator('label:has-text("Alamat :") input').fill('Jl. Industri E2E No. 1');
    await page.locator('label:has-text("Kota :") input').fill(supCity);
    await page.locator('label:has-text("No. Kontak :") input').fill(supPhone);

    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Supplier baru berhasil dibuat!')).toBeVisible({ timeout: 10000 });

    const row = page.locator('tr', { hasText: supName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(supCity);
    await expect(row).toContainText(supPhone);

    // Right-click -> View Supplier Data -> edit name -> Save
    const editedName = `${supName} EDITED`;
    await rightClick(page, row);
    await page.click('button:has-text("View Supplier Data")');
    await expect(page.locator('label:has-text("Nama Supplier :") input')).toHaveValue(supName);
    await page.locator('label:has-text("Nama Supplier :") input').fill(editedName);
    await page.click('button:has-text("Save")');
    await expect(page.locator('text=Data supplier berhasil diperbarui!')).toBeVisible({ timeout: 10000 });

    const editedRow = page.locator('tr', { hasText: editedName });
    await expect(editedRow).toBeVisible({ timeout: 10000 });

    // Right-click -> Non Aktifkan Supplier: row stays, Status unchecked
    await rightClick(page, editedRow);
    await page.click('button:has-text("Non Aktifkan Supplier")');
    await expect(page.locator('text=diubah menjadi NON-AKTIF')).toBeVisible({ timeout: 10000 });
    await expect(editedRow.locator('input[type="checkbox"]')).not.toBeChecked({ timeout: 10000 });

    // Right-click -> Hapus Supplier, confirm in the app dialog
    await rightClick(page, editedRow);
    await page.click('button:has-text("Hapus Supplier")');
    await page.getByRole('button', { name: 'Hapus', exact: true }).click();
    await expect(page.locator(`text=Supplier "${editedName}" berhasil dihapus`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('tr', { hasText: editedName })).toHaveCount(0);
  });
});
