/**
 * Tests E2E para la página de Punto de Venta (POS / Minimarket).
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Punto de Venta - POS / Minimarket', () => {
  test.beforeEach(async ({ page }) => {
    await setupSupabaseMocks(page);
    await page.goto('/pos');
    await page.waitForSelector('text=Minimarket', { timeout: 10000 });
    await page.waitForTimeout(300);
  });

  test('debe mostrar el título Minimarket', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Minimarket').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Toca un producto para agregar').first()).toBeVisible();
  });

  test('debe mostrar los productos del catálogo', async ({ page }) => {
    // Verificar categorías
    await expect(page.locator('text=Bebidas').first()).toBeVisible();
    await expect(page.locator('text=Snacks').first()).toBeVisible();

    // Verificar productos del mock
    await expect(page.locator('text=Agua Mineral 500ml').first()).toBeVisible();
    await expect(page.locator('text=Gaseosa Personal').first()).toBeVisible();
    await expect(page.locator('text=Papas Lays').first()).toBeVisible();
  });

  test('debe mostrar el carrito vacío con el botón deshabilitado', async ({ page }) => {
    const carritoPanel = page.locator('text=Carrito').first();
    await expect(carritoPanel).toBeVisible();

    // Botón de cobrar debería estar deshabilitado
    const cobrarBtn = page.locator('button:has-text("Carrito vacío")');
    await expect(cobrarBtn).toBeVisible();
    await expect(cobrarBtn).toBeDisabled();
  });

  test('debe mostrar precios de productos', async ({ page }) => {
    await expect(page.locator('text=S/ 3.50').first()).toBeVisible();
    await expect(page.locator('text=S/ 5.00').first()).toBeVisible();
    await expect(page.locator('text=S/ 8.00').first()).toBeVisible();
  });

  test('debe mostrar badge de stock agotado en productos sin stock', async ({ page }) => {
    // Shampoo tiene stock 0
    await expect(page.locator('text=Shampoo').first()).toBeVisible();
    // Esperar a que el badge aparezca
    const agotadoBadge = page.locator('text=Agotado');
    await expect(agotadoBadge.first()).toBeVisible({ timeout: 5000 });
  });

  test('debe ocultar el botón de limpiar carrito cuando está vacío', async ({ page }) => {
    // Esperar que la página termine de cargar completamente
    await page.waitForTimeout(1000);
    // El botón Limpiar solo aparece cuando hay items en el carrito
    const limpiarBtn = page.locator('button:has-text("Limpiar")');
    await expect(limpiarBtn).toHaveCount(0);
  });

  test('debe mostrar el panel de productos y carrito en desktop', async ({ page }) => {
    await page.waitForTimeout(1000);
    // En desktop (>=1024px), el layout muestra ambos paneles
    // Verificar que el carrito (panel derecho) esta visible
    await expect(page.locator('text=Carrito').first()).toBeVisible({ timeout: 10000 });
  });
});
