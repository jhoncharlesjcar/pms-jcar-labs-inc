/**
 * Tests E2E para el Dashboard.
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/');
    await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  test('debe mostrar el titulo Dashboard', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")').first()).toBeVisible();
  });

  test('debe mostrar los KPIs principales', async ({ page }) => {
    // Scope al grid de KPIs
    const grid = page.locator('.grid').first();
    await expect(grid.locator('text=Ocupación').first()).toBeVisible({ timeout: 5000 });
    await expect(grid.locator('text=Libres').first()).toBeVisible();
    await expect(grid.locator('text=Reservas').first()).toBeVisible();
  });

  test('debe mostrar el chart de evolucion de ingresos', async ({ page }) => {
    await expect(page.locator('text=Evolución de Ingresos').first()).toBeVisible();
    await expect(page.locator('text=Análisis Semanal').first()).toBeVisible();
  });

  test('debe mostrar la seccion de ingresos del dia', async ({ page }) => {
    // Scope a la card de ingresos diarios - esperar que aparezca despues de animaciones
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Ingresos Hoy').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar el estado del inventario de habitaciones', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Estado del Inventario').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ocupadas').first()).toBeVisible();
  });

  test('debe mostrar la actividad reciente', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Actividad Reciente').first()).toBeVisible({ timeout: 10000 });
    const historialLink = page.locator('a[href="/ventas"]');
    await expect(historialLink.first()).toBeVisible();
  });

  test('debe mostrar el indicador de sistema operativo', async ({ page }) => {
    await expect(page.locator('text=Sistema Operativo').first()).toBeVisible();
  });
});
