/**
 * Tests E2E para la pagina de Caja (Cash Register).
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Caja - Cash Register', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/caja');
    await page.waitForSelector('h1:has-text("Caja")', { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  test('debe mostrar el titulo Caja', async ({ page }) => {
    await expect(page.locator('h1:has-text("Caja")').first()).toBeVisible();
  });

  test('debe mostrar los botones de Cierre y Egreso', async ({ page }) => {
    await expect(page.locator('button:has-text("Cierre")')).toBeVisible();
    await expect(page.locator('button:has-text("Egreso")')).toBeVisible();
  });
});
