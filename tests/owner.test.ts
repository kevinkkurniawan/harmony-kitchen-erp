import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isOwnerUsername } from '../src/lib/owner';

// Run with: npx tsx --test tests/owner.test.ts
describe('Owner login (only "admin" changes stock)', () => {
  it('matches the admin login only, ignoring case and spaces', () => {
    assert.ok(isOwnerUsername('admin'));
    assert.ok(isOwnerUsername(' Admin '));
    for (const u of ['siti', 'admin2', 'administrator', '', null, undefined]) assert.ok(!isOwnerUsername(u), String(u));
  });
});
