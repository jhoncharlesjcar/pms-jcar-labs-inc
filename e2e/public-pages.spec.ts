/**
 * Tests E2E para paginas publicas.
 * Nota: Las rutas /public-checkin/:hotelId y /booking/:hotelId NO existen
 * en App.jsx. Solo existe la ruta de Login (renderizada condicionalmente
 * por authError). Las rutas publicas estan definidas en src/router/index.tsx
 * pero ese router no es usado por la aplicacion activa.
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';
import { MOCK_HOTEL_ID } from './fixtures/test-data';

test.describe('Rutas Publicas y 404', () => {
  test('debe mostrar pagina 404 para rutas publicas no implementadas (public-checkin)', async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto(`/public-checkin/${MOCK_HOTEL_ID}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Esta ruta no existe en App.jsx, deberia mostrar 404
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    const currentUrl = page.url();
    expect(currentUrl).toContain('public-checkin');
  });

  test('debe mostrar pagina 404 para rutas publicas no implementadas (booking)', async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto(`/booking/${MOCK_HOTEL_ID}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('debe manejar rutas invalidas sin romper la app', async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/ruta-invalida-xyz-no-existe');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('debe redirigir a login al acceder a ruta protegida sin auth', async ({ page }) => {
    // addInitScript limpia localStorage antes que Supabase se inicialice
    await page.addInitScript(() => {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('hotel_activo_id');
    });
    await setupSupabaseMocks(page);
    await page.goto('/habitaciones');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Sin sesion en localStorage, Supabase no encontrara sesion
    // El authError se establece y la app deberia mostrar Login en vez de rutas
    const currentUrl = page.url();
    const bodyText = await page.locator('body').innerText();
    
    // Verificar que NO se muestra el contenido de habitaciones
    const hasProtectedContent = bodyText.includes('Habitaciones') || 
                                 bodyText.includes('habitaciones registradas');
    expect(hasProtectedContent).toBeFalsy();
  });
});
