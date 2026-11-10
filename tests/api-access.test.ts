import { describe, it } from 'node:test';
import assert from 'node:assert';
import { decideWrite, isPublicApiPath, isWriteMethod, writeModulesFor } from '../src/lib/api-access';
import { resolveUserLevel } from '../src/lib/session';

describe('Role rule: Admin = User Type "Admin" or username admin', () => {
  it('username admin is Admin in any case', () => {
    assert.strictEqual(resolveUserLevel('admin', 'Posisi 1'), 'Admin');
    assert.strictEqual(resolveUserLevel(' ADMIN ', null), 'Admin');
  });
  it('User Type Admin makes any user Admin', () => {
    assert.strictEqual(resolveUserLevel('siti', 'Admin'), 'Admin');
    assert.strictEqual(resolveUserLevel('siti', ' admin '), 'Admin');
  });
  it('everyone else is a normal user, whatever the name or type', () => {
    assert.strictEqual(resolveUserLevel('linda', 'Posisi 1'), 'Staff');
    assert.strictEqual(resolveUserLevel('dwi', 'Kasir'), 'Staff');
    assert.strictEqual(resolveUserLevel('kasir-manager', undefined), 'Staff');
    assert.strictEqual(resolveUserLevel('administrator', 'Administrator'), 'Staff');
    assert.strictEqual(resolveUserLevel(null, null), 'Staff');
  });
});

describe('API guard rules', () => {
  it('only the auth endpoints are public', () => {
    assert.ok(isPublicApiPath('/api/auth/login'));
    assert.ok(isPublicApiPath('/api/auth/logout/'));
    assert.ok(isPublicApiPath('/api/auth/session'));
    assert.ok(!isPublicApiPath('/api/auth/login/x'));
    assert.ok(!isPublicApiPath('/api/inventory'));
    assert.ok(!isPublicApiPath('/api/auth'));
  });

  it('write methods', () => {
    for (const m of ['POST', 'put', 'PATCH', 'DELETE']) assert.ok(isWriteMethod(m));
    for (const m of ['GET', 'HEAD', 'OPTIONS']) assert.ok(!isWriteMethod(m));
  });

  it('maps paths to modules on segment boundaries, most specific first', () => {
    assert.deepStrictEqual(writeModulesFor('/api/inventory/opname'), ['stok-opname', 'master-barang']);
    assert.deepStrictEqual(writeModulesFor('/api/inventory/12'), ['master-barang']);
    assert.deepStrictEqual(writeModulesFor('/api/inventory/usage'), []);
    assert.deepStrictEqual(writeModulesFor('/api/inventoryx'), []);
    assert.deepStrictEqual(writeModulesFor('/api/promos/items/5'), ['master-promo']);
    assert.deepStrictEqual(writeModulesFor('/api/purchasing/express'), ['penerimaan-barang']);
    assert.deepStrictEqual(writeModulesFor('/api/purchasing/priced/3'), ['penerimaan-barang-harga']);
    assert.deepStrictEqual(writeModulesFor('/api/purchasing/payments'), []);
    assert.deepStrictEqual(writeModulesFor('/api/users/permissions'), []);
    assert.deepStrictEqual(writeModulesFor('/api/barcode/print'), ['cetak-barcode']);
  });

  it('non-admin write needs the view tick of one owning module', () => {
    const perms = [
      { moduleCode: 'master-supplier', canView: false },
      { moduleCode: 'stok-opname', canView: false },
      { moduleCode: 'master-barang', canView: true },
    ];
    assert.deepStrictEqual(decideWrite('/api/inventory/opname', perms), { allowed: true });
    assert.deepStrictEqual(decideWrite('/api/inventory', perms), { allowed: true });
    const denied = decideWrite('/api/suppliers/7', perms);
    assert.strictEqual(denied.allowed, false);
    assert.match(!denied.allowed ? denied.message : '', /Master Supplier/);
    const both = decideWrite('/api/inventory/opname', perms.map((p) => ({ ...p, canView: false })));
    assert.match(!both.allowed ? both.message : '', /Stok Opname atau Master Barang/);
  });

  it('a module without a saved row keeps the default (allowed); unmapped writes are Admin only', () => {
    assert.deepStrictEqual(decideWrite('/api/suppliers', []), { allowed: true });
    assert.deepStrictEqual(decideWrite('/api/barcode/print', [{ moduleCode: 'master-barang', canView: false }]), { allowed: true });
    assert.strictEqual(decideWrite('/api/customers', []).allowed, false);
  });
});
