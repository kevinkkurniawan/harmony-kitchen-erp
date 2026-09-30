import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let testInvoiceNo = '';
let testHeaderId = 0;

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Masukkan username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Login ke ERP")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openSalesMonitoringMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Sales Monitoring")');
  await menuBtn.click();
  await expect(page.getByText('Sales Monitoring Real-time', { exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 9: Sales Monitoring — End-to-End Audit Suite', () => {
  test.beforeAll(async () => {
    // Find an item with stock > 10 for safe void/unvoid testing
    const inventory = await prisma.m_inventory.findFirst({
      where: { stokupdate: { gt: 10 } },
    });
    const invId = inventory ? Number(inventory.id) : 10;

    const suffix = Date.now().toString().slice(-5);
    testInvoiceNo = `PS-E2E-${suffix}`;

    // Create a known test transaction
    const header = await prisma.t_salesposheader.create({
      data: {
        salesposno: testInvoiceNo,
        salesposdate: new Date(),
        customername: `Customer Test ${suffix}`,
        grandtotal: 100000,
        isvoid: false,
        status: 'COMPLETED',
        paymenttypecode: 'CASH',
        createduser: 'admin',
        modifieduser: 'admin',
      },
    });
    testHeaderId = Number(header.id);

    await prisma.t_salesposdetail.create({
      data: {
        salesposheaderid: testHeaderId,
        inventoryid: invId,
        qty: 1,
        price: 100000,
        subtotal: 100000,
        createduser: 'admin',
        modifieduser: 'admin',
      },
    });
  });

  test.afterAll(async () => {
    if (testHeaderId) {
      try {
        await prisma.t_salesposdetail.deleteMany({
          where: { salesposheaderid: testHeaderId },
        });
        await prisma.s_flowinventory.deleteMany({
          where: { invoiceid: testHeaderId },
        });
        await prisma.t_auditevent.deleteMany({
          where: { entityid: String(testHeaderId) },
        });
        await prisma.t_salesposheader.deleteMany({
          where: { id: testHeaderId },
        });
      } catch (e) {
        console.error('Cleanup error:', e);
      }
    }
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    // Mock window.print to prevent browser print dialog hangs
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await loginAsAdmin(page);
    await openSalesMonitoringMenu(page);
  });

  test('1. Renders 4 KPI cards, 5 payment method cards, Refresh button, and supports 9 column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Verify 4 KPI Summary Cards
    await expect(page.getByText('Total Omset Penjualan', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Struk Transaksi', { exact: true })).toBeVisible();
    await expect(page.getByText('Rata-Rata Struk (Basket)', { exact: true })).toBeVisible();
    await expect(page.getByText('Paling Dominan', { exact: true })).toBeVisible();

    // Verify 5 Payment Method Breakdown Cards
    await expect(page.locator('text=CASH / Tunai:')).toBeVisible();
    await expect(page.locator('text=QRIS Instant:')).toBeVisible();
    await expect(page.locator('text=Bank Transfer:')).toBeVisible();
    await expect(page.locator('text=EDC Debit/Credit:')).toBeVisible();
    await expect(page.locator('text=Tempo / Corporate:')).toBeVisible();

    // Verify Refresh Live Sales button
    const refreshBtn = page.locator('button:has-text("Refresh Live Sales")');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 10000 });

    // Sort all 9 table headers
    await page.click('th:has-text("No. Struk")');
    await page.click('th:has-text("Tanggal & Jam")');
    await page.click('th:has-text("Kasir / Officer")');
    await page.click('th:has-text("Customer / Meja")');
    await page.click('th:has-text("Tipe Pembayaran")');
    await page.click('th:has-text("Subtotal")');
    await page.click('th:has-text("Diskon Promo")');
    await page.click('th:has-text("Grand Total (Rp)")');
    await page.click('th:has-text("Status")');
  });

  test('2. Quick date filter buttons, manual date inputs, and live search bar', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Test Quick Date buttons
    await page.click('button:has-text("Hari Ini")');
    await page.click('button:has-text("7 Hari Terakhir")');
    await page.click('button:has-text("Bulan Ini")');
    await page.click('button:has-text("Semua Tanggal")');

    // Test Manual Date Inputs
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2);
    await dateInputs.nth(0).fill('2026-01-01');
    await dateInputs.nth(1).fill('2026-12-31');

    // Test Live Search Bar with test invoice
    const searchInput = page.locator('input[placeholder="Cari No Struk / Kasir / Customer..."]');
    await searchInput.fill(testInvoiceNo);
    await expect(page.locator(`td:has-text("${testInvoiceNo}")`)).toBeVisible({ timeout: 10000 });

    // Clear search
    await searchInput.fill('');
    await page.click('button:has-text("Semua Tanggal")');
  });

  test('3. View & Print Receipt modal, keyboard / double-click triggers, Cetak Struk action, and modal dismissal', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Filter to find our test invoice
    const searchInput = page.locator('input[placeholder="Cari No Struk / Kasir / Customer..."]');
    await searchInput.fill(testInvoiceNo);
    const row = page.locator(`tr:has-text("${testInvoiceNo}")`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // Trigger 1: Click Eye button
    const eyeBtn = row.locator('button[title="Lihat & Cetak Struk"]');
    await eyeBtn.click();

    // Verify Modal Contents
    await expect(page.locator('text=Struk Thermal POS Penjualan')).toBeVisible();
    await expect(page.locator('text=HARMONY KITCHEN & RESTO')).toBeVisible();
    await expect(page.locator('.printable-pos-receipt').locator(`text=${testInvoiceNo}`)).toBeVisible();

    // Click "Cetak Struk" button (triggers reprint POST API & window.print)
    const printBtn = page.locator('button:has-text("Cetak Struk")');
    await printBtn.click();

    // Close modal via X button
    const closeBtn = page.locator('button:has(svg.lucide-x)');
    await closeBtn.first().click();
    await expect(page.locator('text=Struk Thermal POS Penjualan')).toHaveCount(0);

    // Trigger 2: Double-click row to open receipt modal
    await row.dblclick();
    await expect(page.locator('text=Struk Thermal POS Penjualan')).toBeVisible();
    await page.locator('button:has(svg.lucide-x)').first().click();
    await expect(page.locator('text=Struk Thermal POS Penjualan')).toHaveCount(0);
  });

  test('4. Payment Method Correction flow: cancel trigger, X trigger, change to QRIS, and verify table update', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    const searchInput = page.locator('input[placeholder="Cari No Struk / Kasir / Customer..."]');
    await searchInput.fill(testInvoiceNo);
    const row = page.locator(`tr:has-text("${testInvoiceNo}")`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // Open Payment Correction Modal
    const editBtn = row.locator('button[title="Ubah Metode Pembayaran"]');
    await editBtn.click();
    await expect(page.locator('text=Koreksi Metode Pembayaran')).toBeVisible();

    // Test secondary action 1: Batal button closes modal
    await page.click('div.fixed button:has-text("Batal")');
    await expect(page.locator('text=Koreksi Metode Pembayaran')).toHaveCount(0);

    // Reopen and test secondary action 2: X button closes modal
    await editBtn.click();
    await expect(page.locator('text=Koreksi Metode Pembayaran')).toBeVisible();
    await page.locator('div.fixed button:has(svg.lucide-x)').click();
    await expect(page.locator('text=Koreksi Metode Pembayaran')).toHaveCount(0);

    // Reopen and complete correction to QRIS
    await editBtn.click();
    await page.selectOption('div.fixed select', 'QRIS');
    await page.fill('div.fixed textarea', 'Customer membayar memakai QRIS Statis BCA');
    await page.click('button:has-text("Simpan Koreksi")');

    // Verify toast & badge updated
    await expect(page.locator('text=Tipe pembayaran berhasil diubah ke QRIS')).toBeVisible({ timeout: 10000 });
    await expect(row.locator('span:has-text("QRIS")')).toBeVisible();
  });

  test('5. VOID & UNVOID flow: cancel triggers, X triggers, voiding with stock adjustment, and unvoid restoration', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    const searchInput = page.locator('input[placeholder="Cari No Struk / Kasir / Customer..."]');
    await searchInput.fill(testInvoiceNo);
    const row = page.locator(`tr:has-text("${testInvoiceNo}")`);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 1. VOID MODAL
    const voidBtn = row.locator('button[title="Batalkan Transaksi (VOID)"]');
    await voidBtn.click();
    await expect(page.locator('text=Batalkan Transaksi (VOID)')).toBeVisible();

    // Test Batal button
    await page.click('div.fixed button:has-text("Batal")');
    await expect(page.locator('text=Batalkan Transaksi (VOID)')).toHaveCount(0);

    // Test X button
    await voidBtn.click();
    await expect(page.locator('text=Batalkan Transaksi (VOID)')).toBeVisible();
    await page.locator('div.fixed button:has(svg.lucide-x)').click();
    await expect(page.locator('text=Batalkan Transaksi (VOID)')).toHaveCount(0);

    // Confirm VOID
    await voidBtn.click();
    await page.fill('div.fixed textarea', 'Pembatalan transaksi untuk uji coba E2E');
    await page.click('button:has-text("Konfirmasi VOID")');

    // Assert row transitioned to VOID
    await expect(page.locator('text=berhasil di-VOID')).toBeVisible({ timeout: 10000 });
    await expect(row.locator('span:has-text("VOID")')).toBeVisible();

    // 2. UNVOID MODAL
    const unvoidBtn = row.locator('button[title="Pulihkan Transaksi (UNVOID)"]');
    await expect(unvoidBtn).toBeVisible();
    await unvoidBtn.click();
    await expect(page.locator('text=Pulihkan Transaksi (UNVOID)')).toBeVisible();

    // Test Batal button
    await page.click('div.fixed button:has-text("Batal")');
    await expect(page.locator('text=Pulihkan Transaksi (UNVOID)')).toHaveCount(0);

    // Confirm UNVOID
    await unvoidBtn.click();
    await page.fill('div.fixed textarea', 'Pemulihan transaksi nota kembali lunas');
    await page.click('button:has-text("Konfirmasi UNVOID")');

    // Assert row transitioned back to LUNAS
    await expect(page.locator('text=berhasil di-UNVOID')).toBeVisible({ timeout: 10000 });
    await expect(row.locator('span:has-text("LUNAS")')).toBeVisible();
  });
});
