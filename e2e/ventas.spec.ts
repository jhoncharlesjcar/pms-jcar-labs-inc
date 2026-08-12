/**
 * Tests E2E para la pagina de Ventas y Tickets.
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Ventas - Sales History', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/ventas');
    await page.waitForSelector('h1:has-text("Ventas y Tickets")', { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  test('debe mostrar el titulo Ventas y Tickets', async ({ page }) => {
    await expect(page.locator('h1:has-text("Ventas y Tickets")').first()).toBeVisible();
  });

  test('debe mostrar las cards de resumen', async ({ page }) => {
    // Scope al resumen de cards
    const resumenCards = page.locator('.grid.grid-cols-2').first();
    await expect(resumenCards.locator('text=Minimarket').first()).toBeVisible();
    await expect(resumenCards.locator('text=Hotel Hoy').first()).toBeVisible();
    await expect(resumenCards.locator('text=Histórico').first()).toBeVisible();
  });

  test('debe mostrar la tabla de ventas con columnas correctas', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table.locator('th:has-text("Origen")').first()).toBeVisible();
    await expect(table.locator('th:has-text("Ticket")').first()).toBeVisible();
    await expect(table.locator('th:has-text("Cliente")').first()).toBeVisible();
    await expect(table.locator('th:has-text("Total")').first()).toBeVisible();
    await expect(table.locator('th:has-text("Pago")').first()).toBeVisible();
  });

  test('debe mostrar los filtros de busqueda y metodo de pago', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Ticket"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar datos de ventas en la tabla', async ({ page }) => {
    // Verificar tickets en la tabla
    await expect(page.locator('text=TH-0001').first()).toBeVisible();
    await expect(page.locator('text=TH-0002').first()).toBeVisible();
    await expect(page.locator('text=POS-0001').first()).toBeVisible();
    await expect(page.locator('text=POS-0002').first()).toBeVisible();
  });

  test('debe mostrar nombres de clientes en las ventas', async ({ page }) => {
    await expect(page.locator('text=Juan Pérez').first()).toBeVisible();
    // Usar un selector mas especifico para evitar strict mode
    await expect(page.locator('td:has-text("Cliente mostrador")').first()).toBeVisible();
  });

  test('debe mostrar badges de tipo Hotel o POS en cada fila', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table.locator('text=Hotel').first()).toBeVisible();
    await expect(table.locator('text=POS').first()).toBeVisible();
  });
});
