import { prisma } from './src/lib/db';

async function main() {
  console.log('Testing Task 2.2: checkout request identity, payment/cashier metadata, and idempotency...');

  // 1. Verify legacy records (created before migration) remain readable
  const legacyHeaders = await prisma.salesPOSHeader.findMany({
    where: { checkoutKey: null },
    take: 5,
    include: { details: true },
  });
  console.log(`Verified legacy records readable: ${legacyHeaders.length} headers found.`);
  if (legacyHeaders.length === 0) throw new Error('No legacy records found without checkoutKey');

  // Verify legacy header structure
  const sampleLegacy = legacyHeaders[0];
  console.log('Sample legacy header:', {
    id: sampleLegacy.id,
    no: sampleLegacy.salesPOSNo,
    cashierName: sampleLegacy.cashierName,
    checkoutKey: sampleLegacy.checkoutKey,
    detailsCount: sampleLegacy.details.length,
  });

  // 2. Test retry keys cannot create two completed sales
  const testKey = `RETRY-KEY-TEST-${Date.now()}`;
  const inv = await prisma.inventory.findFirst();
  if (!inv) throw new Error('No inventory item found');

  const sale1 = await prisma.salesPOSHeader.create({
    data: {
      salesPOSNo: `INV-KEY-1-${Date.now()}`,
      customerName: 'Test Idempotency',
      totalAmount: 10000,
      grandTotal: 10000,
      cashierName: 'Kasir Utama',
      cashierId: 4,
      checkoutKey: testKey,
      paymentMethod: 'QRIS',
      cashPaid: 10000,
      changeAmount: 0,
    },
  });
  console.log('Successfully created first sale with checkoutKey:', sale1.id, sale1.checkoutKey);

  // Attempt duplicate checkout key
  let duplicatePrevented = false;
  try {
    await prisma.salesPOSHeader.create({
      data: {
        salesPOSNo: `INV-KEY-2-${Date.now()}`,
        customerName: 'Test Idempotency Duplicate',
        totalAmount: 10000,
        grandTotal: 10000,
        cashierName: 'Kasir Utama',
        cashierId: 4,
        checkoutKey: testKey, // Same key!
        paymentMethod: 'QRIS',
        cashPaid: 10000,
        changeAmount: 0,
      },
    });
  } catch (err: any) {
    duplicatePrevented = true;
    console.log('Duplicate key successfully prevented by database constraint:', err.code || err.message);
  }

  if (!duplicatePrevented) {
    throw new Error('FAILED: Duplicate checkout key was allowed to create a second sale!');
  }

  // Cleanup test sale
  await prisma.salesPOSHeader.delete({ where: { id: sale1.id } });
  console.log('Cleaned up test sale. Task 2.2 verification passed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
