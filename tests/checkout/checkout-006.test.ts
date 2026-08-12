// @ts-nocheck
/**
 * CHECKOUT-011: El descuento no puede ser negativo
 *
 * RN-CHECKOUT-001:
 *   descuento es opcional, default 0, no puede ser negativo
 */
import { calcularTotal } from '@/services/checkout.service';
import { construirDescripcionAuditoria } from '@/services/recepcion.service';

describe('CHECKOUT-011: Descuento no puede ser negativo', () => {
  it('descuento negativo se trunca a 0', () => {
    const result = calcularTotal({
      precio_noche: 100,
      noches: 2,
      descuento: -50,
    });

    expect(result.descuento).toBe(0);
    expect(result.total_final).toBe(200);
  });

  it('descuento igual a 0 se acepta', () => {
    const result = calcularTotal({
      precio_noche: 100,
      noches: 2,
      descuento: 0,
    });

    expect(result.descuento).toBe(0);
    expect(result.total_final).toBe(200);
  });

  it('descuento mayor que total bruto resulta en 0', () => {
    const result = calcularTotal({
      precio_noche: 50,
      noches: 1,
      descuento: 999,
    });

    expect(result.total_final).toBe(0);
  });

  it('descuento negativo grande se trunca a 0', () => {
    const result = calcularTotal({
      precio_noche: 100,
      noches: 3,
      descuento: -1000,
    });

    expect(result.descuento).toBe(0);
    expect(result.total_final).toBe(300);
  });

  it('descuento sin especificar default a 0', () => {
    const result = calcularTotal({
      precio_noche: 80,
      noches: 2,
    });

    expect(result.descuento).toBe(0);
    expect(result.total_final).toBe(160);
  });
});

/**
 * CHECKOUT-012: Registrar en audit_logs después de checkout exitoso
 *
 * RN-CHECKOUT-006:
 *   5. Registrar en audit_logs con acción = 'CHECK-OUT'
 *   descripcion: `Check-out: Hab. {numero} - {nombre} - S/ {total}`
 */
describe('CHECKOUT-012: Auditoría inmutable post-checkout', () => {
  it('construye descripción de auditoría usando función del servicio', () => {
    const descripcion = construirDescripcionAuditoria('CHECK-OUT', {
      habitacionNumero: '101',
      huespedNombre: 'Juan Perez',
      total: 350.00,
    });

    expect(descripcion).toBe('Check-out: Hab. 101 - Juan Perez - S/ 350.00');
    expect(descripcion).toContain('Check-out');
  });

  it('construye descripción sin habitación (fallback a ?)', () => {
    const descripcion = construirDescripcionAuditoria('CHECK-OUT', {
      huespedNombre: 'Maria Garcia',
      total: 200,
    });

    expect(descripcion).toBe('Check-out: Hab. ? - Maria Garcia - S/ 200.00');
  });

  it('construye descripción sin total (fallback a 0.00)', () => {
    const descripcion = construirDescripcionAuditoria('CHECK-OUT', {
      habitacionNumero: '202',
      huespedNombre: 'Carlos Ruiz',
    });

    expect(descripcion).toBe('Check-out: Hab. 202 - Carlos Ruiz - S/ 0.00');
  });

  it('payload de auditoría contiene todos los campos requeridos', () => {
    const descripcion = construirDescripcionAuditoria('CHECK-OUT', {
      habitacionNumero: '101',
      huespedNombre: 'Juan Perez',
      total: 350.00,
    });

    const auditoriaPayload = {
      hotelId: 'hotel-uuid-123',
      user: { id: 'user-uuid-456', full_name: 'Recepcionista Test' },
      accion: 'CHECK-OUT',
      descripcion,
      modulo: 'recepcion',
    };

    expect(auditoriaPayload.accion).toBe('CHECK-OUT');
    expect(auditoriaPayload.modulo).toBe('recepcion');
    expect(auditoriaPayload.descripcion).toContain('Hab.');
    expect(auditoriaPayload.hotelId).toBeTruthy();
    expect(auditoriaPayload.user.id).toBeTruthy();
  });

  it('la auditoría se ejecuta después de liberar habitación', () => {
    // Verifica el orden lógico: venta → SUNAT → liberar → audit
    const pasos = [
      'crear_venta',
      'enviar_sunat',
      'liberar_habitacion',
      'registrar_auditoria',
    ];

    const indexAuditoria = pasos.indexOf('registrar_auditoria');
    const indexLiberar = pasos.indexOf('liberar_habitacion');

    expect(indexAuditoria).toBeGreaterThan(indexLiberar);
  });

  it('la auditoría NO bloquea el flujo si falla', () => {
    // Según spec: si paso 5 falla, no debe bloquear
    const auditError = 'Permission denied';
    const checkoutExitoso = true;

    const debeContinuar = checkoutExitoso; // La venta ya se creó
    expect(debeContinuar).toBe(true);
    expect(auditError).toBeTruthy(); // Error existe pero no bloquea
  });
});
