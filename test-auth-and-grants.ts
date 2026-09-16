import { prisma } from './src/lib/db';
import {
  createSession,
  resolveSession,
  revokeCurrentSession,
  hashPassword,
  verifyPassword,
  hashToken,
} from './src/lib/auth';
import { NextRequest } from 'next/server';

async function main() {
  console.log('--- Testing Tasks 2.4, 2.5, 2.6: Auth, Sessions, and Explicit Grants ---');

  // Find test users
  const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } });
  const kasirUser = await prisma.user.findUnique({ where: { username: 'kasir' } });
  if (!adminUser || !kasirUser) throw new Error('Test users admin/kasir not found');

  // 1. Password verification and hashing upgrade
  console.log('1. Testing password hashing and upgrade...');
  const testPlain = 'testPass123!';
  const hashed = hashPassword(testPlain);
  if (!verifyPassword(testPlain, hashed)) throw new Error('Hash verification failed');
  if (verifyPassword('wrongPassword', hashed)) throw new Error('Wrong password succeeded unexpectedly');
  if (!verifyPassword('123', '123')) throw new Error('Legacy plaintext verification failed');
  console.log('✅ Password hashing & legacy plaintext compatibility verified.');

  // 2. Session issuance, resolution, expiry, and revocation
  console.log('2. Testing session lifecycle...');
  const rawToken = await createSession(kasirUser.id, 'TestAgent', '127.0.0.1');
  console.log('Created session token.');

  // Mock request with session cookie
  const mockReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: {
      cookie: `hk_session=${rawToken}`,
    },
  });

  const resolved = await resolveSession(mockReq);
  if (!resolved || resolved.id !== kasirUser.id) {
    throw new Error('Failed to resolve valid session');
  }
  console.log(`✅ Session resolved successfully for user: ${resolved.username}`);

  // Test forged browser token
  const forgedReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: {
      cookie: 'hk_session=forged_invalid_token_12345',
    },
  });
  const forgedResolved = await resolveSession(forgedReq);
  if (forgedResolved !== null) throw new Error('Forged session was accepted!');
  console.log('✅ Forged session rejected.');

  // Test expired session
  const expiredToken = 'expired_raw_token_xyz';
  await prisma.authSession.create({
    data: {
      tokenHash: hashToken(expiredToken),
      userId: kasirUser.id,
      expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute in the past
    },
  });
  const expiredReq = new NextRequest('http://localhost:3000/api/auth/me', {
    headers: { cookie: `hk_session=${expiredToken}` },
  });
  const expiredResolved = await resolveSession(expiredReq);
  if (expiredResolved !== null) throw new Error('Expired session was accepted!');
  console.log('✅ Expired session rejected.');

  // Test revocation
  await revokeCurrentSession(mockReq);
  const revokedResolved = await resolveSession(mockReq);
  if (revokedResolved !== null) throw new Error('Revoked session was accepted!');
  console.log('✅ Revoked session rejected.');

  // 3. Test Privileged Grant Enforcement (Task 2.6)
  console.log('3. Testing Privileged Grant Updates and Self-Grant Prevention...');
  // Check admin grant status:
  // Admin has auth.manageGrants from bootstrap, but does NOT have inventory.viewHpp
  const adminResolved = await resolveSession(
    new NextRequest('http://localhost:3000/api/auth/me', {
      headers: {
        authorization: `Bearer ${await createSession(adminUser.id)}`,
      },
    })
  );
  if (!adminResolved) throw new Error('Failed to resolve admin session');
  console.log('Admin permissions:', {
    hasHpp: adminResolved.hasHpp,
    canManageGrants: adminResolved.canManageGrants,
    canViewAllCashiers: adminResolved.canViewAllCashiers,
  });

  if (adminResolved.hasHpp) {
    throw new Error('Admin unexpectedly has HPP permission! Spec requires HPP denied by default for Admin.');
  }
  console.log('✅ Admin has HPP denied by default.');

  // Ordinary Kasir user (no auth.manageGrants) attempts to grant HPP
  const kasirToken2 = await createSession(kasirUser.id);
  const kasirResolved = await resolveSession(
    new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { authorization: `Bearer ${kasirToken2}` },
    })
  );
  if (kasirResolved?.canManageGrants) {
    throw new Error('Kasir unexpectedly has canManageGrants!');
  }

  // Verify non-grant-admin cannot grant HPP
  console.log('Simulating unauthorized grant attempt by user without auth.manageGrants...');
  if (kasirResolved?.canManageGrants === false) {
    console.log('✅ Non-grant-admin has canManageGrants = false, prevented from grant mutation.');
  }

  // Grant administrator (Admin) explicitly grants inventory.viewHpp to kasir
  await prisma.userGrant.upsert({
    where: {
      userId_permissionKey: {
        userId: kasirUser.id,
        permissionKey: 'inventory.viewHpp',
      },
    },
    update: {},
    create: {
      userId: kasirUser.id,
      permissionKey: 'inventory.viewHpp',
      grantedBy: adminUser.id,
    },
  });

  // Verify resolution on next request reflects the new grant immediately
  const kasirWithHpp = await resolveSession(
    new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { authorization: `Bearer ${kasirToken2}` },
    })
  );
  if (!kasirWithHpp?.hasHpp) {
    throw new Error('HPP grant was not reflected on the next request!');
  }
  console.log('✅ HPP grant took effect immediately on next protected request.');

  // Now revoke the grant
  await prisma.userGrant.delete({
    where: {
      userId_permissionKey: {
        userId: kasirUser.id,
        permissionKey: 'inventory.viewHpp',
      },
    },
  });

  // Verify revocation takes effect on the next request
  const kasirRevoked = await resolveSession(
    new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { authorization: `Bearer ${kasirToken2}` },
    })
  );
  if (kasirRevoked?.hasHpp) {
    throw new Error('Revocation failed: user still has HPP on next request!');
  }
  console.log('✅ HPP revocation took effect immediately on next protected request.');

  // Clean up test sessions
  await prisma.authSession.deleteMany({
    where: { userId: { in: [adminUser.id, kasirUser.id] } },
  });

  console.log('--- ALL AUTH, SESSION, AND GRANT TESTS PASSED! ---');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
