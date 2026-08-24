import { expect, test } from '@playwright/test';

test('login shell is usable without an authenticated session', async ({ page }) => {
  const unexpectedErrors: string[] = [];
  page.on('pageerror', (error) => unexpectedErrors.push(error.message));

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });

  await expect(page).toHaveTitle(/PMS JCAR LABS/);
  await expect(page.getByRole('heading', { name: /PMS JCAR LABS/i })).toBeVisible();
  await expect(page.locator('#login_email')).toBeVisible();
  await expect(page.locator('#login_password')).toBeVisible();
  await expect(page.getByRole('button', { name: /ingresar/i })).toBeVisible();
  expect(unexpectedErrors).toEqual([]);
});

test('unknown routes fail safely', async ({ page }) => {
  await page.goto('/ruta-que-no-existe', { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /página no encontrada/i })).toBeVisible();
});
