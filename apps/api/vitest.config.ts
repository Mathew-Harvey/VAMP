import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/helpers/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 15000,
    fileParallelism: false, // Required for integration tests sharing SQLite DB
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/routes/invite.routes.ts',
        'src/routes/report.routes.ts',
        'src/services/invite.service.ts',
        'src/services/work-form.service.ts',
      ],
      exclude: [
        'prisma/**',
        'tests/**',
        '**/*.test.ts',
        'src/index.ts',
        'src/signaling.ts',
        'src/config/storage.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
