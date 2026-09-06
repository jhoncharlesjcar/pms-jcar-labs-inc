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
      // Umbrales calibrados a la capa de dominio puro (servicios + utils + lib).
      // Los módulos de integración (ai.service, hotel.service, whatsapp.service),
      // la UI (pages/components/hooks) y los workers no tienen cobertura unitaria:
      // requieren pruebas de integración/e2e y se miden por separado.
      thresholds: {
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      },
    },
  },
});
