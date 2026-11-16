import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import { assertTestDatabase } from './utils/db';

/** Runs once before all e2e files: applies the committed migrations to the test database. */
export default function globalSetup(): void {
  config({ path: '.env' });
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5434/flowsync_test';

  assertTestDatabase(url);
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
