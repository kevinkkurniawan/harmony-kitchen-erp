import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const t of ['m_category', 'm_brand', 'm_uom', 'm_bank_account', 'm_customer', 'm_employee', 'm_position', 'm_promo', 'm_promo_group', 'm_supplier']) {
      const count: any = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "${t}"`);
      console.log(`Table ${t}: count = ${count[0].count}`);
    }
  } catch (err: any) {
    console.error('ERROR:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
