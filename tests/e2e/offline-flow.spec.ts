import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword123'

test.describe.configure({ retries: 2 })

test.describe('Offline Queue: Reconciliación al volver online', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('crear reserva offline se sincroniza al volver online', async ({ page, context }) => {
    // Go to recepcion
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    
    // Go offline
    await context.setOffline(true)
    
    // Create reservation while offline
    await page.click('button:has-text("Nueva Reserva")')
    await expect(page.locator('[role=dialog]:has-text("Nueva Reserva")')).toBeVisible()
    
    await page.fill('input[name="huesped_nombre"]', 'Offline Guest')
    await page.fill('input[name="huesped_dni"]', '88888888')
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 3)
    
    await page.fill('input[name="fecha_entrada"]', tomorrow.toISOString().split('T')[0])
    await page.fill('input[name="fecha_salida"]', dayAfter.toISOString().split('T')[0])
    
    await page.click('[data-testid^="room-"]:first-child')
    await page.click('button:has-text("Guardar")')
    
    // Should show offline indicator
    await expect(page.locator('text=Modo offline')).toBeVisible()
    await expect(page.locator('text=Offline Guest')).toBeVisible()
    
    // Go back online
    await context.setOffline(false)
    
    // Wait for sync
    await page.waitForSelector('text=Sincronizando...', { state: 'hidden', timeout: 10000 })
    await expect(page.locator('text=Sincronización completada')).toBeVisible({ timeout: 15000 })
    
    // Verify reservation is now on server
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Offline Guest')).toBeVisible()
  })

  test('checkout offline se sincroniza al volver online', async ({ page, context }) => {
    // Create a reservation first (online)
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("Nueva Reserva")')
    await page.fill('input[name="huesped_nombre"]', 'Checkout Offline')
    await page.fill('input[name="huesped_dni"]', '77777777')
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)
    
    await page.fill('input[name="fecha_entrada"]', tomorrow.toISOString().split('T')[0])
    await page.fill('input[name="fecha_salida"]', dayAfter.toISOString().split('T')[0])
    await page.click('[data-testid^="room-"]:first-child')
    await page.click('button:has-text("Guardar")')
    await expect(page.locator('text=Checkout Offline')).toBeVisible()
    
    // Check-in
    await page.click('[data-testid="reserva-Checkout Offline"] button:has-text("Check-in")')
    await expect(page.locator('text=Check-in exitoso')).toBeVisible()
    
    // Go offline
    await context.setOffline(true)
    
    // Do checkout while offline
    await page.click('[data-testid="reserva-Checkout Offline"] button:has-text("Checkout")')
    await expect(page.locator('[role=dialog]:has-text("Checkout")')).toBeVisible()
    await page.selectOption('select[name="metodo_pago"]', 'efectivo')
    await page.click('button:has-text("Confirmar Checkout")')
    
    // Should show offline indicator
    await expect(page.locator('text=Modo offline')).toBeVisible()
    
    // Go back online
    await context.setOffline(false)
    
    // Wait for sync
    await page.waitForSelector('text=Sincronizando...', { state: 'hidden', timeout: 10000 })
    await expect(page.locator('text=Sincronización completada')).toBeVisible({ timeout: 15000 })
    
    // Verify checkout completed on server
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="reserva-Checkout Offline"]:has-text("finalizada")')).toBeVisible()
  })

  test('conflicto de sincronización muestra diálogo de resolución', async ({ page, context }) => {
    // This test simulates a conflict where the same record was modified
    // on server and locally while offline
    await page.goto('/recepcion')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("Nueva Reserva")')
    await page.fill('input[name="huesped_nombre"]', 'Conflict Test')
    await page.fill('input[name="huesped_dni"]', '66666666')
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date()
    dayAfter.setDate(dayAfter.getDate() + 2)
    
    await page.fill('input[name="fecha_entrada"]', tomorrow.toISOString().split('T')[0])
    await page.fill('input[name="fecha_salida"]', dayAfter.toISOString().split('T')[0])
    await page.click('[data-testid^="room-"]:first-child')
    await page.click('button:has-text("Guardar")')
    
    await expect(page.locator('text=Conflict Test')).toBeVisible()
    
    // Go offline
    await context.setOffline(true)
    
    // Modify locally
    await page.click('[data-testid="reserva-Conflict Test"] button:has-text("Editar")')
    await page.fill('input[name="huesped_nombre"]', 'Conflict Test LOCAL')
    await page.click('button:has-text("Guardar")')
    
    await expect(page.locator('text=Conflict Test LOCAL')).toBeVisible()
    
    // Simulate server change (would need backend setup, skip for now)
    // Go back online
    await context.setOffline(false)
    
    // Should detect conflict and show resolution dialog
    await expect(page.locator('[role=dialog]:has-text("Conflicto de sincronización")')).toBeVisible({ timeout: 10000 })
    
    // User chooses local version
    await page.click('button:has-text("Usar versión local")')
    await expect(page.locator('text=Sincronización completada')).toBeVisible()
  })
})