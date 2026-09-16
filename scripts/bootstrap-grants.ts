import { prisma } from '../src/lib/db';

async function bootstrap(targetUsername = 'admin') {
  console.log(`Starting bootstrap for grant-administration authority on account: ${targetUsername}...`);

  const user = await prisma.user.findUnique({ where: { username: targetUsername } });
  if (!user) {
    throw new Error(`User ${targetUsername} not found!`);
  }

  // Grant 'auth.manageGrants' only
  const grant = await prisma.userGrant.upsert({
    where: {
      userId_permissionKey: {
        userId: user.id,
        permissionKey: 'auth.manageGrants',
      },
    },
    update: {},
    create: {
      userId: user.id,
      permissionKey: 'auth.manageGrants',
      grantedBy: user.id, // self-bootstrapped initial authority
    },
  });

  console.log(`✅ Successfully assigned grant-administration authority to ${targetUsername} (User ID: ${user.id}).`);

  // Verify HPP is NOT granted
  const hppGrant = await prisma.userGrant.findUnique({
    where: {
      userId_permissionKey: {
        userId: user.id,
        permissionKey: 'inventory.viewHpp',
      },
    },
  });

  console.log(`Verification: inventory.viewHpp is ${hppGrant ? 'GRANTED (unexpected)' : 'DENIED (as expected)'}.`);
}

const targetUser = process.argv[2] || 'admin';
bootstrap(targetUser)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
