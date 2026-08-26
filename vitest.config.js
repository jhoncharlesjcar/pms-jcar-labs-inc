import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: [
        'src/services/**/*.ts',
        'src/constants/roomStatus.ts',
        'src/utils/errorMapping.ts',
        'src/lib/utils.js',
        'src/lib/logger.js',
        'src/lib/sync-queue.js',
      ],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75,
      },
    },
  },
});
