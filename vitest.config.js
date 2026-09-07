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
    // Valores dummy para que src/config/supabase.ts no lance en tiempo de
    // importación durante los tests unitarios: estos solo ejercitan funciones
    // puras y no realizan llamadas de red, por lo que no requieren el entorno real.
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
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
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
