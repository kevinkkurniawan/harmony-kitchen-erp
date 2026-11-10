import { test, expect, type APIRequestContext } from '@playwright/test';
import { Client } from 'pg';

// Endpoints that were readable without a login before the /api proxy guard
const PREVIOUSLY_OPEN = [
  '/api/inventory?limit=1',
  '/api/reports/sales?type=daily&startDate=2026-11-01&endDate=2026-11-02',
  '/api/sales/monitoring?all=true&dateFrom=2026-11-01&dateTo=2026-11-01',
  '/api/purchasing/payments',
  '/api/promos',
  '/api/suppliers?limit=1',
];

// Direct DB access only against a local copy: these tests add and remove erp_user_permission rows
function localDbUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    return ['127.0.0.1', 'localhost'].includes(new URL(raw).hostname) ? raw : null;
  } catch {
    return null;
  }
}

async function login(request: APIRequestContext, username: string, password: string) {
  const res = await request.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return (await res.json()).user as { id: number; userLevel: string };
}

test.describe('API guard: session (401), module access (403), Admin rule', () => {
  test('1. Previously open endpoints return 401 JSON without a session; auth endpoints stay reachable', async ({ request }) => {
    for (const path of PREVIOUSLY_OPEN) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect((await res.json()).error.code, path).toBe('UNAUTHORIZED');
    }
    const write = await request.post('/api/suppliers', { data: {} });
    expect(write.status()).toBe(401);
    // Reaches the login route itself (its own error shape), not the guard
    const badLogin = await request.post('/api/auth/login', { data: { username: 'admin', password: 'wrong-password' } });
    expect(badLogin.status()).toBe(401);
    expect((await badLogin.json()).error).toBe('Username atau password salah');
    const session = await request.get('/api/auth/session');
    expect(session.status()).toBe(401);
    expect((await session.json()).success).toBe(false);
  });

  test('2. Admin login is Admin and the same endpoints work with the session cookie', async ({ request }) => {
    const user = await login(request, 'ADMIN', '5555');
    expect(user.userLevel).toBe('Admin');
    for (const path of PREVIOUSLY_OPEN) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });

  test('3. Normal user is Staff; a write needs the module view tick (403), reads stay open', async ({ playwright }) => {
    const staffUser = process.env.E2E_STAFF_USER;
    const staffPassword = process.env.E2E_STAFF_PASSWORD;
    const dbUrl = localDbUrl();
    test.skip(!staffUser || !staffPassword || !dbUrl, 'Needs E2E_STAFF_USER/PASSWORD and a local DATABASE_URL');

    const staff = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const db = new Client({ connectionString: dbUrl! });
    await db.connect();
    let insertedFor: number | null = null;
    try {
      const user = await login(staff, staffUser!, staffPassword!);
      expect(user.userLevel).toBe('Staff');
      const existing = await db.query('SELECT 1 FROM erp_user_permission WHERE user_id = $1', [user.id]);
      test.skip(existing.rowCount !== 0, 'Staff user already has saved permissions; not touching them');

      // No saved rows: today's default, writes reach the route (its own 400 validation)
      expect((await staff.post('/api/suppliers', { data: {} })).status()).toBe(400);

      await db.query(
        `INSERT INTO erp_user_permission (user_id, module_code, can_view) VALUES ($1, 'master-supplier', false), ($1, 'stok-opname', false)`,
        [user.id],
      );
      insertedFor = user.id;

      const denied = await staff.post('/api/suppliers', { data: {} });
      expect(denied.status()).toBe(403);
      const body = await denied.json();
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('Master Supplier');
      expect((await staff.put('/api/suppliers/1', { data: {} })).status()).toBe(403);
      expect((await staff.get('/api/suppliers?limit=1')).status()).toBe(200);
      // Master Barang still ticked: its "Tambahkan Stok Opname" may still post to the opname API (route validation 400)
      expect((await staff.post('/api/inventory/opname', { data: { action: 'draft' } })).status()).toBe(400);
      // Endpoints no ERP screen writes to are Admin only
      expect((await staff.post('/api/customers', { data: {} })).status()).toBe(403);
    } finally {
      if (insertedFor !== null) await db.query('DELETE FROM erp_user_permission WHERE user_id = $1', [insertedFor]);
      await db.end();
      await staff.dispose();
    }
  });

  test('4. A user whose User Type is Admin logs in as Admin', async ({ request }) => {
    const dbUrl = localDbUrl();
    test.skip(!dbUrl, 'Needs a local DATABASE_URL to find such a user');
    const db = new Client({ connectionString: dbUrl! });
    await db.connect();
    const { rows } = await db.query(`
      SELECT u.username, u.password FROM m_user u
      JOIN m_employee e ON e.id = u.employeeid JOIN m_position p ON p.id = e.positionid
      WHERE lower(p.positionname) = 'admin' AND lower(u.username) <> 'admin' AND u.password <> ''
      ORDER BY u.id LIMIT 1`);
    await db.end();
    test.skip(rows.length === 0, 'No non-"admin" user with User Type Admin in this database');
    const user = await login(request, rows[0].username, rows[0].password);
    expect(user.userLevel).toBe('Admin');
  });
});
