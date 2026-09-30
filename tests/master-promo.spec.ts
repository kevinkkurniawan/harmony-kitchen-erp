import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openMasterPromoMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Master Promo")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Master Data")');
  }
  await menuBtn.click();
  await expect(page.locator('text=Total Aturan Promo')).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 5: Master Promo — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openMasterPromoMenu(page);
  });

  test('1. Renders KPI cards, Aturan Promo & Kelompok Group tabs, and column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Verify 3 summary cards are visible
    await expect(page.locator('text=Total Aturan Promo')).toBeVisible();
    await expect(page.getByText('Promo Aktif', { exact: true })).toBeVisible();
    await expect(page.locator('text=Kelompok Promo Group')).toBeVisible();

    // Sort columns
    await page.click('th:has-text("Nama Aturan Promo")');
    await page.click('th:has-text("Qty Min")');
    await page.click('th:has-text("Qty Max")');

    // Switch between Aturan Promo and Kelompok Group tabs
    await page.click('button:has-text("Kelompok Group (")');
    await expect(page.locator('th:has-text("Nama Kelompok Promo")')).toBeVisible();
    await page.click('button:has-text("Aturan Promo (")');
    await expect(page.locator('th:has-text("Nama Aturan Promo")')).toBeVisible();
  });

  test('2. Full CRUD on Aturan Promo: slash character input, qtyMin > qtyMax validation, Hanya Promo Aktif filter, and delete', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    const uniqueName = `E2E Rule / Grosir ${Date.now().toString().slice(-4)}`;

    // Open Create Rule Modal
    await page.click('button:has-text("Tambah Aturan Promo")');
    await expect(page.locator('span:has-text("Tambah Aturan Promo Baru")')).toBeVisible();

    // Type name with '/' to ensure '/' shortcut does not steal focus from modal input
    const nameInput = page.locator('input[placeholder*="Contoh: Tier Grosir"]');
    await nameInput.click();
    await page.keyboard.type(uniqueName);
    await expect(nameInput).toHaveValue(uniqueName);

    // Test invalid qtyMin > qtyMax validation
    const numberInputs = page.locator('form input[type="number"]');
    await numberInputs.nth(0).fill('50');
    await numberInputs.nth(1).fill('10');
    await page.click('button:has-text("Simpan Aturan Promo")');
    await expect(page.locator('text=Qty Minimum tidak boleh lebih besar dari Qty Maksimum')).toBeVisible();

    // Fix qtyMin <= qtyMax and save
    await numberInputs.nth(0).fill('5');
    await numberInputs.nth(1).fill('50');
    await page.click('button:has-text("Simpan Aturan Promo")');
    await expect(page.locator('span:has-text("Tambah Aturan Promo Baru")')).toHaveCount(0, { timeout: 10000 });

    // Search for our created rule
    const searchInput = page.locator('input[placeholder*="Cari Aturan Promo"]');
    await searchInput.fill(uniqueName);
    await expect(page.locator(`tbody tr:has-text("${uniqueName}")`)).toBeVisible({ timeout: 10000 });

    // Edit rule and set it to inactive
    await page.locator(`tbody tr:has-text("${uniqueName}") button[title="Edit Promo"]`).click();
    await expect(page.locator('span:has-text("Edit Aturan Promo")')).toBeVisible();
    await page.click('label:has-text("Status Promo Aktif")');
    await page.click('button:has-text("Simpan Aturan Promo")');
    await expect(page.locator('span:has-text("Edit Aturan Promo")')).toHaveCount(0, { timeout: 10000 });

    // Since "Hanya Promo Aktif" is checked by default, the now-inactive rule should be hidden!
    await expect(page.locator(`tbody tr:has-text("${uniqueName}")`)).toHaveCount(0, { timeout: 10000 });

    // Uncheck "Hanya Promo Aktif" -> inactive rule appears with NON-AKTIF badge
    await page.click('label:has-text("Hanya Promo Aktif")');
    const row = page.locator(`tbody tr:has-text("${uniqueName}")`);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('span:has-text("NON-AKTIF")')).toBeVisible();

    // Delete the rule
    page.once('dialog', (dialog: any) => dialog.accept());
    await row.locator('button[title="Hapus Promo"]').click();
    await expect(page.locator(`tbody tr:has-text("${uniqueName}")`)).toHaveCount(0, { timeout: 10000 });
  });

  test('3. Full CRUD on Kelompok Group: create, edit (persisted in DB), CSV export, and delete', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Switch to Kelompok Group tab
    await page.click('button:has-text("Kelompok Group (")');
    await expect(page.locator('th:has-text("Nama Kelompok Promo")')).toBeVisible();

    const groupName = `E2E Group ${Date.now().toString().slice(-4)}`;
    const updatedGroupName = `${groupName} Updated`;

    // Open Create Group modal
    await page.click('button:has-text("Tambah Kelompok Group")');
    await expect(page.locator('span:has-text("Tambah Kelompok Promo Baru")')).toBeVisible();

    await page.fill('input[placeholder*="Contoh: Promo Grosir Dapur Utama"]', groupName);
    await page.click('button:has-text("Simpan Kelompok Promo")');
    await expect(page.locator('span:has-text("Tambah Kelompok Promo Baru")')).toHaveCount(0, { timeout: 10000 });

    // Search for the created group
    const searchInput = page.locator('input[placeholder*="Cari Kelompok Promo"]');
    await searchInput.fill(groupName);
    const groupRow = page.locator(`tbody tr:has-text("${groupName}")`);
    await expect(groupRow).toBeVisible({ timeout: 10000 });

    // Click Edit Group -> verify input is populated with groupName, update it, and save
    await groupRow.locator('button[title="Edit Group"]').click();
    await expect(page.locator('span:has-text("Edit Kelompok Promo")')).toBeVisible();
    const groupNameInput = page.locator('input[placeholder*="Contoh: Promo Grosir Dapur Utama"]');
    await expect(groupNameInput).toHaveValue(groupName);
    await groupNameInput.fill(updatedGroupName);
    await page.click('button:has-text("Simpan Kelompok Promo")');
    await expect(page.locator('span:has-text("Edit Kelompok Promo")')).toHaveCount(0, { timeout: 10000 });

    // Verify updated group name is persisted in the table
    const updatedRow = page.locator(`tbody tr:has-text("${updatedGroupName}")`);
    await expect(updatedRow).toBeVisible({ timeout: 10000 });

    // Test Export CSV on Kelompok Group
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Export CSV")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^Master_Promo_Groups_\d{4}-\d{2}-\d{2}\.csv$/);

    // Delete the group and verify it is removed from DB
    page.once('dialog', (dialog: any) => dialog.accept());
    await updatedRow.locator('button[title="Hapus Group"]').click();
    await expect(page.locator(`tbody tr:has-text("${updatedGroupName}")`)).toHaveCount(0, { timeout: 10000 });
  });
});
