import { PrismaClient } from '@prisma/client';
import { ROLES, seedRoles } from './roles';

const prisma = new PrismaClient();

async function main() {
  await seedRoles(prisma);
  console.log(`Seed done: ${ROLES.map((role) => role.name).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
