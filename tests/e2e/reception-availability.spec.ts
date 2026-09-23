import { expect, test } from '@playwright/test';

test.describe('Recepción: disponibilidad', () => {
  test.skip(!process.env.E2E_USER_EMAIL, 'E2E_USER_EMAIL y E2E_USER_PASSWORD requeridos');

  test('un 403 de disponibilidad no se presenta como falta de cupo', async ({ page }) => {
    const rpcStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('staff_search_availability')) rpcStatuses.push(response.status());
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('#login_email', process.env.E2E_USER_EMAIL!);
    await page.fill('#login_password', process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: /ingresar/i }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    await page.goto('/recepcion', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /nueva reserva|registrar/i }).click();

    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/permission denied for function/i);
    if (rpcStatuses.includes(403)) {
      await expect(page.getByRole('alert')).toContainText('No se pudo consultar disponibilidad');
      await expect(page.getByText('No hay habitaciones libres para esas fechas')).toHaveCount(0);
    }
  });
});
