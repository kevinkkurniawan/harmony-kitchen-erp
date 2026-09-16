import { prisma } from './src/lib/db';
import { createSession, resolveSession, revokeCurrentSession, hashPassword } from './src/lib/auth';

async function run() {
  console.log('--- PHASE 3 AUTOMATED VERIFICATION ---');

  // 1. Ensure test users exist:
  // User A: 'hpp_user' with grant 'inventory.viewHpp'
  // User B: 'no_hpp_user' without grant 'inventory.viewHpp'
  let hppUser = await prisma.user.findUnique({ where: { username: 'hpp_user' } });
  if (!hppUser) {
    hppUser = await prisma.user.create({
      data: {
        username: 'hpp_user',
        password: hashPassword('123456'),
        fullName: 'HPP Authorized User',
        userLevel: 'Manager',
        isActive: true,
      },
    });
  }

  let noHppUser = await prisma.user.findUnique({ where: { username: 'no_hpp_user' } });
  if (!noHppUser) {
    noHppUser = await prisma.user.create({
      data: {
        username: 'no_hpp_user',
        password: hashPassword('123456'),
        fullName: 'Restricted User',
        userLevel: 'Kasir',
        isActive: true,
      },
    });
  }

  // Ensure grants
  await prisma.userGrant.upsert({
    where: {
      userId_permissionKey: {
        userId: hppUser.id,
        permissionKey: 'inventory.viewHpp',
      },
    },
    update: {},
    create: {
      userId: hppUser.id,
      permissionKey: 'inventory.viewHpp',
      grantedBy: 1,
    },
  });

  // Ensure no_hpp_user has NO grants
  await prisma.userGrant.deleteMany({
    where: {
      userId: noHppUser.id,
      permissionKey: 'inventory.viewHpp',
    },
  });

  // Create test product with non-zero HPP
  const testBarcode = 'PHASE3-TEST-' + Date.now();
  const testProduct = await prisma.inventory.create({
    data: {
      barcode: testBarcode,
      inventoryNo: testBarcode,
      inventoryName: 'Barang Uji HPP Phase 3',
      price: 25000,
      hpp: 18500, // authoritative cost
      stock: 10,
    },
  });

  console.log(`Created test product id=${testProduct.id} with HPP=${testProduct.hpp}`);

  // Create sessions
  const hppToken = await createSession(hppUser.id);
  const noHppToken = await createSession(noHppUser.id);

  // 2. Resolve sessions
  // Mock requests
  const mockHppReq: any = {
    cookies: { get: () => ({ value: hppToken }) },
    headers: { get: () => null },
  };
  const mockNoHppReq: any = {
    cookies: { get: () => ({ value: noHppToken }) },
    headers: { get: () => null },
  };

  const resolvedHppUser = await resolveSession(mockHppReq);
  const resolvedNoHppUser = await resolveSession(mockNoHppReq);

  console.log(`Resolved HPP User hasHpp:`, resolvedHppUser?.hasHpp);
  console.log(`Resolved No-HPP User hasHpp:`, resolvedNoHppUser?.hasHpp);

  if (!resolvedHppUser?.hasHpp) throw new Error('Assertion failed: resolvedHppUser should have hasHpp=true');
  if (resolvedNoHppUser?.hasHpp) throw new Error('Assertion failed: resolvedNoHppUser should have hasHpp=false');

  // 3. Test API endpoint behavior via direct route handlers
  const { GET: getInventory } = await import('./src/app/api/inventory/route');
  const { GET: getInventoryItem, PUT: putInventoryItem } = await import('./src/app/api/inventory/[id]/route');
  const { GET: getHppHistory } = await import('./src/app/api/inventory/[id]/hpp-history/route');

  // A: Permitted user reading inventory
  const hppReqUrl = new URL(`http://localhost:3000/api/inventory?q=${testBarcode}`);
  const hppListRes = await getInventory(new Request(hppReqUrl, {
    headers: { Authorization: `Bearer ${hppToken}` },
  }) as any);
  const hppListJson = await hppListRes.json();
  const foundHppItem = hppListJson.data?.find((i: any) => i.barcode === testBarcode);
  console.log('Permitted read item HPP:', foundHppItem?.hpp);
  if (foundHppItem?.hpp !== 18500) throw new Error(`Assertion failed: expected HPP 18500, got ${foundHppItem?.hpp}`);

  // B: Restricted user reading inventory
  const noHppReqUrl = new URL(`http://localhost:3000/api/inventory?q=${testBarcode}`);
  const noHppListRes = await getInventory(new Request(noHppReqUrl, {
    headers: { Authorization: `Bearer ${noHppToken}` },
  }) as any);
  const noHppListJson = await noHppListRes.json();
  const foundNoHppItem = noHppListJson.data?.find((i: any) => i.barcode === testBarcode);
  console.log('Restricted read item HPP:', foundNoHppItem?.hpp);
  if (foundNoHppItem?.hpp !== undefined) {
    throw new Error(`Security Violation: Restricted user should NOT have hpp field projected, got ${foundNoHppItem?.hpp}`);
  }

  // C: Restricted user reading single item
  const noHppDetailRes = await getInventoryItem(
    new Request(`http://localhost:3000/api/inventory/${testProduct.id}`, {
      headers: { Authorization: `Bearer ${noHppToken}` },
    }) as any,
    { params: Promise.resolve({ id: String(testProduct.id) }) }
  );
  const noHppDetailJson = await noHppDetailRes.json();
  console.log('Restricted read detail HPP:', noHppDetailJson.data?.hpp);
  if (noHppDetailJson.data?.hpp !== undefined) {
    throw new Error('Security Violation: Restricted detail read should NOT have hpp field');
  }

  // D: Restricted user attempting to fetch HPP history
  const noHppHistoryRes = await getHppHistory(
    new Request(`http://localhost:3000/api/inventory/${testProduct.id}/hpp-history`, {
      headers: { Authorization: `Bearer ${noHppToken}` },
    }) as any,
    { params: Promise.resolve({ id: String(testProduct.id) }) }
  );
  console.log('Restricted HPP history status:', noHppHistoryRes.status);
  if (noHppHistoryRes.status !== 403) {
    throw new Error(`Security Violation: HPP history should return 403 Forbidden, got ${noHppHistoryRes.status}`);
  }

  // E: Restricted user attempting to overwrite HPP via PUT
  const noHppPutRes = await putInventoryItem(
    new Request(`http://localhost:3000/api/inventory/${testProduct.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${noHppToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price: 30000,
        hpp: 99999, // Unauthorized HPP alteration attempt
      }),
    }) as any,
    { params: Promise.resolve({ id: String(testProduct.id) }) }
  );
  const checkUpdated = await prisma.inventory.findUnique({ where: { id: testProduct.id } });
  console.log('Product price updated to:', checkUpdated?.price);
  console.log('Product HPP after restricted PUT attempt:', checkUpdated?.hpp);
  if (Number(checkUpdated?.hpp) === 99999) {
    throw new Error('Security Violation: Restricted user was able to modify HPP value!');
  }
  if (Number(checkUpdated?.hpp) !== 18500) {
    throw new Error(`Corrupted HPP value: expected 18500, found ${checkUpdated?.hpp}`);
  }

  // F: Logout / Revocation check
  await revokeCurrentSession(mockHppReq);
  const checkRevoked = await resolveSession(mockHppReq);
  console.log('Resolved user after logout/revocation:', checkRevoked);
  if (checkRevoked !== null) {
    throw new Error('Assertion failed: Revoked session must resolve to null');
  }

  // Cleanup test product
  await prisma.inventory.delete({ where: { id: testProduct.id } });

  console.log('✅ ALL PHASE 3 HPP AND ACCESS CHECKS PASSED!');
}

run()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
