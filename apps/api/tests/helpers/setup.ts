// Test setup - runs before all tests
// These must be set at module scope BEFORE any imports that reference env vars

import path from 'path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long-for-testing';
process.env.JWT_EXPIRY = '15m';
process.env.REFRESH_TOKEN_EXPIRY = '7d';
process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`;
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.APP_URL = 'http://localhost:5173';
process.env.API_URL = 'http://localhost:3001';
