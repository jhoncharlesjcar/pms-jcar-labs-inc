import { test, expect } from '@playwright/test'

// Test data
const TEST_HOTEL_ID = process.env.E2E_TEST_HOTEL_ID || 'test-hotel-id'
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword123'
const TEST_HOTEL_2_ID = process.env.E2E_TEST_HOTEL_2_ID || 'test-hotel-2-id'

test.describe.configure({ retries: 2 })

test.describe('Auth Flow: Login → Logout → Switch Hotel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
  })

  test('login exitoso con credenciales válidas', async ({ page }) => {
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 10000 })
    await expect(page.locator('text=Esto es lo que pasa en tu hotel hoy')).toBeVisible()
    
    // Verify user menu visible
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
  })

  test('login fallido con credenciales inválidas', async ({ page }) => {
    await page.fill('[name=email]', 'invalid@example.com')
    await page.fill('[name=password]', 'wrongpassword')
    await page.click('button[type=submit]')
    
    // Should show error message
    await expect(page.locator('text=Credenciales inválidas')).toBeVisible({ timeout: 5000 })
    
    // Should stay on login page
    await expect(page).toHaveURL(/.*login/)
  })

  test('logout limpia estado y redirige a login', async ({ page }) => {
    // First login
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('/', { timeout: 10000 })
    
    // Click user menu and logout
    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')
    
    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 })
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible()
    
    // Verify cannot access protected route
    await page.goto('/recepcion')
    await page.waitForURL('/login', { timeout: 5000 })
  })

  test('switch hotel cambia contexto correctamente', async ({ page }) => {
    // Login first
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('/', { timeout: 10000 })
    
    // Open hotel switcher
    await page.click('[data-testid="hotel-switcher"]')
    await expect(page.locator('[role=dialog]:has-text("Cambiar Hotel")')).toBeVisible()
    
    // Select second hotel
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_2_ID}"]`)
    
    // Verify context changed
    await expect(page.locator(`[data-testid="current-hotel"]:has-text("${TEST_HOTEL_2_ID}")`)).toBeVisible({ timeout: 5000 })
    
    // Verify data is scoped to new hotel
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`[data-testid="hotel-badge"]:has-text("${TEST_HOTEL_2_ID}")`)).toBeVisible()
  })

  test('persistencia de hotel seleccionado tras recarga', async ({ page }) => {
    // Login and switch hotel
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('/', { timeout: 10000 })
    
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_2_ID}"]`)
    await expect(page.locator(`[data-testid="current-hotel"]:has-text("${TEST_HOTEL_2_ID}")`)).toBeVisible()
    
    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Should maintain hotel selection
    await expect(page.locator(`[data-testid="current-hotel"]:has-text("${TEST_HOTEL_2_ID}")`)).toBeVisible()
  })
})