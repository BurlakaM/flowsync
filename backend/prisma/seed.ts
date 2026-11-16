import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Id фіксовані: код реєстрації використовує role_id = 1 за замовчуванням.
const roles = [
  { id: 1, name: 'user' },
  { id: 2, name: 'admin' },
];

async function main() {
  await prisma.role.createMany({ data: roles, skipDuplicates: true });

  // Після вставки з явними id вирівнюємо послідовність автоінкремента.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"role"', 'id'), (SELECT MAX(id) FROM "role"))`,
  );

  console.log(`Seed done: ${roles.map((r) => r.name).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
