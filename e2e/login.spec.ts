/**
 * Tests E2E para la pagina de Login.
 *
 * IMPORTANTE: Para simular "no autenticado", addInitScript se usa ANTES
 * de que la pagina cargue. page.evaluate() no funciona porque corre en
 * about:blank, no en el origin de la app, y localStorage es origin-specific.
 */
import { test, expect } from '@playwright/test';
import { setupSupabaseMocks } from './fixtures/supabase-mock';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // addInitScript se ejecuta ANTES que cualquier script de la pagina,
    // garantizando que localStorage este limpio cuando Supabase se inicialice.
    await page.addInitScript(() => {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('hotel_activo_id');
    });
    await setupSupabaseMocks(page);
    await page.goto('/');
    // Sin sesion en localStorage, la app muestra Login via authError
    await page.waitForTimeout(3000);
  });

  test('debe mostrar el formulario de login correctamente', async ({ page }) => {
    await expect(page.locator('text=Iniciar Sesión').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#login_email')).toBeVisible();
    await expect(page.locator('#login_password')).toBeVisible();
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Entrar al Sistema');
  });

  test('debe mostrar campos de email y contrasena con placeholders', async ({ page }) => {
    await page.waitForSelector('#login_email', { timeout: 10000 });
    const emailInput = page.locator('#login_email');
    const passwordInput = page.locator('#login_password');

    await expect(emailInput).toHaveAttribute('placeholder', 'ejemplo@hotel.com');
    // El placeholder usa el caracter bullet (U+2022)
    await expect(passwordInput).toHaveAttribute('placeholder', '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
  });

  test('debe tener el boton deshabilitado si los campos estan vacios', async ({ page }) => {
    await page.waitForSelector('#login_email', { timeout: 10000 });
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();

    await page.locator('#login_email').fill('test@test.com');
    await expect(submitBtn).toBeDisabled();

    await page.locator('#login_password').fill('password123');
    await expect(submitBtn).not.toBeDisabled();
  });

  test('debe alternar visibilidad de contrasena', async ({ page }) => {
    await page.waitForSelector('#login_password', { timeout: 10000 });
    const passwordInput = page.locator('#login_password');
    await passwordInput.fill('secreto123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = page.locator('button[type="button"]').first();
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('debe mostrar error con credenciales invalidas', async ({ page }) => {
    // Registrar un handler especifico para POST a /auth/v1/token que devuelva error
    // El handler de setupSupabaseMocks no maneja POST (solo GET), asi que este
    // se registra despues (LIFO) y gana por ser mas especifico.
    await page.route('https://nwprnycqplnmztpjicea.supabase.co/auth/v1/token*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid login credentials',
          }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
      }
    });

    await page.waitForSelector('#login_email', { timeout: 10000 });
    await page.locator('#login_email').fill('test@test.com');
    await page.locator('#login_password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Email o contraseña incorrectos').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe tener enlace de propiedad del hotel', async ({ page }) => {
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Propiedad de Hospedaje').first()).toBeVisible({ timeout: 10000 });
  });

  test('debe cargar correctamente con fondo y animaciones', async ({ page }) => {
    await page.waitForTimeout(1000);
    const loginContainer = page.locator('.min-h-screen');
    await expect(loginContainer).toBeVisible({ timeout: 10000 });
  });
});
