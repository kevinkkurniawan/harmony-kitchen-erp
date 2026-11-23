import { test, expect } from '@playwright/test';

// Mocked (no database): Sales Monitoring grouped per kasir with a subtotal row (client doc Sales Monitoring)
const row = (id: number, invoiceNo: string, user: string, tunai: number, extra: object = {}) => ({
  id, invoiceNo, paymentType: 'CASH', bankName: '', transactionValue: tunai, finalDiscount: 0, paymentValue: tunai,
  changeValue: 0, remarks: '', tunai, debit: 0, qris: 0, creditCard: 0, other: 0, cashierName: user,
  isVoid: false, isUnpaid: false, ...extra,
});

const SALES = [
  row(1, 'PS2611230001', 'linda', 100000),
  row(2, 'PS2611230002', 'DESKTOP-G72BDOK/lia', 50000),
  row(3, 'PS2611230003', 'linda', 25000),
  row(4, 'PS2611230004', 'DESKTOP-G72BDOK/lia', 70000, { isVoid: true, remarks: 'VOID oleh admin: Ngetest' }),
];

test.describe('Menu 9: Sales Monitoring — per kasir subtotal (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) => route.fulfill({ json: { success: true, data: [] } }));
    await page.route('**/api/auth/session', (route) => route.fulfill({
      json: { success: true, user: { id: 5, username: 'admin', fullName: 'Admin ERP', userLevel: 'Admin', isActive: true }, permissions: [] },
    }));
    await page.route('**/api/sales/monitoring?*', (route) => route.fulfill({
      json: { success: true, data: SALES, pagination: { total: SALES.length, page: 1, limit: 100 } },
    }));
    await page.goto('/');
    await page.locator('aside button:has-text("Sales Monitoring")').click();
    await expect(page.locator('th:has-text("Nom. Transaksi")')).toBeVisible({ timeout: 10000 });
  });

  test('rows are grouped per kasir, each group closed by a subtotal that skips void notes', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(6); // 4 notes + 2 subtotals
    const lindaSub = rows.filter({ hasText: 'Subtotal linda (2 nota)' });
    const liaSub = rows.filter({ hasText: 'Subtotal lia (2 nota)' });
    await expect(lindaSub).toContainText('125.000');
    await expect(liaSub).toContainText('50.000'); // the voided 70.000 is not money received
    await expect(liaSub).not.toContainText('120.000');
    // the subtotal row has no void checkbox or action buttons
    await expect(lindaSub.locator('input[type="checkbox"], button')).toHaveCount(0);
    // the void reason is visible in Keterangan
    await expect(page.getByText('VOID oleh admin: Ngetest')).toBeVisible();
  });
});
