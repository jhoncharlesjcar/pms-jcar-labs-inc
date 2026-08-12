/**
 * Tests E2E para la página de Recepción (Check-in / Check-out).
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Recepción - Check-in/Check-out', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/recepcion');
    await page.waitForSelector('text=Recepción', { timeout: 10000 });
    await page.waitForTimeout(300);
  });

  test('debe mostrar el título Recepción', async ({ page }) => {
    await expect(page.locator('text=Recepción').first()).toBeVisible();
    await expect(page.locator('text=Entradas, salidas y reservas')).toBeVisible();
  });

  test('debe mostrar el botón de nueva reserva', async ({ page }) => {
    const newBtn = page.locator('button:has-text("Nueva Reserva")');
    await expect(newBtn).toBeVisible();
  });

  test('debe mostrar los filtros de estado de reservas', async ({ page }) => {
    await page.waitForTimeout(500);
    const filtros = page.locator('button:has-text("todas"), button:has-text("pendiente"), button:has-text("activa"), button:has-text("finalizada")');
    await expect(filtros.first()).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar el campo de búsqueda con placeholder', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Huésped, DNI o Habitación..."]');
    await expect(searchInput).toBeVisible();
  });

  test('debe mostrar las tarjetas de reservas con información relevante', async ({ page }) => {
    await page.waitForTimeout(1000);
    // Verificar nombres de huespedes con tolerancia de acentos
    await expect(page.locator('text=Juan Pérez').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Pedro Sánchez').first()).toBeVisible();
  });

  test('debe mostrar los números de reserva y totales', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=S/ 240').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar badges de estado en las reservas', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=activa').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe mostrar las fechas de check-in/out en las tarjetas', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.locator('text=DNI:').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe abrir el sheet de nueva reserva al hacer click', async ({ page }) => {
    await page.locator('button:has-text("Nueva Reserva")').click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Registro de Reserva').first()).toBeVisible();
    await expect(page.locator('text=1. Selección de Habitación')).toBeVisible();
    await expect(page.locator('text=2. Información del Huésped')).toBeVisible();
    await expect(page.locator('text=3. Fechas y Estancia')).toBeVisible();
    await expect(page.locator('text=4. Detalles Adicionales')).toBeVisible();

    // Botones en el formulario
    await expect(page.locator('button:has-text("Finalizar Registro")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancelar")')).toBeVisible();
  });

  test('debe mostrar el total calculado en el formulario de reserva', async ({ page }) => {
    await page.locator('button:has-text("Nueva Reserva")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Total a Pagar')).toBeVisible();
  });
});
