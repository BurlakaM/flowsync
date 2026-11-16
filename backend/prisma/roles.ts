import type { PrismaClient } from '@prisma/client';

// The ids are fixed: registration connects new users to the role named 'user'.
export const ROLES = [
  { id: 1, name: 'user' },
  { id: 2, name: 'admin' },
];

/** Idempotent. Shared by the dev seed and the e2e tests. */
export async function seedRoles(prisma: PrismaClient): Promise<void> {
  await prisma.role.createMany({ data: ROLES, skipDuplicates: true });

  // Rows were inserted with explicit ids, so move the auto-increment sequence past them.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"role"', 'id'), (SELECT MAX(id) FROM "role"))`,
  );
}
