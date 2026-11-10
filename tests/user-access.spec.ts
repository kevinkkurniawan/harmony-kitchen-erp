import { test, expect, request as pwRequest, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let createdUserId = 0;
let createdEmpId = 0;

async function loginAsAdmin(page: any) {
  await page.goto('/');
  await page.fill('input[placeholder="Enter Username"]', 'admin');
  await page.fill('input[placeholder="••••••••"]', '5555');
  await page.click('button:has-text("Log on")');
  await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
}

// Scoped to the page: the main window's top bar has its own "Change Password" button
const btn = (page: Page, name: string) => page.locator('main').getByRole('button', { name, exact: true });

async function openUserAccessMenu(page: any) {
  const menuBtn = page.locator('aside button:has-text("User ERP & Hak Akses")');
  await menuBtn.click();
  await expect(btn(page, 'Add User')).toBeVisible({ timeout: 10000 });
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

  test('1. Window "Setting - User": old buttons, Username | User Type grid, search and sorting', async ({ page }) => {
    await expect(page.getByText('Setting - User', { exact: true })).toBeVisible();
    for (const name of ['Add User', 'Change Password', 'Delete User', 'Save', 'Back']) {
      await expect(btn(page, name)).toBeVisible();
    }
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('thead th')).toHaveText(['Username', 'User Type']);
    await page.click('th:has-text("Username")');
    await page.click('th:has-text("User Type")');

    // Search box filters the grid
    await page.fill('input[placeholder="Cari Username / User Type..."]', 'admin');
    await expect(page.locator('tbody tr:has-text("admin")').first()).toBeVisible();
  });

  test('2. Add User group: fields with the old labels, Back cancels, Save creates the user', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const suffix = Date.now().toString().slice(-4);
    const testUser = `staff_${suffix}`;

    await btn(page, 'Add User').click();
    await expect(page.getByText('Add User', { exact: true }).last()).toBeVisible();
    // Scoped to the form: "User Type" is also the grid's column header
    for (const label of ['Username *', 'Password *', 'Confirm Password *', 'User Type', 'Permission']) {
      await expect(page.locator('form').getByText(label, { exact: true })).toBeVisible();
    }

    // Back cancels the form
    await btn(page, 'Back').click();
    await expect(page.locator('text=Pilih user di daftar, atau klik Add User.')).toBeVisible();

    // Create: password given, confirmation must match
    await btn(page, 'Add User').click();
    const inputs = page.locator('form input');
    await inputs.nth(0).fill(testUser);
    await inputs.nth(1).fill('4321');
    await inputs.nth(2).fill('4321');
    await page.locator('form select').selectOption('Kasir');
    await btn(page, 'Save').click();

    await expect(page.locator(`text=User "${testUser}" berhasil ditambahkan!`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`tbody tr:has-text("${testUser}")`)).toBeVisible();
    // After saving, the new user is open in the "Change Password" group
    await expect(page.getByText('Change Password', { exact: true }).last()).toBeVisible();

    const u = await prisma.m_user.findFirst({ where: { username: testUser } });
    if (u) {
      createdUserId = Number(u.id);
      createdEmpId = u.employeeid;
    }
  });

  test('3. Permission tree: one tick per module (Module Code | Module Name), unused grants hidden, Save writes all flags', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    // Own throw-away user, so admin's rows are not changed
    const name = `perm_${Date.now().toString().slice(-6)}`;
    const createRes = await page.request.post('/api/users', { data: { username: name, userLevel: 'Kasir', isActive: true, password: '4321' } });
    const created = await createRes.json();
    expect(created.success).toBe(true);
    const userId = Number(created.data.id);
    const hidden = ['MANUAL_DISCOUNT', 'OVERRIDE_GROSIR_1', 'BARCODE_MANAGE'];
    // A stored grant of a hidden capability must survive a save
    await prisma.t_usercapability.create({ data: { userid: userId, capabilitycode: 'MANUAL_DISCOUNT', isgranted: true, grantedby: 'e2e' } });
    try {
      await page.reload();
      await openUserAccessMenu(page);
      await page.locator('tbody tr', { hasText: name }).first().click();
      await expect(page.getByText('Change Password', { exact: true }).last()).toBeVisible();
      await expect(page.getByText('Otorisasi Aksi Sensitif')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('form th')).toHaveText(['Module Code', 'Module Name']);

      // One checkbox per module; the old Lihat / Tambah / Edit / Hapus / Cetak boxes and dead modules are gone
      for (const label of ['Master Barang', 'Stok Opname', 'Cetak Barcode', 'Penerimaan Barang Ekspress', 'Laporan Penjualan']) {
        await expect(page.getByRole('checkbox', { name: label, exact: true })).toHaveCount(1);
      }
      for (const gone of ['Lihat', 'Tambah', 'Hapus', 'Sync Stock', 'Cek Sync Stock', 'Diskon Manual POS', 'Override Grosir 1 POS', 'Akses Halaman Barcode']) {
        await expect(page.locator('form').getByText(gone, { exact: true })).toHaveCount(0);
      }
      for (const code of hidden) await expect(page.locator('form').getByText(code, { exact: true })).toHaveCount(0);
      await expect(page.getByRole('checkbox', { name: 'Cetak Label Barcode' })).toHaveCount(1);
      // Cetak Barcode sits in Master Data right after Stok Opname
      const codes = await page.locator('form tbody td:first-child span.font-mono').allTextContents();
      expect(codes.indexOf('cetak-barcode')).toBe(codes.indexOf('stok-opname') + 1);

      // Root node checks / unchecks every module; the group node follows its children
      const allModules = page.getByRole('checkbox', { name: 'Semua Modul' });
      await allModules.uncheck();
      await expect(page.getByRole('checkbox', { name: 'Master Barang', exact: true })).not.toBeChecked();
      await allModules.check();
      await page.getByRole('checkbox', { name: 'Cetak Barcode', exact: true }).uncheck();
      await expect(page.getByRole('checkbox', { name: 'Master Data', exact: true })).not.toBeChecked();
      await btn(page, 'Save').click();
      await expect(page.locator('text=berhasil disimpan')).toBeVisible({ timeout: 15000 });

      // Stored like the tick: all five flags equal to it
      const rows = await prisma.$queryRaw<{ module_code: string; can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean; can_print: boolean }[]>`
        SELECT module_code, can_view, can_add, can_edit, can_delete, can_print FROM erp_user_permission WHERE user_id = ${userId}`;
      const barcode = rows.find((r) => r.module_code === 'cetak-barcode');
      expect(barcode).toMatchObject({ can_view: false, can_add: false, can_edit: false, can_delete: false, can_print: false });
      const barang = rows.find((r) => r.module_code === 'master-barang');
      expect(barang).toMatchObject({ can_view: true, can_add: true, can_edit: true, can_delete: true, can_print: true });
      expect(rows.map((r) => r.module_code)).not.toContain('sales-sync-stok');
      const kept = await prisma.t_usercapability.findUnique({ where: { userid_capabilitycode: { userid: userId, capabilitycode: 'MANUAL_DISCOUNT' } } });
      expect(kept?.isgranted).toBe(true);

      // Reopened, the tree shows the saved tick
      await page.reload();
      await openUserAccessMenu(page);
      await page.locator('tbody tr', { hasText: name }).first().click();
      await expect(page.getByRole('checkbox', { name: 'Cetak Barcode', exact: true })).not.toBeChecked({ timeout: 10000 });
      await expect(page.getByRole('checkbox', { name: 'Master Barang', exact: true })).toBeChecked();
    } finally {
      await prisma.$executeRaw`DELETE FROM erp_user_permission WHERE user_id = ${userId}`;
      await prisma.t_usercapability.deleteMany({ where: { userid: userId } });
      await prisma.t_auditevent.deleteMany({ where: { entityid: String(userId) } });
      const u = await prisma.m_user.findUnique({ where: { id: userId } });
      await prisma.m_user.deleteMany({ where: { id: userId } });
      if (u?.employeeid) await prisma.m_employee.deleteMany({ where: { id: u.employeeid } });
    }
  });

  test('4. Switching users while permissions load: the late response of the first user is dropped', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const admin = await prisma.m_user.findFirst({ where: { username: 'admin' } });
    const other = await prisma.m_user.findFirst({ where: { username: { not: 'admin' } }, orderBy: { id: 'asc' } });
    const otherName = other?.username ?? '';
    test.skip(!admin || !otherName, 'Needs admin and one other user');

    // admin's tree answers late and carries a marker module, so a leak would show "zz-marker"
    let release: () => void = () => {};
    const held = new Promise<void>((r) => { release = r; });
    await page.route(`**/api/users/permissions?userId=${admin!.id}`, async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.data = [...json.data, { userId: Number(admin!.id), moduleCode: 'zz-marker', canView: true, canAdd: true, canEdit: true, canDelete: true, canPrint: true }];
      await held;
      await route.fulfill({ response: res, json });
    });

    await page.locator('tbody tr', { hasText: /^admin/ }).first().click();
    await expect(page.locator('text=Memuat data...')).toBeVisible();
    await expect(btn(page, 'Save')).toBeDisabled();
    await page.locator('tbody tr', { hasText: otherName }).first().click();
    await expect(page.locator('text=Otorisasi Aksi Sensitif')).toBeVisible({ timeout: 10000 });
    const late = page.waitForResponse((r) => r.url().includes(`userId=${admin!.id}`));
    release();
    await late;
    await page.waitForTimeout(300);
    await expect(page.getByText('zz-marker')).toHaveCount(0);
    await expect(page.locator('form input').first()).toHaveValue(otherName);

    // A failed load shows no tree (nothing of the previous user to save)
    await page.unroute(`**/api/users/permissions?userId=${admin!.id}`);
    await page.route(`**/api/users/permissions?userId=${admin!.id}`, (route) => route.fulfill({ status: 500, json: { success: false } }));
    await page.locator('tbody tr', { hasText: /^admin/ }).first().click();
    await expect(page.locator('text=Permission user ini gagal dimuat')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('checkbox', { name: 'Semua Modul' })).toHaveCount(0);
  });
  // Throw-away user for the User Type tests; removed with its employee, rows and audit events
  async function createTempUser(page: Page, prefix: string, userLevel: string) {
    const name = `${prefix}_${Date.now().toString().slice(-6)}`;
    const res = await page.request.post('/api/users', { data: { username: name, userLevel, isActive: true, password: '4321' } });
    const json = await res.json();
    expect(json.success).toBe(true);
    return { name, id: Number(json.data.id) };
  }
  async function removeTempUser(id: number) {
    await prisma.$executeRaw`DELETE FROM erp_user_permission WHERE user_id = ${id}`;
    await prisma.t_usercapability.deleteMany({ where: { userid: id } });
    await prisma.t_auditevent.deleteMany({ where: { entityid: String(id) } });
    const u = await prisma.m_user.findUnique({ where: { id } });
    await prisma.m_user.deleteMany({ where: { id } });
    if (u?.employeeid) await prisma.m_employee.deleteMany({ where: { id: u.employeeid } });
  }
  // Positions a test created (none of the given name before it) are dropped again once no employee uses them
  async function dropCreatedPosition(name: string, existedBefore: boolean) {
    if (existedBefore) return;
    const ids = (await prisma.m_position.findMany({ where: { positionname: name } })).map((p) => Number(p.id));
    if (ids.length && (await prisma.m_employee.count({ where: { positionid: { in: ids } } })) === 0) {
      await prisma.m_position.deleteMany({ where: { id: { in: ids } } });
    }
  }
  async function userTypeOf(id: number) {
    const [row] = await prisma.$queryRaw<{ positionname: string | null }[]>`
      SELECT p.positionname FROM m_user u JOIN m_employee e ON e.id = u.employeeid JOIN m_position p ON p.id = e.positionid WHERE u.id = ${id}`;
    return row?.positionname ?? null;
  }
  async function loginLevel(name: string, password: string) {
    const ctx = await pwRequest.newContext({ baseURL: 'http://localhost:3000' });
    const json = await (await ctx.post('/api/auth/login', { data: { username: name, password } })).json();
    await ctx.dispose();
    return json.user?.userLevel as string | undefined;
  }

  test('5. Change Password group: Admin changes User Type; stored on the employee position, effective at next login', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const hadSupervisor = await prisma.m_position.findFirst({ where: { positionname: 'Supervisor' } });
    const temp = await createTempUser(page, 'utype', 'Kasir');
    try {
      await page.reload();
      await openUserAccessMenu(page);
      await page.locator('tbody tr', { hasText: temp.name }).first().click();
      await expect(page.getByText('Otorisasi Aksi Sensitif')).toBeVisible({ timeout: 10000 });
      const select = page.locator('form select');
      await expect(select).toBeEnabled();
      await expect(select).toHaveValue('Kasir');

      await select.selectOption('Supervisor');
      await btn(page, 'Save').click();
      await expect(page.getByText(`User "${temp.name}" berhasil disimpan! User Type baru berlaku saat user ini login berikutnya.`)).toBeVisible({ timeout: 10000 });
      await expect(page.locator('tbody tr', { hasText: temp.name }).first()).toContainText('Supervisor');
      expect(await userTypeOf(temp.id)).toBe('Supervisor');
      const audit = await prisma.t_auditevent.findFirst({ where: { entityid: String(temp.id), eventtype: 'USER_UPDATE' }, orderBy: { id: 'desc' } });
      expect(audit?.beforedata).toMatchObject({ userType: 'Kasir' });
      expect(audit?.afterdata).toMatchObject({ userType: 'Supervisor' });
      expect(await loginLevel(temp.name, '4321')).toBe('Staff');
      const toast = page.getByText('User Type baru berlaku saat user ini login berikutnya.');
      await expect(toast).toHaveCount(0, { timeout: 6000 });

      // To Admin: the next login of that user is an Admin session
      await select.selectOption('Admin');
      await btn(page, 'Save').click();
      await expect(toast).toBeVisible({ timeout: 10000 });
      expect(await userTypeOf(temp.id)).toBe('Admin');
      expect(await loginLevel(temp.name, '4321')).toBe('Admin');
      await expect(toast).toHaveCount(0, { timeout: 6000 });

      // Back to Kasir (another Admin remains): a normal user again at the next login
      await select.selectOption('Kasir');
      await btn(page, 'Save').click();
      await expect(toast).toBeVisible({ timeout: 10000 });
      expect(await userTypeOf(temp.id)).toBe('Kasir');
      expect(await loginLevel(temp.name, '4321')).toBe('Staff');
    } finally {
      await removeTempUser(temp.id);
      await dropCreatedPosition('Supervisor', Boolean(hadSupervisor));
    }
  });

  test('6. User Type guards: no self-demotion, unknown types refused, non-admin cannot change it', async ({ page }) => {
    await expect(page.locator('text=Memuat data...')).toHaveCount(0, { timeout: 15000 });
    const hadManager = await prisma.m_position.findFirst({ where: { positionname: 'Manager' } });
    const boss = await createTempUser(page, 'uboss', 'Admin');
    const staff = await createTempUser(page, 'ustaff', 'Kasir');
    try {
      // An Admin (by User Type) cannot take Admin from their own account
      const ctx = await pwRequest.newContext({ baseURL: 'http://localhost:3000' });
      await ctx.post('/api/auth/login', { data: { username: boss.name, password: '4321' } });
      const self = await ctx.put(`/api/users/${boss.id}`, { data: { username: boss.name, userType: 'Kasir' } });
      expect(self.status()).toBe(400);
      expect((await self.json()).error).toBe('Tidak dapat menurunkan User Type akun Anda sendiri.');
      expect(await userTypeOf(boss.id)).toBe('Admin');
      await ctx.dispose();

      // Unknown User Type
      const bad = await page.request.put(`/api/users/${staff.id}`, { data: { username: staff.name, userType: 'Root' } });
      expect(bad.status()).toBe(400);
      expect(await userTypeOf(staff.id)).toBe('Kasir');

      // A normal user cannot change anyone's User Type
      const nonAdmin = await pwRequest.newContext({ baseURL: 'http://localhost:3000' });
      await nonAdmin.post('/api/auth/login', { data: { username: staff.name, password: '4321' } });
      const denied = await nonAdmin.put(`/api/users/${staff.id}`, { data: { username: staff.name, userType: 'Admin' } });
      expect(denied.status()).toBe(403);
      expect(await userTypeOf(staff.id)).toBe('Kasir');
      await nonAdmin.dispose();

      // The UI shows the server's refusal: admin demotes another Admin while one remains = allowed
      await page.reload();
      await openUserAccessMenu(page);
      await page.locator('tbody tr', { hasText: boss.name }).first().click();
      await expect(page.getByText('Otorisasi Aksi Sensitif')).toBeVisible({ timeout: 10000 });
      await page.locator('form select').selectOption('Manager');
      await btn(page, 'Save').click();
      await expect(page.getByText('User Type baru berlaku saat user ini login berikutnya.')).toBeVisible({ timeout: 10000 });
      expect(await userTypeOf(boss.id)).toBe('Manager');
    } finally {
      await removeTempUser(boss.id);
      await removeTempUser(staff.id);
      await dropCreatedPosition('Manager', Boolean(hadManager));
    }
  });
});
