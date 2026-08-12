// @ts-nocheck
/**
 * Tests de validación para los schemas Zod del dominio Caja.
 *
 * @see src/schemas/caja.schema.ts
 */
import { egresoSchema, cierreCajaSchema, CATEGORIAS_EGRESO } from '@/schemas/caja.schema';

describe('caja.schema — egresoSchema', () => {
  const baseEgreso = {
    monto: 150.00,
    concepto: 'Compra de insumos de limpieza',
    categoria: 'insumos',
    insumo_id: 'ins-001',
    cantidad_insumo: 10,
  };

  it('acepta egreso válido con todos los campos', () => {
    const result = egresoSchema.safeParse(baseEgreso);
    expect(result.success).toBe(true);
  });

  it('acepta egreso operativo sin insumos', () => {
    const result = egresoSchema.safeParse({
      monto: 80.00,
      concepto: 'Pago de luz',
      categoria: 'servicios',
    });
    expect(result.success).toBe(true);
  });

  it('acepta egreso con monto decimal', () => {
    const result = egresoSchema.safeParse({
      monto: 99.99,
      concepto: 'Gasto menor',
      categoria: 'operativo',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza monto cero', () => {
    const result = egresoSchema.safeParse({
      ...baseEgreso,
      monto: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza monto negativo', () => {
    const result = egresoSchema.safeParse({
      ...baseEgreso,
      monto: -50,
    });
    expect(result.success).toBe(false);
  });

  it('rechaza concepto vacío', () => {
    const result = egresoSchema.safeParse({
      ...baseEgreso,
      concepto: '',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza concepto con menos de 3 caracteres', () => {
    const result = egresoSchema.safeParse({
      ...baseEgreso,
      concepto: 'AB',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza categoría inválida', () => {
    const result = egresoSchema.safeParse({
      ...baseEgreso,
      categoria: 'inversión',
    });
    expect(result.success).toBe(false);
  });

  describe('categoría insumos — validación condicional', () => {
    it('rechaza categoría insumos sin insumo_id', () => {
      const result = egresoSchema.safeParse({
        monto: 100,
        concepto: 'Compra insumos',
        categoria: 'insumos',
        insumo_id: '',
        cantidad_insumo: 5,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza categoría insumos sin cantidad', () => {
      const result = egresoSchema.safeParse({
        monto: 100,
        concepto: 'Compra insumos',
        categoria: 'insumos',
        insumo_id: 'ins-001',
        cantidad_insumo: undefined,
      });
      expect(result.success).toBe(false);
    });

    it('rechaza categoría insumos con cantidad cero', () => {
      const result = egresoSchema.safeParse({
        monto: 100,
        concepto: 'Compra insumos',
        categoria: 'insumos',
        insumo_id: 'ins-001',
        cantidad_insumo: 0,
      });
      expect(result.success).toBe(false);
    });

    it('acepta categoría insumos con todos los datos', () => {
      const result = egresoSchema.safeParse({
        monto: 100,
        concepto: 'Compra insumos',
        categoria: 'insumos',
        insumo_id: 'ins-001',
        cantidad_insumo: 10,
      });
      expect(result.success).toBe(true);
    });
  });

  it('limpia espacios del concepto', () => {
    const result = egresoSchema.safeParse({
      monto: 50,
      concepto: '  Gasto de prueba  ',
      categoria: 'operativo',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.concepto).toBe('Gasto de prueba');
    }
  });

  it('CATEGORIAS_EGRESO contiene todas las categorías', () => {
    expect(CATEGORIAS_EGRESO).toContain('operativo');
    expect(CATEGORIAS_EGRESO).toContain('servicios');
    expect(CATEGORIAS_EGRESO).toContain('insumos');
    expect(CATEGORIAS_EGRESO).toContain('mantenimiento');
    expect(CATEGORIAS_EGRESO).toContain('personal');
    expect(CATEGORIAS_EGRESO).toContain('otros');
  });
});

describe('caja.schema — cierreCajaSchema', () => {
  it('acepta cierre sin notas', () => {
    const result = cierreCajaSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('acepta cierre con notas opcionales', () => {
    const result = cierreCajaSchema.safeParse({
      notas: 'Diferencia de S/ 2.00 por vuelto',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza notas demasiado largas', () => {
    const result = cierreCajaSchema.safeParse({
      notas: 'A'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('asigna default vacío para notas no especificadas', () => {
    const result = cierreCajaSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notas).toBe('');
    }
  });
});
