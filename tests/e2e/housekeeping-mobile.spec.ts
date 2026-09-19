import { test, expect } from '@playwright/test'

const TEST_HOTEL_ID = process.env.E2E_TEST_HOTEL_ID || 'test-hotel-id'
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword123'

test.describe.configure({ retries: 2 })

test.describe('Housekeeping Mobile Flow', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true })

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('limpieza: actualizar estado habitación con undo', async ({ page }) => {
    await page.goto('/limpieza')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1:has-text("Limpieza")')).toBeVisible()

    // Find first room card
    const roomCard = page.locator('[data-testid^="room-"]').first()
    await expect(roomCard).toBeVisible()

    // Click to change state
    await roomCard.click()
    
    // Select "Completada" in the drawer
    await page.click('button:has-text("Completada")')
    
    // Verify toast with undo appears
    await expect(page.locator('[role=status]:has-text("Habitación marcada como completada")')).toBeVisible()
    await expect(page.locator('button:has-text("Deshacer")')).toBeVisible()

    // Click undo
    await page.click('button:has-text("Deshacer")')
    
    // Verify state reverted
    await expect(page.locator('text=Estado revertido')).toBeVisible()
  })

  test('limpieza: reportar incidencia con foto', async ({ page }) => {
    await page.goto('/limpieza')
    await page.waitForLoadState('networkidle')

    const roomCard = page.locator('[data-testid^="room-"]').first()
    await roomCard.click()

    // Click "Reportar incidencia"
    await page.click('button:has-text("Reportar incidencia")')
    await expect(page.locator('[role=dialog]:has-text("Nueva Incidencia")')).toBeVisible()

    // Fill incident form
    await page.selectOption('select[name="tipo"]', 'rotura')
    await page.selectOption('select[name="severidad"]', 'media')
    await page.fill('textarea[name="descripcion"]', 'Espejo roto en baño')

    // Take photo (mock - file input)
    const fileInput = page.locator('input[type=file][accept^="image/"]')
    await fileInput.setInputFiles({
      name: 'test.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data')
    })

    await page.click('button:has-text("Enviar")')
    
    await expect(page.locator('text=Incidencia reportada')).toBeVisible({ timeout: 10000 })
  })

  test('limpieza: KPIs visibles en móvil', async ({ page }) => {
    await page.goto('/limpieza')
    await page.waitForLoadState('networkidle')

    // KPI row should be visible and compact
    await expect(page.locator('[data-testid="kpi-pendientes"]')).toBeVisible()
    await expect(page.locator('[data-testid="kpi-en_progreso"]')).toBeVisible()
    await expect(page.locator('[data-testid="kpi-completadas"]')).toBeVisible()
    await expect(page.locator('[data-testid="kpi-score_promedio"]')).toBeVisible()
  })
})