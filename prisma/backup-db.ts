import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`CREATE DATABASE harmony_erp_backup TEMPLATE harmony_erp;`);
    console.log('Successfully created harmony_erp_backup!');
  } catch (err: any) {
    console.error('Backup note:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
