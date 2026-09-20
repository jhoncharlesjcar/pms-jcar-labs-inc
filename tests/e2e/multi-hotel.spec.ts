import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword123'
const TEST_HOTEL_1_ID = process.env.E2E_TEST_HOTEL_ID || 'hotel-1'
const TEST_HOTEL_2_ID = process.env.E2E_TEST_HOTEL_2_ID || 'hotel-2'

test.describe.configure({ retries: 2 })

test.describe('Multi-Hotel: Switch y aislamiento de datos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('switch hotel cambia recepción, habitaciones y ventas', async ({ page }) => {
    // Start with hotel 1
    await page.click('[data-testid="hotel-switcher"]')
    await expect(page.locator('[role=dialog]:has-text("Cambiar Hotel")')).toBeVisible()
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)
    await expect(page.locator(`[data-testid="current-hotel"]:has-text("${TEST_HOTEL_1_ID}")`)).toBeVisible()
    
    // Verify hotel 1 data in recepción
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="hotel-badge"]:has-text("Hotel 1")')).toBeVisible()
    
    const hotel1Rooms = await page.locator('[data-testid^="room-"]').count()
    expect(hotel1Rooms).toBeGreaterThan(0)
    
    // Switch to hotel 2
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_2_ID}"]`)
    await expect(page.locator(`[data-testid="current-hotel"]:has-text("${TEST_HOTEL_2_ID}")`)).toBeVisible()
    
    // Verify hotel 2 data in recepción (different rooms)
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="hotel-badge"]:has-text("Hotel 2")')).toBeVisible()
    
    const hotel2Rooms = await page.locator('[data-testid^="room-"]').count()
    expect(hotel2Rooms).toBeGreaterThan(0)
    
    // Room lists should be different
    const hotel1RoomNumbers = await page.locator('[data-testid^="room-"]').evaluateAll(
      els => els.map(el => el.getAttribute('data-testid'))
    )
    
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    
    const hotel1RoomNumbersAgain = await page.locator('[data-testid^="room-"]').evaluateAll(
      els => els.map(el => el.getAttribute('data-testid'))
    )
    
    expect(hotel1RoomNumbersAgain).not.toEqual(hotel1RoomNumbers)
  })

  test('ventas están aisladas por hotel', async ({ page }) => {
    // Hotel 1 - create venta
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)
    
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    await page.click('button:has-text("Nueva Venta")')
    
    await page.fill('input[name="huesped_nombre"]', 'Venta Hotel 1')
    await page.fill('input[name="huesped_dni"]', '11111111')
    await page.selectOption('select[name="tipo_comprobante"]', '03')
    await page.click('[data-testid="add-servicio"]')
    await page.fill('input[name="servicio_descripcion"]', 'Servicio Hotel 1')
    await page.fill('input[name="servicio_precio"]', '100')
    await page.fill('input[name="servicio_cantidad"]', '1')
    await page.selectOption('select[name="metodo_pago"]', 'efectivo')
    await page.click('button:has-text("Guardar Venta")')
    await expect(page.locator('text=Venta guardada')).toBeVisible()
    
    // Switch to hotel 2
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_2_ID}"]`)
    
    // Verify venta from hotel 1 is NOT visible
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Venta Hotel 1')).not.toBeVisible()
    
    // Create venta in hotel 2
    await page.click('button:has-text("Nueva Venta")')
    await page.fill('input[name="huesped_nombre"]', 'Venta Hotel 2')
    await page.fill('input[name="huesped_dni"]', '22222222')
    await page.selectOption('select[name="tipo_comprobante"]', '03')
    await page.click('[data-testid="add-servicio"]')
    await page.fill('input[name="servicio_descripcion"]', 'Servicio Hotel 2')
    await page.fill('input[name="servicio_precio"]', '200')
    await page.fill('input[name="servicio_cantidad"]', '1')
    await page.selectOption('select[name="metodo_pago"]', 'efectivo')
    await page.click('button:has-text("Guardar Venta")')
    await expect(page.locator('text=Venta guardada')).toBeVisible()
    
    // Switch back to hotel 1 - should see only hotel 1 venta
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Venta Hotel 1')).toBeVisible()
    await expect(page.locator('text=Venta Hotel 2')).not.toBeVisible()
  })

  test('configuración y caja son por hotel', async ({ page }) => {
    // Hotel 1 - open caja
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)
    
    await page.goto('/caja')
    await page.waitForLoadState('networkidle')
    
    // Open caja for hotel 1
    const abrirButton = page.locator('button:has-text("Abrir Caja")')
    if (await abrirButton.isVisible()) {
      await abrirButton.click()
      await page.fill('input[name="saldo_inicial"]', '500')
      await page.click('button:has-text("Abrir")')
      await expect(page.locator('text=Caja abierta')).toBeVisible()
    }
    
    // Switch to hotel 2 - caja should be closed
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_2_ID}"]`)
    await page.goto('/caja')
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator('button:has-text("Abrir Caja")')).toBeVisible()
    
    // Open caja for hotel 2 with different amount
    await page.click('button:has-text("Abrir Caja")')
    await page.fill('input[name="saldo_inicial"]', '1000')
    await page.click('button:has-text("Abrir")')
    await expect(page.locator('text=Caja abierta')).toBeVisible()
    
    // Switch back to hotel 1 - caja should still be open with original amount
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)
    await page.goto('/caja')
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator('text=Caja abierta')).toBeVisible()
    // The saldo should be the hotel 1 amount
    await expect(page.locator('[data-testid="saldo-actual"]:has-text("500")')).toBeVisible()
  })

  test('reportes filtrados por hotel', async ({ page }) => {
    // Hotel 1 reportes
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)
    
    await page.goto('/reportes')
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator('[data-testid="reporte-hotel"]:has-text("Hotel 1")')).toBeVisible()
    const hotel1Occupancy = await page.locator('[data-testid="ocupacion"]').textContent()
    
    // Hotel 2 reportes
    await page.click('[data-testid="hotel-switcher"]')
    await page.click(`[data-testid="hotel-option-${TEST_HOTEL_2_ID}"]`)
    await page.goto('/reportes')
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator('[data-testid="reporte-hotel"]:has-text("Hotel 2")')).toBeVisible()
    const hotel2Occupancy = await page.locator('[data-testid="ocupacion"]').textContent()
    
    // Occupancy should be different
    expect(hotel1Occupancy).not.toEqual(hotel2Occupancy)
  })

  test('usuarios con acceso a múltiples hoteles ven selector', async ({ page }) => {
    // User with multi-hotel access should see switcher
    await expect(page.locator('[data-testid="hotel-switcher"]')).toBeVisible()
    
    // Click shows all assigned hotels
    await page.click('[data-testid="hotel-switcher"]')
    await expect(page.locator('[role=dialog]:has-text("Cambiar Hotel")')).toBeVisible()
    
    await expect(page.locator(`[data-testid="hotel-option-${TEST_HOTEL_1_ID}"]`)).toBeVisible()
    await expect(page.locator(`[data-testid="hotel-option-${TEST_HOTEL_2_ID}"]`)).toBeVisible()
    
    // User with single hotel access should NOT see switcher
    // (would need different test user setup)
  })
})