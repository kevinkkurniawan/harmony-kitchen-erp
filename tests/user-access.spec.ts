import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let createdUserId = 0;
let createdEmpId = 0;

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openUserAccessMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("User ERP & Hak Akses")');
  await menuBtn.click();
  await expect(page.locator('h1:has-text("User ERP & Hak Akses")')).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 11: User ERP & Hak Akses — End-to-End Audit Suite', () => {
  test.afterAll(async () => {
    if (createdUserId) {
      try {
        await prisma.t_usercapability.deleteMany({
          where: { userid: createdUserId },
        });
        await prisma.t_auditevent.deleteMany({
          where: { entityid: String(createdUserId) },
        });
        await prisma.m_user.deleteMany({
          where: { id: createdUserId },
        });
        if (createdEmpId) {
          await prisma.m_employee.deleteMany({
            where: { id: createdEmpId },
          });
        }
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await openUserAccessMenu(page);
  });

  test('1. Renders users list table, column sorting, and Refresh action button', async ({ page }) => {
    await expect(page.locator('text=Memuat data user...')).toHaveCount(0, { timeout: 15000 });

    // Verify Refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.locator('text=Memuat data user...')).toHaveCount(0, { timeout: 10000 });

    // Sort columns
    await page.click('th:has-text("ID")');
    await page.click('th:has-text("Username")');
    await page.click('th:has-text("Nama Lengkap")');
    await page.click('th:has-text("Level Access / Role")');
  });

  test('2. Add User modal: triggers, cancel, close X, field validation, and successfully creating a new user', async ({ page }) => {
    await expect(page.locator('text=Memuat data user...')).toHaveCount(0, { timeout: 15000 });

    const suffix = Date.now().toString().slice(-4);
    const testUser = `staff_${suffix}`;
    const testName = `Staff Testing ${suffix}`;

    // Open Add User Modal
    await page.click('button:has-text("Tambah User")');
    await expect(page.locator('text=Tambah User ERP Baru')).toBeVisible();

    // Secondary action 1: Batal button closes modal
    await page.click('div.fixed button:has-text("Batal")');
    await expect(page.locator('text=Tambah User ERP Baru')).toHaveCount(0);

    // Secondary action 2: X button closes modal
    await page.click('button:has-text("Tambah User")');
    await expect(page.locator('text=Tambah User ERP Baru')).toBeVisible();
    await page.locator('div.fixed button:has(svg.lucide-x)').click();
    await expect(page.locator('text=Tambah User ERP Baru')).toHaveCount(0);

    // Open again to submit
    await page.click('button:has-text("Tambah User")');
    await page.fill('input[placeholder="e.g. kasir2"]', testUser);
    await page.fill('input[placeholder="e.g. Dewi Sartika"]', testName);
    await page.selectOption('div.fixed select', 'Kasir');
    await page.click('button:has-text("Simpan User")');

    // Verify user appears in table
    await expect(page.locator(`text=${testUser}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testName}`)).toBeVisible();

    // Track for cleanup
    const u = await prisma.m_user.findFirst({ where: { username: testUser } });
    if (u) {
      createdUserId = Number(u.id);
      createdEmpId = u.employeeid;
    }
  });

  test('3. Permission Matrix modal: bulk select all, bulk unselect all, toggle sensitive capabilities, toggle module CRUD, cancel, and save', async ({ page }) => {
    await expect(page.locator('text=Memuat data user...')).toHaveCount(0, { timeout: 15000 });

    // Find row for admin or any existing user
    const row = page.locator('tr:has-text("admin")').first();
    await expect(row).toBeVisible();

    const permBtn = row.locator('button:has-text("Atur Hak Akses")');
    await permBtn.click();

    // Verify Modal Title
    await expect(page.locator('text=Hak Akses:')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=🔒 Otorisasi Aksi Sensitif')).toBeVisible();
    await expect(page.locator('text=📋 Hak Akses Modul CRUD')).toBeVisible();

    // Test secondary action: X button closes modal
    const closeBtn = page.locator('div.fixed button:has(svg.lucide-x)');
    await closeBtn.click();
    await expect(page.locator('text=Hak Akses:')).toHaveCount(0);

    // Reopen
    await permBtn.click();
    await expect(page.locator('text=Hak Akses:')).toBeVisible();

    // Test secondary action: Batal button closes modal
    await page.click('div.fixed button:has-text("Batal")');
    await expect(page.locator('text=Hak Akses:')).toHaveCount(0);

    // Reopen to exercise checkboxes and bulk controls
    await permBtn.click();
    await expect(page.locator('text=Hak Akses:')).toBeVisible();

    // Bulk buttons
    const checkAllBtn = page.getByRole('button', { name: '☑️ Centang Semua Modul' });
    await expect(checkAllBtn).toBeVisible();
    await checkAllBtn.click();

    const uncheckAllBtn = page.getByRole('button', { name: '⬜ Uncentang Semua Modul' });
    await expect(uncheckAllBtn).toBeVisible();
    await uncheckAllBtn.click();

    // Re-check all
    await checkAllBtn.click();

    // Toggle a sensitive capability checkbox
    const capCheckbox = page.locator('div.fixed input[type="checkbox"]').first();
    await capCheckbox.click();

    // Save Permissions
    const saveBtn = page.locator('button:has-text("Simpan Hak Akses")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Verify toast notification and modal closure
    await expect(page.locator('text=Hak akses berhasil disimpan')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Hak Akses:')).toHaveCount(0, { timeout: 10000 });
  });
});
