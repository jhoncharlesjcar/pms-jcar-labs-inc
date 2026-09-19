import { test, expect } from '@playwright/test'

// Test data
const TEST_HOTEL_ID = process.env.E2E_TEST_HOTEL_ID || 'test-hotel-id'
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword123'

test.describe.configure({ retries: 2 })

test.describe('Critical Flow: Login → Recepción → Check-in → POS → Checkout → Cierre Caja', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    
    // Wait for redirect to dashboard
    await page.waitForURL('/', { timeout: 10000 })
    await expect(page.locator('text=Esto es lo que pasa en tu hotel hoy')).toBeVisible()
  })

  test('complete check-in to checkout flow', async ({ page }) => {
    // 1. Navigate to Recepción
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1:has-text("Recepción")')).toBeVisible()

    // 2. Create a new reservation (Nueva Reserva)
    await page.click('button:has-text("Nueva Reserva")')
    await expect(page.locator('[role=dialog]:has-text("Nueva Reserva")')).toBeVisible()

    // Fill reservation form
    await page.fill('input[name="huesped_nombre"]', 'Test Guest E2E')
    await page.fill('input[name="huesped_dni"]', '99999999')
    
    // Select dates (tomorrow + 2 days)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfterTomorrow = new Date()
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 3)
    
    await page.fill('input[name="fecha_entrada"]', tomorrow.toISOString().split('T')[0])
    await page.fill('input[name="fecha_salida"]', dayAfterTomorrow.toISOString().split('T')[0])
    
    // Select room (first available)
    await page.click('[data-testid^="room-"]:first-child')
    await page.click('button:has-text("Guardar")')
    
    // Wait for reservation to appear
    await expect(page.locator('text=Test Guest E2E')).toBeVisible({ timeout: 5000 })

    // 3. Check-in (change status to activa)
    await page.click('[data-testid="reserva-Test Guest E2E"] button:has-text("Check-in")')
    await expect(page.locator('text=Check-in exitoso')).toBeVisible()

    // 4. Navigate to POS and make a sale
    await page.goto('/pos')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1:has-text("Punto de Venta")')).toBeVisible()

    // Add product to cart (first product)
    await page.click('[data-testid^="pos-producto-"]:first-child')
    await expect(page.locator('[data-testid="carrito"]')).toContainText('1')

    // Pay with cash
    await page.click('button:has-text("Pagar")')
    await page.click('button:has-text("Efectivo")')
    await page.click('button:has-text("Confirmar Pago")')
    
    await expect(page.locator('text=Venta registrada')).toBeVisible()

    // 5. Checkout from Recepción
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    
    // Find the reservation and click checkout
    await page.click('[data-testid="reserva-Test Guest E2E"] button:has-text("Checkout")')
    await expect(page.locator('[role=dialog]:has-text("Checkout")')).toBeVisible()
    
    // Confirm checkout
    await page.click('button:has-text("Confirmar Checkout")')
    await expect(page.locator('text=Checkout completado')).toBeVisible()

    // 6. Cierre de Caja
    await page.goto('/caja')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1:has-text("Caja")')).toBeVisible()

    // Open caja if not open
    const abrirButton = page.locator('button:has-text("Abrir Caja")')
    if (await abrirButton.isVisible()) {
      await abrirButton.click()
      await page.fill('input[name="saldo_inicial"]', '100')
      await page.click('button:has-text("Abrir")')
      await expect(page.locator('text=Caja abierta')).toBeVisible()
    }

    // Close caja
    await page.click('button:has-text("Cerrar Caja")')
    await expect(page.locator('[role=dialog]:has-text("Cierre de Caja")')).toBeVisible()
    
    // Fill arqueo (use expected amounts)
    await page.fill('input[name="efectivo_contado"]', '600') // 100 inicial + 500 venta
    await page.click('button:has-text("Cerrar Turno")')
    
    await expect(page.locator('text=Caja cerrada correctamente')).toBeVisible()
  })
})

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

    // Find first room with estado "limpieza" or "pendiente"
    const roomCard = page.locator('[data-testid^="room-"]').first()
    await expect(roomCard).toBeVisible()

    // Click to change state
    await roomCard.click()
    
    // Select "Completada" in the drawer
    await page.click('button:has-text("Completada")')
    
    // Verify toast with undo appears
    await expect(page.locator('[role=status]:has-text("Habitación marcada como completada")')).toBeVisible()
    await expect(page.locator('button:has-text("Deshacer")')).toBeVisible()

    // Wait for toast to auto-dismiss (4s) or click undo
    // For test speed, click undo
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
})