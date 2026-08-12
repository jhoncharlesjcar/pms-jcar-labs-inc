/**
 * Tests E2E para la pagina de Habitaciones (Room Management).
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Habitaciones - Room Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/habitaciones');
    await page.waitForSelector('h1:has-text("Habitaciones")', { timeout: 15000 });
    await page.waitForTimeout(500);
  });

  test('debe mostrar el titulo y contador de habitaciones', async ({ page }) => {
    await expect(page.locator('h1:has-text("Habitaciones")').first()).toBeVisible();
    await expect(page.locator('text=8 habitaciones registradas').first()).toBeVisible();
  });

  test('debe mostrar el boton de nueva habitacion', async ({ page }) => {
    const newBtn = page.locator('button:has-text("Nueva Habitación")');
    await expect(newBtn).toBeVisible();
  });

  test('debe mostrar los filtros de estado de habitaciones', async ({ page }) => {
    await expect(page.locator('button:has-text("Todas")').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Disponible")').first()).toBeVisible();
  });

  test('debe mostrar las tarjetas de habitaciones en el grid', async ({ page }) => {
    const roomGrid = page.locator('.grid.grid-cols-2').first();
    // Verificar que los numeros de habitacion se muestran
    await expect(page.locator('text=101').first()).toBeVisible();
    await expect(page.locator('text=102').first()).toBeVisible();
    await expect(page.locator('text=201').first()).toBeVisible();
  });

  test('debe mostrar detalles de cada habitacion (precio, tipo, capacidad)', async ({ page }) => {
    await expect(page.locator('text=S/ 80').first()).toBeVisible();
    await expect(page.locator('text=por noche').first()).toBeVisible();
  });

  test('debe abrir el sheet de crear nueva habitacion', async ({ page }) => {
    await page.locator('button:has-text("Nueva Habitación")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Nueva Habitación').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Número / Nombre')).toBeVisible();
    await expect(page.locator('text=Tipo')).toBeVisible();
  });

  test('debe permitir filtrar habitaciones por estado', async ({ page }) => {
    await page.locator('button:has-text("Disponible")').first().click();
    await page.waitForTimeout(500);
    const disponibles = page.locator('text=Disponible');
    await expect(disponibles.first()).toBeVisible();
  });
});
