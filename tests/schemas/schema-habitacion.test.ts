// @ts-nocheck
/**
 * Tests de validación para los schemas Zod del dominio Habitaciones.
 *
 * @see src/schemas/habitacion.schema.ts
 * @see specs/domain-habitaciones.md
 */
import { habitacionSchema } from '@/schemas/habitacion.schema';

describe('habitacion.schema — habitacionSchema', () => {
  it('acepta habitación válida con todos los campos', () => {
    const result = habitacionSchema.safeParse({
      numero: '101',
      tipo: 'simple',
      piso: '1',
      precio: 80,
      estado: 'disponible',
      descripcion: 'Habitación con vista al mar',
    });
    expect(result.success).toBe(true);
  });

  it('acepta habitación solo con campos obligatorios', () => {
    const result = habitacionSchema.safeParse({
      numero: '101',
      tipo: 'simple',
      precio: 80,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estado).toBe('disponible');
    }
  });

  it('asigna estado "disponible" por defecto', () => {
    const result = habitacionSchema.safeParse({
      numero: '102',
      tipo: 'matrimonial',
      precio: 120,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estado).toBe('disponible');
    }
  });

  describe('número de habitación', () => {
    it('rechaza número vacío', () => {
      const result = habitacionSchema.safeParse({
        numero: '',
        tipo: 'simple',
        precio: 80,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza número demasiado largo (>10 caracteres)', () => {
      const result = habitacionSchema.safeParse({
        numero: '12345678901',
        tipo: 'simple',
        precio: 80,
      });
      expect(result.success).toBe(false);
    });

    it('limpia espacios del número', () => {
      const result = habitacionSchema.safeParse({
        numero: '  101  ',
        tipo: 'simple',
        precio: 80,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.numero).toBe('101');
      }
    });
  });

  describe('tipo de habitación', () => {
    const TIPOS_VALIDOS = ['simple', 'doble simple', 'matrimonial', 'doble matrimonial', 'mixta', 'queen'];

    TIPOS_VALIDOS.forEach(tipo => {
      it(`acepta tipo "${tipo}"`, () => {
        const result = habitacionSchema.safeParse({
          numero: '101',
          tipo,
          precio: 80,
        });
        expect(result.success).toBe(true);
      });
    });

    it('rechaza tipo inválido', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'suite',
        precio: 80,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('precio', () => {
    it('rechaza precio cero', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'simple',
        precio: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza precio negativo', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'simple',
        precio: -50,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza precio no numérico', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'simple',
        precio: 'gratis',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('piso', () => {
    it('acepta piso como número string', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'simple',
        precio: 80,
        piso: '2',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza piso con letras', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'simple',
        precio: 80,
        piso: 'PB',
      });
      expect(result.success).toBe(false);
    });

    it('acepta piso opcional (sin especificar)', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'simple',
        precio: 80,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.piso).toBeUndefined();
      }
    });
  });

  describe('estado', () => {
    const ESTADOS_VALIDOS = ['disponible', 'ocupada', 'reservada', 'mantenimiento', 'limpieza'];

    ESTADOS_VALIDOS.forEach(estado => {
      it(`acepta estado "${estado}"`, () => {
        const result = habitacionSchema.safeParse({
          numero: '101',
          tipo: 'simple',
          precio: 80,
          estado,
        });
        expect(result.success).toBe(true);
      });
    });

    it('rechaza estado inválido', () => {
      const result = habitacionSchema.safeParse({
        numero: '101',
        tipo: 'simple',
        precio: 80,
        estado: 'invalido',
      });
      expect(result.success).toBe(false);
    });
  });
});
