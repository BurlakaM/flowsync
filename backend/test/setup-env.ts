import { config } from 'dotenv';

// Picks up TEST_DATABASE_URL from backend/.env when it is set there (does not override real env vars).
config({ path: '.env' });

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET ??= 'e2e-test-secret';
// The cheapest bcrypt cost keeps the e2e tests fast.
process.env.BCRYPT_ROUNDS = '4';
// The e2e tests always use their own database, never DATABASE_URL from .env.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5434/flowsync_test';
