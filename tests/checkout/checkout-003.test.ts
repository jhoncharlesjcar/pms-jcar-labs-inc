// @ts-nocheck
/**
 * CHECKOUT-003: Liberar habitacion solo si pago exitoso
 *
 * RN-CHECKOUT-003:
 *   SI pago exitoso -> reserva.estado = 'finalizada', habitacion.estado = 'disponible'
 *   SI pago falla   -> reserva y habitacion NO cambian de estado
 *
 * CHECKOUT-013 (pre-check):
 *   Verificar que no exista un pago previo antes de procesar checkout
 */
import { procesarCheckout, validarPagoDuplicado } from '@/services/checkout.service';

describe('CHECKOUT-003: Liberacion de Habitacion', () => {
  const reservaActiva = {
    id: 'r1',
    huesped_nombre: 'Juan Perez',
    habitacion_id: 'h1',
    estado: 'activa',
  };

  const habitacionOcupada = {
    id: 'h1',
    numero: '101',
    estado: 'ocupada',
  };

  it('libera habitacion cuando el pago es exitoso', () => {
    const result = procesarCheckout({
      reserva: reservaActiva,
      habitacion: habitacionOcupada,
      pagoExitoso: true,
    });

    expect(result.success).toBe(true);
    expect(result.reserva.estado).toBe('finalizada');
    expect(result.habitacion.estado).toBe('disponible');
  });

  it('NO cambia estados si el pago falla', () => {
    const result = procesarCheckout({
      reserva: reservaActiva,
      habitacion: habitacionOcupada,
      pagoExitoso: false,
    });

    expect(result.success).toBe(false);
    expect(result.reserva.estado).toBe('activa');
    expect(result.habitacion.estado).toBe('ocupada');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('retorna error cuando no hay pago', () => {
    const result = procesarCheckout({
      reserva: reservaActiva,
      habitacion: habitacionOcupada,
      pagoExitoso: false,
    });

    expect(result.errors).toContain('El pago no fue procesado correctamente');
  });

  describe('CHECKOUT-013: Prevencion de pago duplicado', () => {
    it('rechaza checkout si ya existe un pago registrado para la reserva', () => {
      const pagosPrevios = [{ reserva_id: 'r1', total: 300 }];
      const result = validarPagoDuplicado('r1', pagosPrevios);
      expect(result.valido).toBe(false);
      expect(result.error).toContain('Ya existe un pago');
    });

    it('permite checkout si no hay pagos previos', () => {
      const result = validarPagoDuplicado('r1', []);
      expect(result.valido).toBe(true);
    });
  });
});
