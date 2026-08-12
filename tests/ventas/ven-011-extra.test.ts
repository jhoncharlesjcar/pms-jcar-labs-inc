// @ts-nocheck
/**
 * VEN-011 a VEN-014: Tests adicionales de ventas.service.ts
 *
 * Cubre funciones puras del servicio que no estaban testeadas:
 *   - Carrito: agregarAlCarrito, cambiarCantidadCarrito, eliminarDelCarrito,
 *     limpiarCarrito, getTotalItems, getTotalMonto
 *   - Stock: obtenerAlertaStock, validarStockSuficiente
 *   - SUNAT: determinarEstadoInicialComprobante, determinarEstadoPostSunat
 *   - Constantes: METODOS_CON_REFERENCIA, TIPOS_COMPROBANTE,
 *     ESTADOS_COMPROBANTE, STOCK_BAJO_UMBRAL
 *
 * @see src/services/ventas.service.ts
 */
import {
  agregarAlCarrito,
  cambiarCantidadCarrito,
  eliminarDelCarrito,
  limpiarCarrito,
  getTotalItems,
  getTotalMonto,
  obtenerAlertaStock,
  validarStockSuficiente,
  determinarEstadoInicialComprobante,
  determinarEstadoPostSunat,
  METODOS_CON_REFERENCIA,
  TIPOS_COMPROBANTE,
  ESTADOS_COMPROBANTE,
  STOCK_BAJO_UMBRAL,
} from '@/services/ventas.service';

// ─── VEN-011: Carrito (funciones puras) ──────────────────────────────────

describe('VEN-011: Carrito — funciones puras agregarAlCarrito', () => {
  const base = { id: 'p1', nombre: 'Agua 500ml', precio: 2.50, cantidad: 1, stock: 10 };
  const producto2 = { id: 'p2', nombre: 'Chocolate', precio: 5.00, cantidad: 1, stock: 5 };

  it('agrega producto a carrito vacío', () => {
    const items = agregarAlCarrito([], base);
    expect(items.length).toBe(1);
    expect(items[0].cantidad).toBe(1);
  });

  it('incrementa cantidad si el producto ya existe', () => {
    const items = agregarAlCarrito([{ ...base, cantidad: 2 }], base);
    expect(items.length).toBe(1);
    expect(items[0].cantidad).toBe(3);
  });

  it('agrega productos diferentes como items separados', () => {
    const items = agregarAlCarrito([{ ...base }], producto2);
    expect(items.length).toBe(2);
  });

  it('no muta el array original', () => {
    const original = [{ ...base }];
    const resultado = agregarAlCarrito(original, producto2);
    expect(original.length).toBe(1); // Sin mutación
    expect(resultado.length).toBe(2); // Nuevo array
  });
});

describe('VEN-011b: Carrito — cambiarCantidadCarrito', () => {
  const base = { id: 'p1', nombre: 'Agua 500ml', precio: 2.50, cantidad: 3, stock: 10 };

  it('cambia cantidad de un item', () => {
    const items = cambiarCantidadCarrito([{ ...base }], 0, 5);
    expect(items[0].cantidad).toBe(5);
  });

  it('elimina item si nueva cantidad es 0', () => {
    const items = cambiarCantidadCarrito([{ ...base }], 0, 0);
    expect(items.length).toBe(0);
  });

  it('elimina item si nueva cantidad es negativa', () => {
    const items = cambiarCantidadCarrito([{ ...base }], 0, -1);
    expect(items.length).toBe(0);
  });
});

describe('VEN-011c: Carrito — eliminarDelCarrito, limpiarCarrito', () => {
  const items = [
    { id: 'p1', nombre: 'Agua', precio: 2.50, cantidad: 1, stock: 10 },
    { id: 'p2', nombre: 'Galletas', precio: 3.00, cantidad: 2, stock: 8 },
  ];

  it('elimina item por índice', () => {
    const result = eliminarDelCarrito(items, 0);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('p2');
  });

  it('limpia todo el carrito', () => {
    expect(limpiarCarrito()).toEqual([]);
  });
});

describe('VEN-011d: Carrito — getTotalItems, getTotalMonto', () => {
  const items = [
    { id: 'p1', nombre: 'Agua', precio: 2.50, cantidad: 2, stock: 10 },
    { id: 'p2', nombre: 'Galletas', precio: 3.00, cantidad: 3, stock: 8 },
  ];

  it('calcula total de unidades', () => {
    expect(getTotalItems(items)).toBe(5); // 2 + 3
  });

  it('calcula monto total', () => {
    expect(getTotalMonto(items)).toBe(14.00); // (2.50*2) + (3.00*3)
  });

  it('retorna 0 para carrito vacío', () => {
    expect(getTotalItems([])).toBe(0);
    expect(getTotalMonto([])).toBe(0);
  });

  it('maneja precios con decimales', () => {
    const itemsDecimal = [
      { id: 'p1', nombre: 'Producto', precio: 1.25, cantidad: 3, stock: 10 },
    ];
    expect(getTotalMonto(itemsDecimal)).toBe(3.75);
  });
});

// ─── VEN-012: Alertas de stock ───────────────────────────────────────────

describe('VEN-012: Alertas de stock — obtenerAlertaStock', () => {
  it('retorna \"agotado\" para stock 0', () => {
    expect(obtenerAlertaStock(0)).toBe('agotado');
  });

  it('retorna \"agotado\" para stock negativo', () => {
    expect(obtenerAlertaStock(-1)).toBe('agotado');
  });

  it('retorna \"bajo\" para stock en el umbral', () => {
    expect(obtenerAlertaStock(STOCK_BAJO_UMBRAL)).toBe('bajo'); // 5
  });

  it('retorna \"bajo\" para stock entre 1 y umbral', () => {
    expect(obtenerAlertaStock(3)).toBe('bajo');
    expect(obtenerAlertaStock(1)).toBe('bajo');
  });

  it('retorna \"normal\" para stock superior al umbral', () => {
    expect(obtenerAlertaStock(10)).toBe('normal');
    expect(obtenerAlertaStock(6)).toBe('normal');
  });
});

describe('VEN-012b: validarStockSuficiente', () => {
  const producto = { id: 'p1', nombre: 'Agua', stock: 10 };

  it('permite cantidad igual al stock', () => {
    expect(validarStockSuficiente(producto, 10)).toBe(true);
  });

  it('permite cantidad menor al stock', () => {
    expect(validarStockSuficiente(producto, 5)).toBe(true);
  });

  it('rechaza cantidad mayor al stock', () => {
    expect(validarStockSuficiente(producto, 11)).toBe(false);
  });

  it('rechaza producto con stock 0', () => {
    expect(validarStockSuficiente({ ...producto, stock: 0 }, 1)).toBe(false);
  });
});

// ─── VEN-013: Estados de comprobante SUNAT ────────────────────────────────

describe('VEN-013: determinarEstadoInicialComprobante', () => {
  it('retorna ticket_interno si no requiere comprobante', () => {
    const estado = determinarEstadoInicialComprobante(false, false);
    expect(estado).toBe('ticket_interno');
  });

  it('retorna sunat_pendiente si requiere comprobante (modo manual)', () => {
    const estado = determinarEstadoInicialComprobante(true, false);
    expect(estado).toBe('sunat_pendiente');
  });

  it('retorna sunat_pendiente si requiere comprobante (modo automático)', () => {
    const estado = determinarEstadoInicialComprobante(true, true);
    expect(estado).toBe('sunat_pendiente');
  });

  it('retorna ticket_interno sin requerimiento incluso en modo automático', () => {
    const estado = determinarEstadoInicialComprobante(false, true);
    expect(estado).toBe('ticket_interno');
  });
});

describe('VEN-013b: determinarEstadoPostSunat', () => {
  it('retorna sunat_emitido si el envío fue exitoso', () => {
    expect(determinarEstadoPostSunat(true)).toBe('sunat_emitido');
  });

  it('retorna sunat_pendiente si el envío falló', () => {
    expect(determinarEstadoPostSunat(false)).toBe('sunat_pendiente');
  });
});

// ─── VEN-014: Constantes del servicio ────────────────────────────────────

describe('VEN-014: Constantes del servicio', () => {
  it('METODOS_CON_REFERENCIA contiene yape y plin', () => {
    expect(METODOS_CON_REFERENCIA).toContain('yape');
    expect(METODOS_CON_REFERENCIA).toContain('plin');
    expect(METODOS_CON_REFERENCIA.length).toBe(2);
  });

  it('TIPOS_COMPROBANTE contiene boleta, factura y ninguno', () => {
    expect(TIPOS_COMPROBANTE).toContain('boleta');
    expect(TIPOS_COMPROBANTE).toContain('factura');
    expect(TIPOS_COMPROBANTE).toContain('ninguno');
    expect(TIPOS_COMPROBANTE.length).toBe(3);
  });

  it('ESTADOS_COMPROBANTE contiene los 4 estados', () => {
    expect(ESTADOS_COMPROBANTE).toContain('ticket_interno');
    expect(ESTADOS_COMPROBANTE).toContain('sunat_pendiente');
    expect(ESTADOS_COMPROBANTE).toContain('sunat_emitido');
    expect(ESTADOS_COMPROBANTE).toContain('sunat_rechazado');
    expect(ESTADOS_COMPROBANTE.length).toBe(4);
  });

  it('STOCK_BAJO_UMBRAL es 5', () => {
    expect(STOCK_BAJO_UMBRAL).toBe(5);
  });
});
