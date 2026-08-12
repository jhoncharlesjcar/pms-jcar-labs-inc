// @ts-nocheck
/**
 * Tests de validación para los schemas Zod del dominio Recepción.
 *
 * @see src/schemas/recepcion.schema.js
 * @see specs/domain-recepcion.md
 */
import { recepcionSchema } from '@/schemas/recepcion.schema';

/**
 * Datos base mínimos para una reserva válida.
 * Se extiende/modifica en cada test según lo que se quiera probar.
 */
const baseReserva = {
  habitacion_id: 'hab-001',
  huesped_nombre: 'Juan Perez',
  tipo_documento: 'DNI',
  huesped_dni: '12345678',
  fecha_entrada: '2026-07-15',
  fecha_salida: '2026-07-17',
  noches: 2,
  precio_noche: 100,
  total: 200,
  num_adultos: 1,
};

describe('recepcion.schema — recepcionSchema', () => {
  it('acepta reserva válida con todos los campos obligatorios', () => {
    const result = recepcionSchema.safeParse(baseReserva);
    expect(result.success).toBe(true);
  });

  it('asigna valores por defecto para campos opcionales', () => {
    const result = recepcionSchema.safeParse(baseReserva);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tipo_documento).toBe('DNI');
      expect(result.data.huesped_sexo).toBe('no_especificado');
      expect(result.data.nacionalidad).toBe('Peruana');
      expect(result.data.motivo_viaje).toBe('turismo');
      expect(result.data.incluye_igv).toBe(true);
      expect(result.data.moneda_pago).toBe('PEN');
      expect(result.data.tipo_cambio_dia).toBe(0);
      expect(result.data.num_ninos).toBe(0);
      expect(result.data.tiene_menores).toBe(false);
      expect(result.data.estado).toBe('activa');
    }
  });

  describe('habitación', () => {
    it('rechaza sin habitación seleccionada', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        habitacion_id: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('nombre del huésped', () => {
    it('rechaza nombre vacío', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        huesped_nombre: '',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza nombre con menos de 3 caracteres', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        huesped_nombre: 'AB',
      });
      expect(result.success).toBe(false);
    });

    it('limpia espacios del nombre', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        huesped_nombre: '  Juan Perez  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.huesped_nombre).toBe('Juan Perez');
      }
    });
  });

  describe('documento del huésped', () => {
    it('rechaza DNI vacío', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        huesped_dni: '',
      });
      expect(result.success).toBe(false);
    });

    it('acepta DNI con exactamente 8 dígitos', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'DNI',
        huesped_dni: '87654321',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza DNI con menos de 8 dígitos', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'DNI',
        huesped_dni: '1234567',
      });
      expect(result.success).toBe(false);
    });

    it('rechaza DNI con letras', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'DNI',
        huesped_dni: '1234567A',
      });
      expect(result.success).toBe(false);
    });

    it('acepta RUC con exactamente 11 dígitos', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'RUC',
        huesped_dni: '20123456789',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza RUC con menos de 11 dígitos', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'RUC',
        huesped_dni: '12345678',
      });
      expect(result.success).toBe(false);
    });

    it('acepta pasaporte entre 6 y 15 caracteres', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'pasaporte',
        huesped_dni: 'AB123456',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza pasaporte con menos de 6 caracteres', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'pasaporte',
        huesped_dni: 'AB12',
      });
      expect(result.success).toBe(false);
    });

    it('acepta CE con al menos 4 caracteres', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'CE',
        huesped_dni: 'ABCD1234',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza CE con menos de 4 caracteres', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tipo_documento: 'CE',
        huesped_dni: 'AB',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('fechas', () => {
    it('rechaza fecha de salida igual a fecha de entrada', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        fecha_entrada: '2026-07-15',
        fecha_salida: '2026-07-15',
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].path).toContain('fecha_salida');
    });

    it('rechaza fecha de salida anterior a fecha de entrada', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        fecha_entrada: '2026-07-17',
        fecha_salida: '2026-07-15',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('noches y precio', () => {
    it('rechaza noches menor a 1', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        noches: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza precio por noche negativo', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        precio_noche: -10,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza total negativo', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        total: -100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('adultos y menores', () => {
    it('rechaza cero adultos', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        num_adultos: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza adultos negativo', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        num_adultos: -1,
      });
      expect(result.success).toBe(false);
    });

    it('requiere observaciones detalladas si tiene menores', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tiene_menores: true,
        observaciones: 'Menor',
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('menores');
    });

    it('acepta observaciones detalladas con menores', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tiene_menores: true,
        observaciones: 'Menor: Juanito Perez, DNI 12345678',
      });
      expect(result.success).toBe(true);
    });

    it('acepta sin menores y sin observaciones', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        tiene_menores: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('campos opcionales', () => {
    it('acepta email válido', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        huesped_email: 'cliente@email.com',
      });
      expect(result.success).toBe(true);
    });

    it('acepta email vacío', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        huesped_email: '',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza email inválido', () => {
      const result = recepcionSchema.safeParse({
        ...baseReserva,
        huesped_email: 'correo-invalido',
      });
      expect(result.success).toBe(false);
    });
  });
});
