import { test, expect, request as pwRequest, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';

// Throw-away non-admin user, so no real account's password changes
const username = `cpw_${Date.now().toString().slice(-6)}`;
let userId = 0;
let employeeId = 0;

async function login(page: Page, name: string, password: string) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', name);
  await page.fill('input[placeholder="••••••••"]', password);
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

async function apiLogin(name: string, password: string) {
  const ctx = await pwRequest.newContext({ baseURL: BASE });
  const res = await ctx.post('/api/auth/login', { data: { username: name, password } });
  const ok = res.ok();
  await ctx.dispose();
  return ok;
}

test.describe('Main window: Change Password (old frmChangePassword)', () => {
  test.beforeAll(async () => {
    const emp = await prisma.m_employee.create({ data: { employeeno: `E2E-${username}`, employeename: username, positionid: 1, isactive: true } });
    employeeId = Number(emp.id);
    const user = await prisma.m_user.create({ data: { username, password: 'lama1', employeeid: employeeId } });
    userId = Number(user.id);
  });

  test.afterAll(async () => {
    await prisma.t_auditevent.deleteMany({ where: { entityid: String(userId), entitytype: 'USER' } });
    await prisma.m_user.deleteMany({ where: { id: userId } });
    await prisma.m_employee.deleteMany({ where: { id: employeeId } });
    await prisma.$disconnect();
  });

  test('button next to Log Off; dialog with the old captions; wrong / mismatched input refused; change works', async ({ page }) => {
    await login(page, username, 'lama1');
    // Old ribbon "Action" group order: Log Off, then Change Password
    const headerButtons = await page.locator('header button').allInnerTexts();
    const logOff = headerButtons.findIndex((t) => t.trim() === 'Log Off');
    expect(logOff).toBeGreaterThanOrEqual(0);
    expect(headerButtons[logOff + 1].trim()).toBe('Change Password');

    await page.locator('header').getByRole('button', { name: 'Change Password' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change Password' });
    await expect(dialog.getByText('Change password..', { exact: true })).toBeVisible();
    for (const label of ['Old Password', 'New Password', 'Confirm New Password']) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByRole('button', { name: 'OK', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'CLOSE', exact: true })).toBeVisible();
    const inputs = dialog.locator('input[type="password"]');
    await expect(inputs).toHaveCount(3);
    await expect(inputs.nth(1)).toHaveAttribute('maxlength', '15');

    // Wrong old password: refused, fields emptied, password unchanged
    await inputs.nth(0).fill('salah');
    await inputs.nth(1).fill('baru22');
    await inputs.nth(2).fill('baru22');
    await dialog.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Old Password salah.');
    await expect(inputs.nth(0)).toHaveValue('');
    expect((await prisma.m_user.findUnique({ where: { id: userId } }))?.password).toBe('lama1');

    // Confirmation differs: refused
    await inputs.nth(0).fill('lama1');
    await inputs.nth(1).fill('baru22');
    await inputs.nth(2).fill('baru23');
    await dialog.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Confirm New Password tidak sama dengan New Password.');
    expect((await prisma.m_user.findUnique({ where: { id: userId } }))?.password).toBe('lama1');

    // Enter in Old Password does not send; Enter in Confirm New Password does (old KeyDown handler)
    await inputs.nth(0).fill('lama1');
    await inputs.nth(0).press('Enter');
    await expect(dialog.getByRole('status')).toHaveText('Confirm New Password tidak sama dengan New Password.');
    await inputs.nth(1).fill('baru22');
    await inputs.nth(2).fill('baru22');
    await inputs.nth(2).press('Enter');
    await expect(dialog.getByRole('status')).toHaveText('Password berhasil diubah.');
    expect((await prisma.m_user.findUnique({ where: { id: userId } }))?.password).toBe('baru22');
    const audit = await prisma.t_auditevent.findFirst({ where: { entityid: String(userId), eventtype: 'USER_CHANGE_PASSWORD' } });
    expect(audit?.actor).toBe(username);

    // CLOSE hides the dialog; the new password logs in, the old one no longer does
    await dialog.getByRole('button', { name: 'CLOSE', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await apiLogin(username, 'baru22')).toBe(true);
    expect(await apiLogin(username, 'lama1')).toBe(false);
  });

  test('API: needs a session, and only changes the logged-in user', async () => {
    const anon = await pwRequest.newContext({ baseURL: BASE });
    const res = await anon.post('/api/auth/change-password', { data: { oldPassword: 'x', newPassword: 'abcd', confirmNewPassword: 'abcd' } });
    expect(res.status()).toBe(401);
    await anon.dispose();

    const before = await prisma.m_user.findUnique({ where: { id: userId } });
    const ctx = await pwRequest.newContext({ baseURL: BASE });
    await ctx.post('/api/auth/login', { data: { username, password: before?.password } });
    // Short new password refused like the admin password change
    const short = await ctx.post('/api/auth/change-password', { data: { oldPassword: before?.password, newPassword: 'ab', confirmNewPassword: 'ab' } });
    expect(short.status()).toBe(400);
    expect((await short.json()).error).toBe('Password minimal 4 karakter.');
    // An admin's password is not reachable through this endpoint (no user id is accepted)
    const admin = await prisma.m_user.findFirst({ where: { username: 'admin' } });
    const other = await ctx.post('/api/auth/change-password', { data: { userId: Number(admin?.id), oldPassword: admin?.password, newPassword: 'hack1', confirmNewPassword: 'hack1' } });
    expect(other.status()).toBe(400);
    expect((await prisma.m_user.findFirst({ where: { username: 'admin' } }))?.password).toBe(admin?.password);
    await ctx.dispose();
  });
});
