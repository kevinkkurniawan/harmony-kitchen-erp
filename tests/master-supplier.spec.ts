import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openMasterSupplierMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Master Supplier")');
  if (!(await menuBtn.isVisible())) {
    await page.click('aside button:has-text("Master Data")');
  }
  await menuBtn.click();
  await expect(page.getByText('Total Supplier', { exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 6: Master Supplier — End-to-End Audit Suite', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openMasterSupplierMenu(page);
  });

  test('1. Renders 4 KPI cards, supplier table, and supports column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Verify 4 KPI cards
    await expect(page.getByText('Total Supplier', { exact: true })).toBeVisible();
    await expect(page.getByText('Supplier Aktif', { exact: true })).toBeVisible();
    await expect(page.getByText('Supplier PKP (Taxable)', { exact: true })).toBeVisible();
    await expect(page.getByText('Kota Jaringan Supplier', { exact: true })).toBeVisible();

    // Sort columns
    await page.click('th:has-text("Kode Supplier")');
    await page.click('th:has-text("Nama Supplier / Perusahaan")');
    await page.click('th:has-text("Status PKP")');
  });

  test('2. Full CRUD lifecycle: create with slash in input, search by city/phone, Hanya PKP filter, edit, context-menu toggle active, CSV export, and delete', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    const suffix = Date.now().toString().slice(-4);
    const supCode = `S9${suffix}`;
    const supName = `PT. E2E Supplier / Grosir ${suffix}`;
    const supCity = `Sidoarjo-${suffix}`;
    const supPhone = `031999${suffix}`;

    // Open Create Modal
    await page.click('button:has-text("Tambah Supplier")');
    await expect(page.locator('text=Tambah Supplier Baru')).toBeVisible();

    // Fill Kode Supplier and Nama Supplier (containing '/')
    await page.fill('input[placeholder="S00001"]', supCode);
    const nameInput = page.locator('input[placeholder="PT. RKM Utama / Paramount / CKU"]');
    await nameInput.click();
    await nameInput.type(supName);
    await expect(nameInput).toHaveValue(supName);

    // Fill Address, City, Phone1, Contact Person, NPWP, and check PKP
    await page.fill('input[placeholder="Jl. Raya Industri No. 88"]', 'Jl. Industri E2E No. 1');
    await page.fill('input[placeholder="Surabaya / Jakarta"]', supCity);
    await page.fill('input[placeholder="031-888999"]', supPhone);
    await page.fill('input[placeholder="Bpk. Budi Santoso"]', 'Bpk. E2E Sales');
    await page.fill('input[placeholder="01.234.567.8-012.000"]', '01.111.222.3-444.000');
    await page.locator('label:has-text("Pengusaha Kena Pajak (Status PKP)") input[type="checkbox"]').check();

    // Submit Create
    await page.click('button:has-text("Simpan Supplier")');
    await expect(page.locator('text=Supplier baru berhasil dibuat!')).toBeVisible({ timeout: 10000 });

    // Search by City (verifying expanded search on city)
    const searchInput = page.locator('input[placeholder*="Cari Supplier"]');
    await searchInput.fill(supCity);
    await page.waitForTimeout(700);
    await expect(page.locator('td', { hasText: supName })).toBeVisible({ timeout: 10000 });

    // Search by Phone (verifying expanded search on phone1)
    await searchInput.fill(supPhone);
    await page.waitForTimeout(700);
    const row = page.locator('tr', { hasText: supName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.locator('text=PKP')).toBeVisible();

    // Test Hanya PKP filter
    const pkpCheckbox = page.locator('label:has-text("Hanya PKP") input[type="checkbox"]');
    await pkpCheckbox.check();
    await expect(row).toBeVisible({ timeout: 10000 });
    await pkpCheckbox.uncheck();

    // Edit Supplier via row Edit button
    const editedName = `${supName} EDITED`;
    await row.locator('button[title="Edit Supplier"]').click();
    await expect(page.locator('text=Edit Data Supplier')).toBeVisible();
    await page.fill('input[placeholder="PT. RKM Utama / Paramount / CKU"]', editedName);
    await page.click('button:has-text("Simpan Supplier")');
    await expect(page.locator('text=Data supplier berhasil diperbarui!')).toBeVisible({ timeout: 10000 });

    const editedRow = page.locator('tr', { hasText: editedName });
    await expect(editedRow).toBeVisible({ timeout: 10000 });

    // Right-click context menu -> Toggle Status Aktif (sets to NON-AKTIF)
    await editedRow.click({ button: 'right' });
    await expect(page.locator('button:has-text("&Toggle Status Aktif")')).toBeVisible();
    await page.click('button:has-text("&Toggle Status Aktif")');
    await expect(page.locator('text=diubah menjadi NON-AKTIF')).toBeVisible({ timeout: 10000 });

    // Because 'Hanya Aktif' is checked by default, row should disappear
    await expect(page.locator('tr', { hasText: editedName })).toHaveCount(0, { timeout: 10000 });

    // Uncheck 'Hanya Aktif' -> row should reappear with NON-AKTIF badge
    const activeCheckbox = page.locator('label:has-text("Hanya Aktif") input[type="checkbox"]');
    await activeCheckbox.uncheck();
    await expect(editedRow).toBeVisible({ timeout: 10000 });
    await expect(editedRow.locator('text=NON-AKTIF')).toBeVisible();

    // Test Export CSV
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export CSV")'),
    ]);
    expect(download.suggestedFilename()).toContain('Master_Supplier_');

    // Delete Supplier
    page.once('dialog', (dialog: any) => dialog.accept());
    await editedRow.locator('button[title="Hapus Supplier"]').click();
    await expect(page.locator(`text=Supplier "${editedName}" berhasil dihapus`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('tr', { hasText: editedName })).toHaveCount(0);
  });
});
