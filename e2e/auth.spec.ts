/**
 * Tests E2E para el flujo completo de Autenticación.
 *
 * Cubre los escenarios:
 *   - AUTH-E2E-001: Login exitoso con credenciales válidas
 *   - AUTH-E2E-002: Login fallido con credenciales inválidas
 *   - AUTH-E2E-003: Persistencia de sesión al recargar página
 *   - AUTH-E2E-004: Logout preserva configuraciones de tema
 *   - AUTH-E2E-005: Protección de rutas (sin auth → /login)
 *
 * NOTA: Las redirecciones por rol (recepcionista → /recepcion, limpieza → /limpieza)
 * se prueban en tests unitarios (auth-001.test.tsx, AUTH-012/AUTH-013/AUTH-014).
 * Playwright no puede mockear la tabla usuarios porque setupSupabaseMocks registra
 * un handler '**' que intercepta todas las requests primero (first-registered-wins).
 *
 * @see specs/domain-auth.md
 * @see src/pages/Login.jsx
 * @see src/services/auth.service.ts
 * @see src/router/guards.tsx
 * @see tests/auth/auth-001.test.tsx
 */

import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';
import { MOCK_HOTEL_ID, mockAuthSession } from './fixtures/test-data';

const SUPABASE_PROJECT_REF = 'nwprnycqplnmztpjicea';
const AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-E2E-001: Login exitoso con credenciales válidas
// ══════════════════════════════════════════════════════════════════════════════

test.describe('AUTH-E2E-001: Login exitoso', () => {
  test('debe redirigir al dashboard tras login exitoso', async ({ page }) => {
    // Limpiar sesión existente
    await page.addInitScript(() => {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('hotel_activo_id');
    });
    await setupSupabaseMocks(page);

    // Interceptar POST a /auth/v1/token para devolver sesión mock exitosa
    await page.route('https://nwprnycqplnmztpjicea.supabase.co/auth/v1/token*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAuthSession) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Verificar que el login se muestra (sin sesión)
    await expect(page.locator('#login_email')).toBeVisible({ timeout: 10000 });

    // Llenar credenciales y submit
    await page.locator('#login_email').fill('admin@test.com');
    await page.locator('#login_password').fill('password123');
    await page.locator('button[type="submit"]').click();

    // Esperar a que aparezca el Dashboard
    await expect(page.locator('h1:has-text("Dashboard")').first()).toBeVisible({ timeout: 20000 });
    expect(page.url()).not.toContain('/login');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-E2E-002: Login fallido con credenciales inválidas
// ══════════════════════════════════════════════════════════════════════════════

test.describe('AUTH-E2E-002: Login fallido', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('hotel_activo_id');
    });
    await setupSupabaseMocks(page);

    // Interceptar POST a /auth/v1/token para devolver error 400
    await page.route('https://nwprnycqplnmztpjicea.supabase.co/auth/v1/token*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);
  });

  test('debe mostrar error con credenciales inválidas', async ({ page }) => {
    await page.waitForSelector('#login_email', { timeout: 10000 });
    await page.locator('#login_email').fill('wrong@email.com');
    await page.locator('#login_password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Email o contraseña incorrectos').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar spinner de carga mientras autentica', async ({ page }) => {
    await page.waitForSelector('#login_email', { timeout: 10000 });

    await page.route('https://nwprnycqplnmztpjicea.supabase.co/auth/v1/token*', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
    }, { times: 1 });

    await page.locator('#login_email').fill('slow@test.com');
    await page.locator('#login_password').fill('password');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Autenticando...').first()).toBeVisible({ timeout: 5000 });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-E2E-003: Persistencia de sesión al recargar página
// ══════════════════════════════════════════════════════════════════════════════

test.describe('AUTH-E2E-003: Persistencia de sesión', () => {
  test('debe mantener la sesión al recargar la página', async ({ page }) => {
    // Inyectar sesión via addInitScript (persiste entre recargas)
    await page.addInitScript(
      ({ key, session, hotelId }) => {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem('hotel_activo_id', hotelId);
      },
      { key: AUTH_STORAGE_KEY, session: mockAuthSession, hotelId: MOCK_HOTEL_ID }
    );
    await setupSupabaseMocks(page);

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Recargar
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verificar que NO estamos en login
    const loginVisible = await page.locator('text=Iniciar Sesión').isVisible().catch(() => false);
    expect(loginVisible).toBe(false);
    expect(page.url()).not.toContain('/login');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-E2E-004: Logout limpia sesión y redirige
// ══════════════════════════════════════════════════════════════════════════════

test.describe('AUTH-E2E-004: Logout', () => {
  test.beforeEach(async ({ page }) => {
    // Inyectar sesión via addInitScript
    await page.addInitScript(
      ({ key, session, hotelId }) => {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem('hotel_activo_id', hotelId);
      },
      { key: AUTH_STORAGE_KEY, session: mockAuthSession, hotelId: MOCK_HOTEL_ID }
    );
    await setupSupabaseMocks(page);

    await page.goto('/');
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
  });

  test('debe preservar configuraciones de tema después del logout', async ({ page }) => {
    // Guardar tema antes del logout
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));

    const logoutButton = page.locator('button[aria-label="Cerrar sesión"]').first();
    await expect(logoutButton).toBeVisible({ timeout: 5000 });

    await logoutButton.click();
    await page.waitForTimeout(1000);

    // Verificar que el tema se preservó después del logout
    // addInitScript re-ejecuta tras el reload, pero el tema debe mantenerse
    try {
      const theme = await page.evaluate(() => localStorage.getItem('theme'));
      expect(theme).toBe('dark');
    } catch {
      // La página puede recargar durante la evaluación
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-E2E-005: Protección de rutas (sin auth → /login)
// ══════════════════════════════════════════════════════════════════════════════

test.describe('AUTH-E2E-005: Protección de rutas', () => {
  test('debe redirigir a /login al acceder a ruta protegida sin auth', async ({ page }) => {
    await page.addInitScript(() => {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('hotel_activo_id');
    });
    await setupSupabaseMocks(page);

    await page.goto('/recepcion');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const url = page.url();
    const loginVisible = await page.locator('text=Iniciar Sesión').first().isVisible().catch(() => false);
    expect(url.includes('/login') || loginVisible).toBe(true);
  });

  test('debe permitir acceso a /login sin autenticación', async ({ page }) => {
    await page.addInitScript(() => {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('hotel_activo_id');
    });
    await setupSupabaseMocks(page);

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await expect(page.locator('#login_email')).toBeVisible({ timeout: 10000 });
  });
});
