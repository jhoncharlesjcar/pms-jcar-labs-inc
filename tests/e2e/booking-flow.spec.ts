import { expect, test } from '@playwright/test';

test.describe('Flujo autenticado y módulos principales', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'E2E_USER_EMAIL y E2E_USER_PASSWORD requeridos para flujo autenticado');

  test('login → dashboard → navegación a módulos operativos', async ({ page }) => {
    const unexpectedErrors: string[] = [];
    page.on('pageerror', (error) => unexpectedErrors.push(error.message));

    // 1. Iniciar sesión
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.fill('#login_email', process.env.E2E_USER_EMAIL!);
    await page.fill('#login_password', process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: /ingresar/i }).click();

    // 2. Esperar navegación fuera de login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    // 3. Verificar navegación a recepción
    await page.goto('/recepcion', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await expect(page).toHaveTitle(/PMS JCAR LABS/);

    // 4. Verificar navegación a caja
    await page.goto('/caja', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await expect(page).toHaveTitle(/PMS JCAR LABS/);

    expect(unexpectedErrors).toEqual([]);
  });
});
