import { test, expect } from '@playwright/test'

// Test data
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'testpassword123'

test.describe.configure({ retries: 2 })

test.describe('Facturación SUNAT: Flujo completo Factura/Boleta/NC/ND', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.fill('[name=email]', TEST_EMAIL)
    await page.fill('[name=password]', TEST_PASSWORD)
    await page.click('button[type=submit]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('emitir Factura (01) con RUC y razón social', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    
    // Click nueva venta
    await page.click('button:has-text("Nueva Venta")')
    await expect(page.locator('[role=dialog]:has-text("Nueva Venta")')).toBeVisible()
    
    // Fill venta form
    await page.fill('input[name="huesped_nombre"]', 'Empresa Test SAC')
    await page.fill('input[name="huesped_dni"]', '20123456789') // RUC
    await page.selectOption('select[name="tipo_comprobante"]', '01') // Factura
    await page.fill('input[name="razon_social"]', 'EMPRESA TEST SAC')
    await page.fill('input[name="ruc_cliente"]', '20123456789')
    
    // Add room/service
    await page.click('[data-testid="add-servicio"]')
    await page.fill('input[name="servicio_descripcion"]', 'Hospedaje Suite')
    await page.fill('input[name="servicio_precio"]', '500.00')
    await page.fill('input[name="servicio_cantidad"]', '1')
    
    // Set payment method
    await page.selectOption('select[name="metodo_pago"]', 'efectivo')
    
    // Save venta
    await page.click('button:has-text("Guardar Venta")')
    await expect(page.locator('text=Venta guardada')).toBeVisible({ timeout: 10000 })
    
    // Now emitir comprobante
    await page.click('button:has-text("Emitir Comprobante")')
    await expect(page.locator('[role=dialog]:has-text("Emitir Comprobante")')).toBeVisible()
    
    // Confirm emission
    await page.click('button:has-text("Confirmar Emisión")')
    
    // Wait for SUNAT response
    await expect(page.locator('text=Comprobante aceptado por SUNAT')).toBeVisible({ timeout: 30000 })
    
    // Verify CDR data displayed
    await expect(page.locator('text=CDR:')).toBeVisible()
    await expect(page.locator('text=20123456789-01')).toBeVisible() // RUC-TIPO
  })

  test('emitir Boleta (03) con DNI', async ({ page }) => {
    await page.goto('/ventas')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("Nueva Venta")')
    await expect(page.locator('[role=dialog]:has-text("Nueva Venta")')).toBeVisible()
    
    await page.fill('input[name="huesped_nombre"]', 'Juan Pérez')
    await page.fill('input[name="huesped_dni"]', '12345678')
    await page.selectOption('select[name="tipo_comprobante"]', '03') // Boleta
    await page.fill('input[name="tipo_comprobante"]', '03')
    
    await page.click('[data-testid="add-servicio"]')
    await page.fill('input[name="servicio_descripcion"]', 'Consumo Minibar')
    await page.fill('input[name="servicio_precio"]', '50.00')
    await page.fill('input[name="servicio_cantidad"]', '2')
    
    await page.selectOption('select[name="metodo_pago"]', 'yape')
    await page.fill('input[name="codigo_referencia"]', 'YAPE123456789')
    
    await page.click('button:has-text("Guardar Venta")')
    await expect(page.locator('text=Venta guardada')).toBeVisible({ timeout: 10000 })
    
    await page.click('button:has-text("Emitir Comprobante")')
    await page.click('button:has-text("Confirmar Emisión")')
    
    await expect(page.locator('text=Comprobante aceptado por SUNAT')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('text=RUC-TIPO-SERIE')).toBeVisible()
  })

  test('emitir Nota de Crédito (07) referenciando Factura', async ({ page }) => {
    // First create a factura to reference
    await page.goto('/ventas')
    await page.click('button:has-text("Nueva Venta")')
    await page.fill('input[name="huesped_nombre"]', 'Empresa Para NC')
    await page.fill('input[name="huesped_dni"]', '20987654321')
    await page.selectOption('select[name="tipo_comprobante"]', '01')
    await page.fill('input[name="razon_social"]', 'EMPRESA PARA NC SAC')
    await page.fill('input[name="ruc_cliente"]', '20987654321')
    await page.click('[data-testid="add-servicio"]')
    await page.fill('input[name="servicio_descripcion"]', 'Servicio Original')
    await page.fill('input[name="servicio_precio"]', '1000.00')
    await page.fill('input[name="servicio_cantidad"]', '1')
    await page.selectOption('select[name="metodo_pago"]', 'efectivo')
    await page.click('button:has-text("Guardar Venta")')
    await expect(page.locator('text=Venta guardada')).toBeVisible()
    
    await page.click('button:has-text("Emitir Comprobante")')
    await page.click('button:has-text("Confirmar Emisión")')
    await expect(page.locator('text=Comprobante aceptado por SUNAT')).toBeVisible({ timeout: 30000 })
    
    // Get the comprobante number for reference
    const comprobanteRef = await page.locator('[data-testid="comprobante-ref"]').textContent()
    
    // Now create Nota de Crédito
    await page.goto('/facturacion')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("Nota de Crédito")')
    await expect(page.locator('[role=dialog]:has-text("Nota de Crédito")')).toBeVisible()
    
    // Reference the original comprobante
    await page.fill('input[name="comprobante_ref"]', comprobanteRef || '')
    await page.selectOption('select[name="tipo_nota"]', '01') // Anulación
    await page.fill('textarea[name="motivo"]', 'Anulación por error en datos')
    await page.fill('input[name="subtotal"]', '847.46')
    await page.fill('input[name="igv"]', '152.54')
    await page.fill('input[name="total"]', '1000.00')
    
    await page.click('button:has-text("Emitir Nota de Crédito")')
    await expect(page.locator('text=Nota de Crédito aceptada por SUNAT')).toBeVisible({ timeout: 30000 })
  })

  test('emitir Nota de Débito (08) por aumento de valor', async ({ page }) => {
    await page.goto('/facturacion')
    await page.waitForLoadState('networkidle')
    
    await page.click('button:has-text("Nota de Débito")')
    await expect(page.locator('[role=dialog]:has-text("Nota de Débito")')).toBeVisible()
    
    // Reference existing factura
    await page.fill('input[name="comprobante_ref"]', '20123456789-01-F001-00000001')
    await page.selectOption('select[name="tipo_nota"]', '12') // Aumento en el valor
    await page.fill('textarea[name="motivo"]', 'Ajuste por tipo de cambio')
    await page.fill('input[name="subtotal"]', '84.75')
    await page.fill('input[name="igv"]', '15.25')
    await page.fill('input[name="total"]', '100.00')
    
    await page.click('button:has-text("Emitir Nota de Débito")')
    await expect(page.locator('text=Nota de Débito aceptada por SUNAT')).toBeVisible({ timeout: 30000 })
  })

  test('consultar CDR directo por RUC/serie/correlativo', async ({ page }) => {
    await page.goto('/facturacion/consultar-cdr')
    await page.waitForLoadState('networkidle')
    
    await page.fill('input[name="ruc"]', '20123456789')
    await page.selectOption('select[name="tipo"]', '01')
    await page.fill('input[name="serie"]', 'F001')
    await page.fill('input[name="correlativo"]', '1')
    
    await page.click('button:has-text("Consultar CDR")')
    
    await expect(page.locator('[data-testid="cdr-response"]')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=ResponseCode: 0')).toBeVisible() // 0 = aceptado
  })
})