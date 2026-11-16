import type { PrismaClient } from '@prisma/client';

/**
 * The e2e tests wipe the database, so they must never run against a real one.
 * Allowed: a database whose name contains "test", or any database in CI.
 */
export function assertTestDatabase(url = process.env.DATABASE_URL ?? ''): void {
  const databaseName = new URL(url).pathname.replace('/', '');
  if (process.env.CI === 'true' || /test/i.test(databaseName)) return;
  throw new Error(
    `Refusing to run e2e tests against database "${databaseName}": its name must contain "test". ` +
      'Start the test database with `docker compose --profile test up -d db_test`.',
  );
}

/** Empties every table (keeps the schema) and resets the id sequences. */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  assertTestDatabase();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}
