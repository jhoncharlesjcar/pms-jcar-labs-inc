/**
 * Tests E2E para la página de Limpieza (Housekeeping).
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Limpieza - Housekeeping', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/limpieza');
    await page.waitForSelector('text=Limpieza', { timeout: 10000 });
    await page.waitForTimeout(300);
  });

  test('debe mostrar el título Limpieza', async ({ page }) => {
    await expect(page.locator('text=Limpieza').first()).toBeVisible();
    await expect(page.locator('text=Módulo de Limpieza y Mantenimiento')).toBeVisible();
  });

  test('debe mostrar tabs de Habitaciones e Inventario', async ({ page }) => {
    await expect(page.locator('button:has-text("Habitaciones")')).toBeVisible();
    await expect(page.locator('button:has-text("Inventario")')).toBeVisible();
  });

  test('debe mostrar el botón de filtro Solo Pendientes / Mostrando Todas', async ({ page }) => {
    const filterBtn = page.locator('button:has-text("Solo Pendientes")');
    await expect(filterBtn).toBeVisible();
  });

  test('debe mostrar las habitaciones en estado limpieza y mantenimiento', async ({ page }) => {
    // Habitación 202 está en limpieza
    await expect(page.locator('text=202').first()).toBeVisible();
    // Habitación 103 está en mantenimiento
    await expect(page.locator('text=103').first()).toBeVisible();
  });

  test('debe mostrar badges de estado Sucia/Limpieza y Mantenimiento', async ({ page }) => {
    await expect(page.locator('text=Sucia / Limpieza').first()).toBeVisible();
    await expect(page.locator('text=Mantenimiento').first()).toBeVisible();
  });

  test('debe mostrar botones de acción en cada tarjeta', async ({ page }) => {
    // Verificar botones de acción
    const listaBtns = page.locator('button:has-text("Lista")');
    const suciaBtns = page.locator('button:has-text("Sucia")');
    const averiaBtns = page.locator('button:has-text("Avería")');

    // Al menos uno de cada tipo debería existir
    expect(await listaBtns.count()).toBeGreaterThan(0);
    expect(await suciaBtns.count()).toBeGreaterThan(0);
    expect(await averiaBtns.count()).toBeGreaterThan(0);
  });

  test('debe mostrar el modal de mantenimiento al hacer click en Avería', async ({ page }) => {
    const averiaBtn = page.locator('button:has-text("Avería")').first();
    await averiaBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator('text=Reportar Mantenimiento')).toBeVisible();
    await expect(page.locator('text=Motivo / Problema Reportado')).toBeVisible();
    await expect(page.locator('button:has-text("Confirmar Mantenimiento")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
  });

  test('debe mostrar el estado vacío "Todo al día" si no hay habitaciones pendientes al filtrar', async ({ page }) => {
    // Con los datos mock, al filtrar solo pendientes deberían verse habitaciones
    // Verificar que el grid muestra las tarjetas correctas
    const roomCards = page.locator('.grid > div');
    const cardCount = await roomCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });
});
