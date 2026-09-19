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
        'src/services/caja.service.ts',
        'src/services/checkout.service.ts',
        'src/services/habitaciones.service.ts',
        'src/services/hotel.service.ts',
        'src/services/recepcion.service.ts',
        'src/services/ventas.service.ts',
        'src/services/whatsapp.service.ts',
        'src/constants/roomStatus.ts',
        'src/utils/errorMapping.ts',
        'src/lib/utils.js',
        'src/lib/logger.js',
        'src/lib/sync-queue.js',
      ],
      // Umbrales calibrados a la capa de dominio puro (servicios + utils + lib).
      // Los hooks y componentes requieren jsdom + testing-library (Fase 1.2).
      // ai.service y loyalty.service requieren refactor para testabilidad (Fase 1.2).
      thresholds: {
        statements: 65,
        branches: 50,
        functions: 70,
        lines: 65,
      },
    },
  },
});
