import { prisma } from 'c:/Ray/Project/harmony-kitchen-erp/src/lib/db';
import { createSession, hashPassword } from 'c:/Ray/Project/harmony-kitchen-erp/src/lib/auth';
import { GET as exportGetHandler } from 'c:/Ray/Project/harmony-kitchen-erp/src/app/api/inventory/export/route';
import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';

async function run() {
  console.log('--- PHASE 9 AUTOMATED TEST SUITE: INVENTORY XLSX & CSV EXPORT ---');

  // Clean up any test fixtures from previous runs
  await prisma.inventory.deleteMany({
    where: { inventoryNo: { startsWith: 'TEST-EXP-' } }
  });

  // 1. Setup Test Users
  // User 1: Authorized with inventory.viewHpp
  let userHpp = await prisma.user.findUnique({ where: { username: 'export_test_hpp' } });
  if (!userHpp) {
    userHpp = await prisma.user.create({
      data: {
        username: 'export_test_hpp',
        password: hashPassword('123456'),
        fullName: 'Export User With HPP',
        userLevel: 'Admin',
        isActive: true,
      },
    });
  }
  const hasHppGrant = await prisma.userGrant.findFirst({
    where: { userId: userHpp.id, permissionKey: 'inventory.viewHpp' },
  });
  if (!hasHppGrant) {
    await prisma.userGrant.create({
      data: { userId: userHpp.id, permissionKey: 'inventory.viewHpp' },
    });
  }

  // User 2: Restricted without inventory.viewHpp
  let userNoHpp = await prisma.user.findUnique({ where: { username: 'export_test_nohpp' } });
  if (!userNoHpp) {
    userNoHpp = await prisma.user.create({
      data: {
        username: 'export_test_nohpp',
        password: hashPassword('123456'),
        fullName: 'Export User No HPP',
        userLevel: 'Staff',
        isActive: true,
      },
    });
  }
  await prisma.userGrant.deleteMany({
    where: { userId: userNoHpp.id, permissionKey: 'inventory.viewHpp' },
  });

  const tokenHpp = await createSession(userHpp.id);
  const tokenNoHpp = await createSession(userNoHpp.id);

  // 2. Setup Test Inventory Fixtures
  await prisma.inventory.create({
    data: {
      inventoryNo: 'TEST-EXP-001',
      barcode: '0008492019', // Leading zeroes
      inventoryName: 'Panci Maspion Stainless 24cm Super',
      price: 120000,
      hpp: 77777, // Unique HPP value
      grosir1: 110000,
      grosir2: 105000,
      grosir3: 100000,
      stock: 45,
      isActive: true,
    },
  });

  await prisma.inventory.create({
    data: {
      inventoryNo: 'TEST-EXP-002',
      barcode: '@987654321', // Formula trigger symbol @
      inventoryName: '=SUM(A1:B10) Test Formula Wajan', // Formula injection attempt
      price: 85000,
      hpp: 44444, // Unique HPP value
      grosir1: 80000,
      grosir2: 78000,
      grosir3: 75000,
      stock: 12,
      isActive: true,
    },
  });

  console.log('✓ Test fixtures initialized successfully');

  // --- SCENARIO 1: Unauthenticated request must return 401 ---
  console.log('\n[Scenario 1] Testing unauthenticated access to export endpoint...');
  const reqUnauth = new NextRequest('http://localhost:3000/api/inventory/export?q=TEST-EXP-');
  const resUnauth = await exportGetHandler(reqUnauth);
  if (resUnauth.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated export, got: ${resUnauth.status}`);
  }
  console.log('✓ PASS: Unauthenticated export blocked with 401 Unauthorized');

  // --- SCENARIO 2: Authorized user XLSX export (Includes HPP, typed cells, literal formatting) ---
  console.log('\n[Scenario 2] Testing XLSX export for user WITH inventory.viewHpp...');
  const reqHpp = new NextRequest('http://localhost:3000/api/inventory/export?q=TEST-EXP-&format=xlsx', {
    headers: { Authorization: `Bearer ${tokenHpp}` },
  });
  const resHpp = await exportGetHandler(reqHpp);
  if (resHpp.status !== 200) {
    const errBody = await resHpp.text();
    throw new Error(`Expected 200 for authorized XLSX export, got: ${resHpp.status}, body: ${errBody}`);
  }
  const contentTypeHpp = resHpp.headers.get('content-type');
  if (!contentTypeHpp?.includes('openxmlformats-officedocument.spreadsheetml.sheet')) {
    throw new Error(`Invalid content-type: ${contentTypeHpp}`);
  }

  // Parse workbook using ExcelJS
  const arrayBufferHpp = await resHpp.arrayBuffer();
  const bufferHpp = Buffer.from(arrayBufferHpp);
  const wbHpp = new ExcelJS.Workbook();
  await wbHpp.xlsx.load(bufferHpp as any);

  const sheetHpp = wbHpp.getWorksheet('Master Data Barang');
  if (!sheetHpp) throw new Error('Worksheet "Master Data Barang" not found in workbook');

  // Verify header row (row 4)
  const headerRowHpp = sheetHpp.getRow(4);
  const headersHpp: string[] = [];
  headerRowHpp.eachCell((c) => headersHpp.push(String(c.value)));
  console.log('Authorized Headers:', headersHpp);

  if (!headersHpp.includes('HPP Modal (Rp)')) {
    throw new Error('Expected "HPP Modal (Rp)" header for authorized user');
  }

  // Verify row 5 (item 1)
  const row5 = sheetHpp.getRow(5);
  const barcodeCell = row5.getCell(3); // Barcode
  console.log('Row 5 Barcode Cell:', { value: barcodeCell.value, numFmt: barcodeCell.numFmt });
  if (barcodeCell.value !== '0008492019') {
    throw new Error(`Expected barcode '0008492019' with leading zero, got: ${barcodeCell.value}`);
  }
  if (barcodeCell.numFmt !== '@') {
    throw new Error(`Expected barcode numFmt '@', got: ${barcodeCell.numFmt}`);
  }

  // Find HPP column index in headers
  const hppColIdx = headersHpp.indexOf('HPP Modal (Rp)') + 1;
  const hppValRow5 = row5.getCell(hppColIdx).value;
  console.log(`Row 5 HPP value at column ${hppColIdx}:`, hppValRow5);
  if (hppValRow5 !== 77777) {
    throw new Error(`Expected HPP 77777 for authorized user, got: ${hppValRow5}`);
  }

  // Verify row 6 (item 2: formula escaping)
  const row6 = sheetHpp.getRow(6);
  const formulaNameCell = row6.getCell(4).value;
  console.log('Row 6 Formula Item Name:', formulaNameCell);
  if (typeof formulaNameCell === 'string' && !formulaNameCell.startsWith("'=")) {
    throw new Error(`Expected formula injection trigger '=' to be escaped with leading single quote, got: ${formulaNameCell}`);
  }
  console.log('✓ PASS: Authorized XLSX contains HPP (77777), preserved leading-zero barcodes, and formula escaping');

  // --- SCENARIO 3: Unauthorized user XLSX export (MUST NOT contain HPP anywhere) ---
  console.log('\n[Scenario 3] Testing XLSX export for user WITHOUT inventory.viewHpp...');
  const reqNoHpp = new NextRequest('http://localhost:3000/api/inventory/export?q=TEST-EXP-&format=xlsx', {
    headers: { Authorization: `Bearer ${tokenNoHpp}` },
  });
  const resNoHpp = await exportGetHandler(reqNoHpp);
  if (resNoHpp.status !== 200) {
    const errBody = await resNoHpp.text();
    throw new Error(`Expected 200 for unauthorized user XLSX export, got: ${resNoHpp.status}, body: ${errBody}`);
  }

  const arrayBufferNoHpp = await resNoHpp.arrayBuffer();
  const bufferNoHpp = Buffer.from(arrayBufferNoHpp);
  const wbNoHpp = new ExcelJS.Workbook();
  await wbNoHpp.xlsx.load(bufferNoHpp as any);

  const sheetNoHpp = wbNoHpp.getWorksheet('Master Data Barang');
  if (!sheetNoHpp) throw new Error('Worksheet "Master Data Barang" not found in workbook');

  const headerRowNoHpp = sheetNoHpp.getRow(4);
  const headersNoHpp: string[] = [];
  headerRowNoHpp.eachCell((c) => headersNoHpp.push(String(c.value)));
  console.log('Restricted Headers:', headersNoHpp);

  if (headersNoHpp.includes('HPP Modal (Rp)')) {
    throw new Error('SECURITY BREACH: "HPP Modal (Rp)" header found in restricted user export');
  }

  // Exhaustive check across ALL cells in the sheet for restricted HPP values
  sheetNoHpp.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      const cellVal = cell.value;
      if (cellVal === 77777 || cellVal === 44444) {
        throw new Error(`SECURITY BREACH: Restricted HPP value ${cellVal} leaked at cell (${rowNumber}, ${colNumber})`);
      }
      if (typeof cellVal === 'string' && cellVal.toLowerCase().includes('hpp')) {
        throw new Error(`SECURITY BREACH: HPP text leaked at cell (${rowNumber}, ${colNumber}): ${cellVal}`);
      }
    });
  });
  console.log('✓ PASS: Restricted XLSX strictly omits HPP header, HPP column, and all cost values');

  // --- SCENARIO 4: CSV Export with HPP vs without HPP ---
  console.log('\n[Scenario 4] Testing CSV export format...');
  // 4a. With HPP
  const reqCsvHpp = new NextRequest('http://localhost:3000/api/inventory/export?q=TEST-EXP-&format=csv', {
    headers: { Authorization: `Bearer ${tokenHpp}` },
  });
  const resCsvHpp = await exportGetHandler(reqCsvHpp);
  if (resCsvHpp.status !== 200) {
    throw new Error(`CSV export failed: ${resCsvHpp.status}`);
  }
  const csvHppText = await resCsvHpp.text();
  if (!csvHppText.includes('HPP Modal (Rp)')) {
    throw new Error('CSV authorized export missing "HPP Modal (Rp)"');
  }
  if (!csvHppText.includes('77777')) {
    throw new Error('CSV authorized export missing HPP value 77777');
  }

  // 4b. Without HPP
  const reqCsvNoHpp = new NextRequest('http://localhost:3000/api/inventory/export?q=TEST-EXP-&format=csv', {
    headers: { Authorization: `Bearer ${tokenNoHpp}` },
  });
  const resCsvNoHpp = await exportGetHandler(reqCsvNoHpp);
  const csvNoHppText = await resCsvNoHpp.text();
  if (csvNoHppText.includes('HPP Modal (Rp)')) {
    throw new Error('SECURITY BREACH: CSV restricted export contains "HPP Modal (Rp)" header');
  }
  if (csvNoHppText.includes('77777') || csvNoHppText.includes('44444')) {
    throw new Error('SECURITY BREACH: CSV restricted export contains confidential HPP values');
  }
  console.log('✓ PASS: CSV export adheres to HPP security and format sanitization');

  // --- SCENARIO 5: Empty filter result handling (404, isEmpty) ---
  console.log('\n[Scenario 5] Testing empty filter query...');
  const reqEmpty = new NextRequest('http://localhost:3000/api/inventory/export?q=NON_EXISTENT_PRODUCT_1234567890', {
    headers: { Authorization: `Bearer ${tokenHpp}` },
  });
  const resEmpty = await exportGetHandler(reqEmpty);
  if (resEmpty.status !== 404) {
    throw new Error(`Expected 404 for empty export result, got: ${resEmpty.status}`);
  }
  const emptyJson = await resEmpty.json();
  if (!emptyJson.isEmpty || emptyJson.count !== 0) {
    throw new Error(`Expected { isEmpty: true, count: 0 }, got: ${JSON.stringify(emptyJson)}`);
  }
  console.log('✓ PASS: Empty filter query cleanly returns 404 with isEmpty: true and informative error');

  // Cleanup
  await prisma.inventory.deleteMany({
    where: { inventoryNo: { startsWith: 'TEST-EXP-' } }
  });
  console.log('\n>>> ALL PHASE 9 EXPORT SPECIFICATIONS VERIFIED SUCCESSFULLY! <<<');
}

run()
  .catch((err) => {
    console.error('TEST RUN FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
