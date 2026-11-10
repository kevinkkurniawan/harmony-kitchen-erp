import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let testInvoiceNo = '';
let testHeaderId = 0;
let testSaleDay = '';

const N0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function openSalesReportMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("Laporan Penjualan")');
  await menuBtn.click();
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeVisible({ timeout: 10000 });
}

// Old report columns (Rpt_SalesMonthly) and footer block
const REPORT_COLUMNS = ['Tanggal', 'Tunai', 'Debit', 'Kredit', 'Qris', 'Lain-lain', 'Total Harian'];
const REPORT_FOOTER = ['Total Tunai :', 'Total Debit :', 'Total Kartu Kredit :', 'Total Qris :', 'Total Lain-lain :', 'Total Penjualan :'];

async function expectOldReport(page: Page) {
  await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText('LAPORAN TOTAL PENJUALAN', { exact: true })).toBeVisible();
  await expect(page.locator('text=Periode :')).toBeVisible();
  const headers = page.locator('#printable-sales-report thead th');
  await expect(headers).toHaveText(REPORT_COLUMNS);
  for (const label of REPORT_FOOTER) {
    await expect(page.locator(`#printable-sales-report >> text=${label}`)).toBeVisible();
  }
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
    testSaleDay = header.salesposdate!.toISOString().slice(0, 10);

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

  test('1. Window "Laporan Penjualan": NavBar items in the old order, Laporan Summary (1 Bulan) with the old report layout, Print', async ({ page }) => {
    await expect(page.getByText('Laporan Penjualan', { exact: true }).first()).toBeVisible();
    const navItems = page.locator('nav[aria-label="Laporan Penjualan"] button');
    await expect(navItems).toHaveText([
      'Laporan Summary', 'Laporan Summary Custom', 'Laporan Harian', 'Laporan Harian Per Kasir',
      'Laporan Bulanan', 'Per Barang', 'Summary & Profit',
    ]);

    // Default report: Laporan Summary with the "1 Bulan" parameter
    await expect(page.getByText('1 Bulan', { exact: true })).toBeVisible();
    await expect(page.getByText('Bulan :', { exact: true })).toBeVisible();
    await page.fill('input[type="month"]', new Date().toISOString().slice(0, 7));
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expectOldReport(page);

    // No payment-method filter (not in the old report)
    await expect(page.locator('text=Semua Metode Pembayaran')).toHaveCount(0);

    // Print (window.print is mocked)
    await page.getByRole('button', { name: 'Print', exact: true }).click();
  });

  test('2. Laporan Summary Custom: "Tgl Awal Dan Akhir" parameter and the old report layout', async ({ page }) => {
    await page.click('nav[aria-label="Laporan Penjualan"] button:has-text("Laporan Summary Custom")');
    await expect(page.getByText('Tgl Awal Dan Akhir', { exact: true })).toBeVisible();
    await expect(page.getByText('Tgl. Awal :', { exact: true })).toBeVisible();
    await expect(page.getByText('Tgl. Akhir :', { exact: true })).toBeVisible();
    const today = new Date().toISOString().slice(0, 10);
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(`${today.slice(0, 7)}-01`);
    await dates.nth(1).fill(today);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expectOldReport(page);
  });

  test('3. Laporan Bulanan: monthly rows with the old payment columns', async ({ page }) => {
    await page.click('nav[aria-label="Laporan Penjualan"] button:has-text("Laporan Bulanan")');
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('#printable-sales-report thead th')).toHaveText([
      'Periode Bulan', 'Jumlah Transaksi', 'Total Item Terjual', 'Omset Bruto', 'Total Diskon',
      'Tunai', 'Debit', 'Kredit', 'Qris', 'Lain-lain', 'Omset Bersih',
    ]);
  });

  test('4. Per Barang: item sales columns, profit column for Admin', async ({ page }) => {
    await page.click('nav[aria-label="Laporan Penjualan"] button:has-text("Per Barang")');
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('#printable-sales-report thead th')).toHaveText([
      'Barcode / Kode', 'Nama Barang Persediaan', 'Total Qty Terjual', 'Harga Jual Rata-rata', 'Total Subtotal Revenue', 'Estimasi Profit',
    ]);
  });

  test('5. Summary & Profit: sales summary and the Admin-only margin group', async ({ page }) => {
    await page.click('nav[aria-label="Laporan Penjualan"] button:has-text("Summary & Profit")');
    await expect(page.locator('text=Ringkasan Penjualan & Diskon')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Estimasi Margin & Keuntungan')).toBeVisible();
    await expect(page.locator('text=Persentase Margin Profit:')).toBeVisible();
  });

  test('6. Laporan Harian: old daily nota layout, and each day total equals the Laporan Summary row of that day', async ({ page }) => {
    // A closed historic month, so the numbers do not move while the test runs
    const [start, end] = ['2025-06-01', '2025-06-30'];
    const nav = page.locator('nav[aria-label="Laporan Penjualan"]');
    await nav.getByRole('button', { name: 'Laporan Summary Custom', exact: true }).click();
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(start);
    await dates.nth(1).fill(end);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expectOldReport(page);
    // Wait for the June 2025 load itself: OK can be read before its loading row appears
    await expect(page.getByText('Periode : 01 Jun 2025 s/d 30 Jun 2025', { exact: true })).toBeVisible();
    const summaryCells = page.locator('#printable-sales-report tbody tr td:last-child');
    await expect.poll(async () => (await summaryCells.allInnerTexts()).some((t) => t === 'Memuat data...'), { timeout: 15000 }).toBe(false);
    // Laporan Summary rows: Tanggal + Total Harian (last column)
    const summaryTotals = await summaryCells.allInnerTexts();
    expect(summaryTotals.length).toBeGreaterThan(0);
    const summaryGrand = await page.locator('#printable-sales-report tfoot td:last-child').innerText();

    await nav.getByRole('button', { name: 'Laporan Harian', exact: true }).click();
    await expect(page.getByText('Tgl Awal Dan Akhir', { exact: true })).toBeVisible();
    await expect(page.getByText('Tgl. Akhir :', { exact: true })).toBeVisible();
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByText('LAPORAN PENJUALAN HARIAN', { exact: true })).toBeVisible();
    await expect(page.getByText('Periode : 01 Juni 2025 s/d 30 Juni 2025', { exact: true })).toBeVisible();

    const sheet = page.locator('#printable-sales-report');
    await expect(sheet.locator('[data-testid="nota-group"]').first()).toContainText('Tanggal : ');
    const method = sheet.locator('[data-testid="nota-method"]').first();
    await expect(method).toContainText('Metode Pembayaran : ');
    await expect(method.getByText('No. Nota', { exact: true })).toHaveCount(3);
    await expect(method.getByText('Pembelanjaan', { exact: true })).toHaveCount(3);
    await expect(method).toContainText(/Total Transaksi .+ :/);
    await expect(sheet.getByText('Total Harian :', { exact: true }).first()).toBeVisible();
    await expect(sheet.getByText('Total Keseluruhan :', { exact: true })).toBeVisible();

    // Same days, same totals as the Laporan Summary rows
    const dayTotals = await sheet.locator('[data-testid="nota-day-total"]').allInnerTexts();
    expect(dayTotals).toEqual(summaryTotals);
    await expect(sheet.locator('[data-testid="nota-grand-total"]')).toHaveText(summaryGrand);
  });

  test('7. Laporan Harian Per Kasir: one day ("Tgl. Awal" only), grouped by Kasir and payment method', async ({ page }) => {
    await page.locator('nav[aria-label="Laporan Penjualan"]').getByRole('button', { name: 'Laporan Harian Per Kasir', exact: true }).click();
    await expect(page.getByText('Tgl Awal Dan Akhir', { exact: true })).toBeVisible();
    await expect(page.getByText('Tgl. Awal :', { exact: true })).toBeVisible();
    await expect(page.getByText('Tgl. Akhir :', { exact: true })).toHaveCount(0);
    await page.locator('input[type="date"]').fill(testSaleDay);
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByText('LAPORAN PENJUALAN HARIAN', { exact: true })).toBeVisible();

    // The seeded QRIS sale by "admin": Kasir admin, payment "Qris" (the old payment type name), net 120.000
    const sheet = page.locator('#printable-sales-report');
    const group = sheet.locator('[data-testid="nota-group"]', { hasText: 'Kasir : admin' });
    await expect(group).toBeVisible();
    await expect(group).toContainText('Tanggal : ');
    const method = group.locator('[data-testid="nota-method"]', { hasText: 'Metode Pembayaran : Qris' });
    await expect(method).toContainText(testInvoiceNo);
    await expect(method).toContainText('120.000');
    await expect(method).toContainText('Total Transaksi Qris :');

    // Cashier totals add up to the day, and the day equals that day's Laporan Summary (API daily row)
    const cashierTotals = (await sheet.locator('[data-testid="nota-day-total"]').allInnerTexts()).map((t) => Number(t.replace(/\./g, '')));
    const grand = Number((await sheet.locator('[data-testid="nota-grand-total"]').innerText()).replace(/\./g, ''));
    expect(cashierTotals.reduce((a, b) => a + b, 0)).toBe(grand);
    const daily = await (await page.request.get(`/api/reports/sales?type=daily&startDate=${testSaleDay}&endDate=${testSaleDay}`)).json();
    expect(N0.format(grand)).toBe(N0.format(Number(daily.data[0].netSales)));
  });
});
