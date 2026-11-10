import { describe, it } from 'node:test';
import assert from 'node:assert';
import { userTypeChangeError } from '../src/lib/user-type-rule';

// Run with: npx tsx --test tests/user-type-rule.test.ts
describe('User Type change rule (Setting - User, Change Password group)', () => {
  const otherAdmin = [{ username: 'siti', positionname: 'Admin' }];
  const noOtherAdmin = [{ username: 'linda', positionname: 'Kasir' }, { username: 'dwi', positionname: null }];

  it('allows any change that does not take Admin away', () => {
    assert.strictEqual(userTypeChangeError({ id: 2, username: 'linda', userType: 'Kasir' }, 'Supervisor', 5, noOtherAdmin), null);
    assert.strictEqual(userTypeChangeError({ id: 2, username: 'linda', userType: 'Kasir' }, 'Admin', 5, noOtherAdmin), null);
    // username admin stays Admin whatever its User Type, even on your own account
    assert.strictEqual(userTypeChangeError({ id: 5, username: 'admin', userType: 'Admin' }, 'Kasir', 5, noOtherAdmin), null);
  });

  it('refuses demoting your own account', () => {
    assert.match(userTypeChangeError({ id: 9, username: 'siti', userType: 'Admin' }, 'Kasir', 9, otherAdmin) ?? '', /akun Anda sendiri/);
  });

  it('refuses demoting the last Admin', () => {
    assert.match(userTypeChangeError({ id: 9, username: 'siti', userType: 'Admin' }, 'Manager', 5, noOtherAdmin) ?? '', /minimal satu Admin/);
    // User Type is matched like the login rule: trimmed, any case
    assert.match(userTypeChangeError({ id: 9, username: 'siti', userType: ' admin ' }, 'Kasir', 5, noOtherAdmin) ?? '', /minimal satu Admin/);
  });

  it('allows demoting an Admin while another Admin remains (by User Type or by username admin)', () => {
    assert.strictEqual(userTypeChangeError({ id: 9, username: 'siti', userType: 'Admin' }, 'Kasir', 5, otherAdmin), null);
    assert.strictEqual(userTypeChangeError({ id: 9, username: 'siti', userType: 'Admin' }, 'Kasir', 5, [{ username: 'ADMIN', positionname: 'Posisi 1' }]), null);
  });
});

describe('Rename rule (username "admin" is Admin by name)', () => {
  const noOtherAdmin = [{ username: 'linda', positionname: 'Kasir' }];
  it('refuses renaming the last Admin "admin" away', () => {
    assert.match(userTypeChangeError({ id: 5, username: 'admin', userType: 'Posisi 1' }, 'Posisi 1', 7, noOtherAdmin, 'budi') ?? '', /minimal satu Admin/);
    assert.match(userTypeChangeError({ id: 5, username: 'admin', userType: null }, null, 5, noOtherAdmin, 'budi') ?? '', /mengganti username akun Anda sendiri/);
  });
  it('allows the rename while another Admin remains, or when the User Type keeps Admin', () => {
    assert.strictEqual(userTypeChangeError({ id: 5, username: 'admin', userType: 'Posisi 1' }, 'Posisi 1', 7, [{ username: 'siti', positionname: 'Admin' }], 'budi'), null);
    assert.strictEqual(userTypeChangeError({ id: 5, username: 'admin', userType: 'Admin' }, 'Admin', 5, noOtherAdmin, 'budi'), null);
    assert.strictEqual(userTypeChangeError({ id: 2, username: 'linda', userType: 'Kasir' }, 'Kasir', 5, noOtherAdmin, 'lin'), null);
  });
});
