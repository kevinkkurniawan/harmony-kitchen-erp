import { prisma } from './src/lib/db';

async function main() {
  console.log('Testing sale persistence with two differently priced lines for the same product...');
  const inv = await prisma.inventory.findFirst({ where: { barcode: '8990011145727' } });
  if (!inv) throw new Error('Test product not found');

  const originalPrice = inv.price;

  // 1. Create header
  const header = await prisma.salesPOSHeader.create({
    data: {
      salesPOSNo: `TEST-POS-${Date.now()}`,
      salesPOSDate: new Date(),
      customerName: 'Test Customer',
      totalAmount: 147500 + 140000 * 2,
      discountAmount: 0,
      grandTotal: 147500 + 140000 * 2,
      cashierName: 'Kasir Test',
      status: 'COMPLETED',
      checkoutKey: `checkout-key-${Date.now()}`,
      paymentMethod: 'CASH',
      cashPaid: 500000,
      changeAmount: 500000 - (147500 + 140000 * 2),
      isGrosirMode: false,
    },
  });

  // 2. Create two lines with different prices for the same product
  const detail1 = await prisma.salesPOSDetail.create({
    data: {
      headerId: header.id,
      barcode: inv.barcode,
      inventoryNo: inv.inventoryNo,
      inventoryName: inv.inventoryName,
      qty: 1,
      price: 147500,
      subtotal: 147500,
      priceType: 'retail',
      quoteRef: 'quote-test-1',
    },
  });

  const detail2 = await prisma.salesPOSDetail.create({
    data: {
      headerId: header.id,
      barcode: inv.barcode,
      inventoryNo: inv.inventoryNo,
      inventoryName: inv.inventoryName,
      qty: 2,
      price: 140000,
      subtotal: 280000,
      priceType: 'grosir1',
      quoteRef: 'quote-test-2',
    },
  });

  console.log('Created header ID:', header.id);
  console.log('Created detail 1 ID:', detail1.id, 'Price:', detail1.price, 'Type:', detail1.priceType);
  console.log('Created detail 2 ID:', detail2.id, 'Price:', detail2.price, 'Type:', detail2.priceType);

  // 3. Query back details for the header
  const fetchedDetails = await prisma.salesPOSDetail.findMany({
    where: { headerId: header.id },
  });
  console.log('Fetched details count for same product:', fetchedDetails.length);
  if (fetchedDetails.length !== 2) throw new Error('Expected 2 details for same product');

  // 4. Verify original master inventory price unchanged
  const currentInv = await prisma.inventory.findUnique({ where: { id: inv.id } });
  console.log('Original master price:', originalPrice, 'Current master price:', currentInv?.price);
  if (currentInv?.price !== originalPrice) throw new Error('Master price was altered!');

  // Cleanup test transaction
  await prisma.salesPOSDetail.deleteMany({ where: { headerId: header.id } });
  await prisma.salesPOSHeader.delete({ where: { id: header.id } });
  console.log('Cleaned up test sale. Task 2.1 verification passed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
