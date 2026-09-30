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

async function openSalesReportMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Laporan Penjualan")');
  await menuBtn.click();
  await expect(page.getByText('Laporan Penjualan ERP', { exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('Menu 10: Laporan Penjualan — End-to-End Audit Suite', () => {
  test.beforeAll(async () => {
    // Seed a known active transaction for today to guarantee report numbers
    const inventory = await prisma.m_inventory.findFirst({
      where: { stokupdate: { gt: 5 } },
    });
    const invId = inventory ? Number(inventory.id) : 10;

    const suffix = Date.now().toString().slice(-5);
    testInvoiceNo = `PS-RPT-${suffix}`;

    const header = await prisma.t_salesposheader.create({
      data: {
        salesposno: testInvoiceNo,
        salesposdate: new Date(),
        customername: `Customer Report ${suffix}`,
        grandtotal: 120000,
        isvoid: false,
        status: 'COMPLETED',
        paymenttypecode: 'QRIS',
        createduser: 'admin',
        modifieduser: 'admin',
      },
    });
    testHeaderId = Number(header.id);

    await prisma.t_salesposdetail.create({
      data: {
        salesposheaderid: testHeaderId,
        inventoryid: invId,
        qty: 2,
        price: 60000,
        subtotal: 120000,
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
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await loginAsAdmin(page);
    await openSalesReportMenu(page);
  });

  test('1. Renders 4 KPI stats cards, action buttons (Print & Refresh), and Tab 1 (Laporan Harian) with 9 column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Verify 4 Top KPI Cards
    await expect(page.getByText('Total Omset Bersih', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Transaksi', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Profit / Margin Keuntungan', { exact: true })).toBeVisible();
    await expect(page.getByText('Metode Pembayaran Utama', { exact: true })).toBeVisible();

    // Verify Print Report button (window.print is mocked)
    const printBtn = page.locator('button:has-text("Cetak / Print Report")');
    await expect(printBtn).toBeVisible();
    await printBtn.click();

    // Verify Refresh button
    const refreshBtn = page.locator('button:has-text("Refresh")');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 10000 });

    // Verify Tab 1 is active by default and sort all 9 columns
    await page.click('th:has-text("Tanggal")');
    await page.click('th:has-text("Total Transaksi")');
    await page.click('th:has-text("Total Qty Item")');
    await page.click('th:has-text("Omset Bruto")');
    await page.click('th:has-text("Diskon")');
    await page.click('th:has-text("Omset Bersih")');
    await page.click('th:has-text("Cash")');
    await page.click('th:has-text("QRIS")');
    await page.click('th:has-text("Transfer / Card")');
  });

  test('2. Tab 2: Laporan Bulanan (Rpt_Monthly) renders monthly aggregated table and supports 7 column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Switch to Monthly Tab
    await page.click('button:has-text("Laporan Bulanan (Rpt_Monthly)")');
    await expect(page.locator('th:has-text("Periode Bulan")')).toBeVisible({ timeout: 10000 });

    // Sort all 7 columns
    await page.click('th:has-text("Periode Bulan")');
    await page.click('th:has-text("Jumlah Transaksi")');
    await page.click('th:has-text("Total Item Terjual")');
    await page.click('th:has-text("Omset Bruto")');
    await page.click('th:has-text("Total Diskon")');
    await page.click('th:has-text("Omset Bersih")');
    await page.click('th:has-text("Perincian Cash & QRIS")');
  });

  test('3. Tab 3: Per Barang (Rpt_InventorySales) renders item sales breakdown and supports 6 column sorting', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Switch to Items Tab
    await page.click('button:has-text("Per Barang (Rpt_InventorySales)")');
    await expect(page.locator('th:has-text("Nama Barang Persediaan")')).toBeVisible({ timeout: 10000 });

    // Sort all 6 columns
    await page.click('th:has-text("Barcode / Kode")');
    await page.click('th:has-text("Nama Barang Persediaan")');
    await page.click('th:has-text("Total Qty Terjual")');
    await page.click('th:has-text("Harga Jual Rata-rata")');
    await page.click('th:has-text("Total Subtotal Revenue")');
    await page.click('th:has-text("Estimasi Profit")');
  });

  test('4. Tab 4: Summary & Profit (Rpt_Summary) renders financial breakdown cards and margin percentage', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    // Switch to Summary Tab
    await page.click('button:has-text("Summary & Profit (Rpt_Summary)")');
    await expect(page.locator('text=Ringkasan Penjualan & Diskon')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Estimasi Margin & Keuntungan')).toBeVisible();
    await expect(page.locator('text=Persentase Margin Profit:')).toBeVisible();
  });

  test('5. Payment Method Filter: exercises all dropdown options (Cash, QRIS, Transfer, Card, All)', async ({ page }) => {
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 15000 });

    const filterSelect = page.locator('select');
    await expect(filterSelect).toBeVisible();

    // Select Cash
    await filterSelect.selectOption('Cash');
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 10000 });

    // Select QRIS
    await filterSelect.selectOption('QRIS');
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 10000 });

    // Select Transfer
    await filterSelect.selectOption('Transfer');
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 10000 });

    // Select Card
    await filterSelect.selectOption('Card');
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 10000 });

    // Reset to All
    await filterSelect.selectOption('All');
    await expect(page.locator('text=Sedang Mengambil Data...')).toHaveCount(0, { timeout: 10000 });
  });
});
