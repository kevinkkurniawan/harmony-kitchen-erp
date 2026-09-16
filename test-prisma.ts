import { prisma } from './src/lib/db';

async function main() {
  try {
    const inv = await prisma.inventory.findFirst();
    console.log('PRISMA INVENTORY OK:', inv?.inventoryName, 'Price:', inv?.price, 'HPP:', inv?.hpp);

    const headers = await prisma.salesPOSHeader.findMany({ take: 2 });
    console.log('PRISMA SALES POS HEADERS OK:', headers.length, headers.map(h => h.salesPOSNo));

    const users = await prisma.user.findMany();
    console.log('PRISMA USERS OK:', users.length, users.map(u => u.username));

    const grants = await prisma.userGrant.findMany();
    console.log('PRISMA GRANTS OK:', grants.length);

    const sessions = await prisma.authSession.findMany();
    console.log('PRISMA SESSIONS OK:', sessions.length);

    console.log('ALL PRISMA MODELS VERIFIED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('PRISMA TEST ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
