// Test setup - runs before all tests
// These must be set at module scope BEFORE any imports that reference env vars

import { execSync } from 'child_process';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long-for-testing';
process.env.JWT_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
// Use a separate Postgres test database when provided.
// Fallback to existing DATABASE_URL to avoid forcing local SQLite URLs
// which are invalid once Prisma provider is postgresql.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/marinestream_test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.APP_URL = 'http://localhost:5173';
process.env.API_URL = 'http://localhost:3001';

// Ensure test database schema is up to date
try {
  execSync('npx prisma db push', {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: 'pipe',
  });
} catch {
  // Ignore errors - DB may already be up to date
}
