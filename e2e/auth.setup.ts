/**
 * Auth setup global para Playwright.
 * Configura el estado de autenticación usando addInitScript para que
 * localStorage se establezca ANTES de que Supabase se inicialice.
 *
 * Esto evita que Supabase dispare INITIAL_SESSION sin sesión y fije
 * authError = 'auth_required' en el estado de la aplicación.
 */
import { test as setup, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';
import { MOCK_HOTEL_ID, mockAuthSession } from './fixtures/test-data';

const AUTH_FILE = 'playwright/.auth/user.json';
const SUPABASE_PROJECT_REF = 'nwprnycqplnmztpjicea';
const AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

setup('autenticar como admin', async ({ page }) => {
  // 1. Registrar script que se ejecutará antes que cualquier script de la app.
  //    Esto inyecta la sesión en localStorage para que el cliente de Supabase
  //    la encuentre al inicializarse (INITIAL_SESSION event con sesión).
  await page.addInitScript(
    ({ key, session, hotelId }) => {
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem('hotel_activo_id', hotelId);
      localStorage.setItem('theme', 'light');
    },
    { key: AUTH_STORAGE_KEY, session: mockAuthSession, hotelId: MOCK_HOTEL_ID }
  );

  // 2. Configurar los mocks de red para interceptar todas las APIs de Supabase
  await setupSupabaseMocks(page);

  // 3. Navegar al dashboard
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 4. Esperar a que React Query cargue y el dashboard se renderice
  //    Timeout total: ~10s (muy por debajo del limite de 30s)
  try {
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
    await page.waitForSelector('text=Ocupación', { timeout: 5000 });
  } catch {
    // Si falla, intentamos ver si estamos en Login (error de auth)
    const loginVisible = await page.locator('text=Iniciar Sesión').isVisible().catch(() => false);
    if (loginVisible) {
      console.error('[Auth Setup] La app mostró Login en vez del Dashboard');
    }
  }

  // 5. Guardar el estado (localStorage) para tests subsecuentes
  await page.context().storageState({ path: AUTH_FILE });
});
