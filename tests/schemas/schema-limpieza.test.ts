// @ts-nocheck
/**
 * Tests de validación para los schemas Zod del dominio Limpieza.
 *
 * @see specs/domain-limpieza.md — Sección 4 (Schemas de Datos)
 * @see src/schemas/limpieza.schema.ts
 */
import {
  insumoSchema,
  movimientoInsumoSchema,
  completarLimpiezaSchema,
  asignarLimpiezaSchema,
} from '@/schemas/limpieza.schema';

describe('limpieza.schema — insumoSchema', () => {
  it('acepta un insumo válido con todos los campos', () => {
    const result = insumoSchema.safeParse({
      nombre: 'Jabón Líquido',
      stock: 50,
      unidad_medida: 'litro',
      umbral_minimo: 10,
      costo_unitario: 3.50,
      activo: true,
    });
    expect(result.success).toBe(true);
  });

  it('asigna valores por defecto para campos opcionales', () => {
    const result = insumoSchema.safeParse({
      nombre: 'Papel',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock).toBe(0);
      expect(result.data.unidad_medida).toBe('unidad');
      expect(result.data.umbral_minimo).toBe(10);
      expect(result.data.costo_unitario).toBe(0);
      expect(result.data.activo).toBe(true);
    }
  });

  it('rechaza nombre con menos de 2 caracteres', () => {
    const result = insumoSchema.safeParse({ nombre: 'A' });
    expect(result.success).toBe(false);
  });

  it('rechaza stock negativo', () => {
    const result = insumoSchema.safeParse({ nombre: 'Test', stock: -1 });
    expect(result.success).toBe(false);
  });

  it('rechaza unidad_medida inválida', () => {
    const result = insumoSchema.safeParse({ nombre: 'Test', unidad_medida: 'tonelada' });
    expect(result.success).toBe(false);
  });

  it('rechaza costo_unitario negativo', () => {
    const result = insumoSchema.safeParse({ nombre: 'Test', costo_unitario: -5 });
    expect(result.success).toBe(false);
  });

  it('rechaza umbral_minimo menor a 1', () => {
    const result = insumoSchema.safeParse({ nombre: 'Test', umbral_minimo: 0 });
    expect(result.success).toBe(false);
  });

  it('limpia espacios del nombre', () => {
    const result = insumoSchema.safeParse({ nombre: '  Jabón  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nombre).toBe('Jabón');
    }
  });
});

describe('limpieza.schema — movimientoInsumoSchema', () => {
  const baseMovimiento = {
    insumo_id: 'ins-001',
    tipo_movimiento: 'entrada',
    cantidad: 10,
    costo_total: 35.00,
    motivo: 'Compra mensual de insumos',
  };

  it('acepta movimiento de entrada válido', () => {
    const result = movimientoInsumoSchema.safeParse(baseMovimiento);
    expect(result.success).toBe(true);
  });

  it('acepta movimiento de salida válido', () => {
    const result = movimientoInsumoSchema.safeParse({
      ...baseMovimiento,
      tipo_movimiento: 'salida',
      costo_total: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza sin insumo_id', () => {
    const result = movimientoInsumoSchema.safeParse({ ...baseMovimiento, insumo_id: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza tipo_movimiento inválido', () => {
    const result = movimientoInsumoSchema.safeParse({ ...baseMovimiento, tipo_movimiento: 'transferencia' });
    expect(result.success).toBe(false);
  });

  it('rechaza cantidad cero', () => {
    const result = movimientoInsumoSchema.safeParse({ ...baseMovimiento, cantidad: 0 });
    expect(result.success).toBe(false);
  });

  it('rechaza cantidad negativa', () => {
    const result = movimientoInsumoSchema.safeParse({ ...baseMovimiento, cantidad: -5 });
    expect(result.success).toBe(false);
  });

  it('rechaza costo_total negativo', () => {
    const result = movimientoInsumoSchema.safeParse({ ...baseMovimiento, costo_total: -10 });
    expect(result.success).toBe(false);
  });

  it('rechaza motivo vacío', () => {
    const result = movimientoInsumoSchema.safeParse({ ...baseMovimiento, motivo: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza motivo con menos de 3 caracteres', () => {
    const result = movimientoInsumoSchema.safeParse({ ...baseMovimiento, motivo: 'AB' });
    expect(result.success).toBe(false);
  });

  it('acepta limpieza_id opcional', () => {
    const result = movimientoInsumoSchema.safeParse({
      ...baseMovimiento,
      limpieza_id: 'limp-001',
    });
    expect(result.success).toBe(true);
  });
});

describe('limpieza.schema — completarLimpiezaSchema', () => {
  const baseCompletar = {
    habitacion_id: 'hab-001',
  };

  it('acepta completar limpieza sin insumos', () => {
    const result = completarLimpiezaSchema.safeParse(baseCompletar);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.insumos_usados).toEqual([]);
      expect(result.data.observaciones).toBe('');
    }
  });

  it('acepta completar limpieza con insumos', () => {
    const result = completarLimpiezaSchema.safeParse({
      ...baseCompletar,
      insumos_usados: [
        { insumo_id: 'ins-001', cantidad: 2, costo_total: 7.00 },
      ],
      observaciones: 'Limpieza completa',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.insumos_usados.length).toBe(1);
      expect(result.data.insumos_usados[0].cantidad).toBe(2);
    }
  });

  it('rechaza sin habitacion_id', () => {
    const result = completarLimpiezaSchema.safeParse({ habitacion_id: '' });
    expect(result.success).toBe(false);
  });

  it('rechaza insumo con cantidad cero', () => {
    const result = completarLimpiezaSchema.safeParse({
      ...baseCompletar,
      insumos_usados: [
        { insumo_id: 'ins-001', cantidad: 0 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza insumo con cantidad negativa', () => {
    const result = completarLimpiezaSchema.safeParse({
      ...baseCompletar,
      insumos_usados: [
        { insumo_id: 'ins-001', cantidad: -1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza observaciones demasiado largas', () => {
    const result = completarLimpiezaSchema.safeParse({
      ...baseCompletar,
      observaciones: 'A'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

describe('limpieza.schema — asignarLimpiezaSchema', () => {
  it('acepta asignación sin usuario (tarea pública)', () => {
    const result = asignarLimpiezaSchema.safeParse({
      habitacion_id: 'hab-001',
    });
    expect(result.success).toBe(true);
  });

  it('acepta asignación con usuario específico', () => {
    const result = asignarLimpiezaSchema.safeParse({
      habitacion_id: 'hab-001',
      usuario_id: 'user-001',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.usuario_id).toBe('user-001');
    }
  });

  it('rechaza sin habitacion_id', () => {
    const result = asignarLimpiezaSchema.safeParse({ habitacion_id: '' });
    expect(result.success).toBe(false);
  });
});
