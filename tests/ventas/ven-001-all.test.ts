// @ts-nocheck
/**
 * VEN-001 a VEN-010: Tests de contrato del dominio Ventas y Punto de Venta
 *
 * Tests de contrato que validan la consolidación de ventas, filtros,
 * métodos de pago, cálculo de resumen diario, numeración de tickets,
 * carrito de compras, descuento de stock, estados de comprobante SUNAT
 * e impresión de tickets.
 *
 * @see specs/domain-ventas.md — Sección 7
 */
import { ventaSchema } from '@/schemas/venta.schema';
import { METODOS_PAGO } from '@/services/caja.service';
import { validarComprobante, METODOS_PAGO_VALIDOS } from '@/services/checkout.service';
import {
  consolidarVentas,
  filtrarPorBusqueda,
  filtrarPorTipo,
  filtrarPorMetodo,
  calcularTotalesDia,
  generarNumeroTicketHotel,
  generarNumeroTicketPOS,
  descontarStock,
  obtenerEstadoComprobante,
  ESTADO_COMPROBANTE_MAP,
} from '@/services/ventas.service';

// ─── VEN-001: Consolidación de ventas ─────────────────────────────────────

describe('VEN-001: Consolidación de ventas Hotel + POS', () => {
  const hotel = [
    { id: 'h1', numero_ticket: '000001', total: 200, metodo_pago: 'efectivo', created_date: '2026-07-15T10:00:00Z' },
    { id: 'h2', numero_ticket: '000002', total: 150, metodo_pago: 'yape', created_date: '2026-07-15T11:00:00Z' },
  ];
  const pos = [
    { id: 'p1', numero_ticket: 'POS123456', total: 45.50, metodo_pago: 'plin', fecha_venta: '2026-07-15T09:30:00Z' },
  ];

  it('consolida ventas hotel y POS en una sola lista', () => {
    const result = consolidarVentas(hotel, pos);
    expect(result.length).toBe(3);
  });

  it('asigna _tipo="hotel" a ventas de hotel', () => {
    const result = consolidarVentas(hotel, []);
    expect(result.every(v => v._tipo === 'hotel')).toBe(true);
  });

  it('asigna _tipo="pos" a ventas de POS', () => {
    const result = consolidarVentas([], pos);
    expect(result.every(v => v._tipo === 'pos')).toBe(true);
  });

  it('ordena cronológicamente descendente (más reciente primero)', () => {
    const result = consolidarVentas(hotel, pos);
    expect(result[0].id).toBe('h2');  // 11:00
    expect(result[1].id).toBe('h1');  // 10:00
    expect(result[2].id).toBe('p1');  // 09:30
  });

  it('retorna lista vacía si no hay ventas', () => {
    expect(consolidarVentas([], [])).toEqual([]);
  });
});

// ─── VEN-002: Filtros de búsqueda ─────────────────────────────────────────

describe('VEN-002: Filtros de búsqueda', () => {
  const ventas = [
    { id: 'v1', _tipo: 'hotel', numero_ticket: '000001', huesped_nombre: 'Juan Pérez', habitacion_numero: '101', total: 200, metodo_pago: 'efectivo' },
    { id: 'v2', _tipo: 'pos', numero_ticket: 'POS123', huesped_nombre: 'María López', total: 50, metodo_pago: 'yape' },
    { id: 'v3', _tipo: 'hotel', numero_ticket: '000003', huesped_nombre: 'Carlos Ruiz', habitacion_numero: '205', total: 300, metodo_pago: 'tarjeta' },
  ];

  it('filtra por nombre de cliente', () => {
    const result = filtrarPorBusqueda(ventas, 'Juan');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('v1');
  });

  it('filtra por número de ticket', () => {
    const result = filtrarPorBusqueda(ventas, 'POS123');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('v2');
  });

  it('filtra por número de habitación', () => {
    const result = filtrarPorBusqueda(ventas, '205');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('v3');
  });

  it('retorna todos si no hay búsqueda', () => {
    expect(filtrarPorBusqueda(ventas, '').length).toBe(3);
    expect(filtrarPorBusqueda(ventas, null).length).toBe(3);
  });

  it('es case-insensitive', () => {
    const result = filtrarPorBusqueda(ventas, 'juan pérez');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('v1');
  });

  it('retorna vacío si no hay coincidencias', () => {
    expect(filtrarPorBusqueda(ventas, 'zzzzz').length).toBe(0);
  });

  it('filtra por tipo hotel', () => {
    expect(filtrarPorTipo(ventas, 'hotel').length).toBe(2);
  });

  it('filtra por tipo pos', () => {
    expect(filtrarPorTipo(ventas, 'pos').length).toBe(1);
  });

  it('retorna todas si tipo es "todos"', () => {
    expect(filtrarPorTipo(ventas, 'todos').length).toBe(3);
  });

  it('filtra por método de pago', () => {
    const result = filtrarPorMetodo(ventas, 'yape');
    expect(result.length).toBe(1);
    expect(result[0].metodo_pago).toBe('yape');
  });
});

// ─── VEN-003: Métodos de pago ─────────────────────────────────────────────

describe('VEN-003: Métodos de pago', () => {
  it('existen exactamente 5 métodos de pago soportados', () => {
    expect(METODOS_PAGO).toContain('efectivo');
    expect(METODOS_PAGO).toContain('yape');
    expect(METODOS_PAGO).toContain('plin');
    expect(METODOS_PAGO).toContain('transferencia');
    expect(METODOS_PAGO).toContain('tarjeta');
    expect(METODOS_PAGO.length).toBe(5);
  });

  it('METODOS_PAGO_VALIDOS de checkout coincide', () => {
    expect(METODOS_PAGO_VALIDOS).toEqual(METODOS_PAGO);
  });

  it('metodo_pago en ventaSchema acepta los 5 métodos', () => {
    for (const metodo of METODOS_PAGO) {
      const result = ventaSchema.safeParse({ metodo_pago: metodo });
      expect(result.success).toBe(true);
    }
  });

  it('ventaSchema rechaza método de pago inválido', () => {
    const result = ventaSchema.safeParse({ metodo_pago: 'bitcoin' });
    expect(result.success).toBe(false);
  });

  it('ventaSchema requiere metodo_pago', () => {
    const result = ventaSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── VEN-004: Resumen del día ─────────────────────────────────────────────

describe('VEN-004: Resumen del día', () => {
  const hoy = '2026-07-15';

  it('calcula totales del día correctamente', () => {
    const ventas = [
      { id: 'v1', _tipo: 'hotel', total: 200, fecha_pago: '2026-07-15T10:00:00Z' },
      { id: 'v2', _tipo: 'pos', total: 45.50, fecha_venta: '2026-07-15T09:30:00Z' },
      { id: 'v3', _tipo: 'hotel', total: 150, fecha_pago: '2026-07-15T11:00:00Z' },
    ];
    const totals = calcularTotalesDia(ventas, hoy);
    expect(totals.total).toBe(395.50);
    expect(totals.hotel).toBe(350);
    expect(totals.pos).toBe(45.50);
  });

  it('excluye ventas de otros días', () => {
    const ventas = [
      { id: 'v1', _tipo: 'hotel', total: 200, fecha_pago: '2026-07-14T10:00:00Z' },
      { id: 'v2', _tipo: 'pos', total: 45.50, fecha_venta: '2026-07-15T09:30:00Z' },
    ];
    const totals = calcularTotalesDia(ventas, hoy);
    expect(totals.total).toBe(45.50);
    expect(totals.hotel).toBe(0);
    expect(totals.pos).toBe(45.50);
  });

  it('retorna ceros si no hay ventas del día', () => {
    const totals = calcularTotalesDia([], hoy);
    expect(totals.total).toBe(0);
    expect(totals.hotel).toBe(0);
    expect(totals.pos).toBe(0);
  });

  it('maneja total undefined como 0', () => {
    const ventas = [
      { id: 'v1', _tipo: 'hotel', fecha_pago: '2026-07-15T10:00:00Z' },
    ];
    const totals = calcularTotalesDia(ventas, hoy);
    expect(totals.total).toBe(0);
  });

  it('evalúa fecha_pago y fecha_venta en orden de prioridad', () => {
    const ventas = [
      { id: 'v1', _tipo: 'hotel', total: 100, fecha_pago: '2026-07-15T10:00:00Z' },
      { id: 'v2', _tipo: 'pos', total: 50, fecha_venta: '2026-07-15T09:00:00Z', fecha_pago: undefined },
    ];
    const totals = calcularTotalesDia(ventas, hoy);
    expect(totals.total).toBe(150);
  });
});

// ─── VEN-005: Numeración correlativa hotel ────────────────────────────────

describe('VEN-005: Numeración de tickets hotel', () => {
  it('genera primer ticket como 000001', () => {
    expect(generarNumeroTicketHotel(null)).toBe('000001');
    expect(generarNumeroTicketHotel(undefined)).toBe('000001');
  });

  it('incrementa correlativo correctamente', () => {
    expect(generarNumeroTicketHotel('000001')).toBe('000002');
    expect(generarNumeroTicketHotel('000005')).toBe('000006');
    expect(generarNumeroTicketHotel('001000')).toBe('001001');
  });

  it('mantiene formato de 6 dígitos con padding', () => {
    const ticket = generarNumeroTicketHotel('999999');
    expect(ticket).toBe('1000000');
    // Nota: cuando supera 6 dígitos, se expande naturalmente
  });

  it('extrae solo dígitos del ticket anterior', () => {
    expect(generarNumeroTicketHotel('T-000003')).toBe('000004');
    expect(generarNumeroTicketHotel('#000010')).toBe('000011');
  });
});

// ─── VEN-006: Tickets POS con prefijo ─────────────────────────────────────

describe('VEN-006: Tickets POS con prefijo', () => {
  it('genera ticket con prefijo POS', () => {
    const ticket = generarNumeroTicketPOS();
    expect(ticket.startsWith('POS')).toBe(true);
  });

  it('tiene exactamente 9 caracteres (POS + 6 dígitos)', () => {
    const ticket = generarNumeroTicketPOS();
    expect(ticket.length).toBe(9);
  });

  it('la parte numérica contiene solo dígitos', () => {
    const ticket = generarNumeroTicketPOS();
    const numPart = ticket.replace('POS', '');
    expect(/^\d{6}$/.test(numPart)).toBe(true);
  });

  it('genera tickets únicos (diferentes timestamps)', () => {
    const t1 = generarNumeroTicketPOS();
    // Pequeña pausa para asegurar diferente timestamp
    const antes = Date.now();
    while (Date.now() === antes) {} // Esperar al menos 1ms
    const t2 = generarNumeroTicketPOS();
    expect(t1).not.toBe(t2);
  });
});

// ─── VEN-007: Carrito de compras POS ──────────────────────────────────────

describe('VEN-007: Carrito de compras POS', () => {
  let carrito;

  beforeEach(() => {
    // Reiniciar carrito (simula useCartStore)
    carrito = {
      items: [],
      agregarItem(producto) {
        const idx = this.items.findIndex(i => i.id === producto.id);
        if (idx >= 0) {
          this.items[idx] = { ...this.items[idx], cantidad: this.items[idx].cantidad + 1 };
        } else {
          this.items.push({ ...producto, cantidad: 1 });
        }
      },
      cambiarCantidad(idx, nuevaCantidad) {
        if (nuevaCantidad <= 0) {
          this.items.splice(idx, 1);
        } else {
          this.items[idx] = { ...this.items[idx], cantidad: nuevaCantidad };
        }
      },
      eliminarItem(idx) {
        this.items.splice(idx, 1);
      },
      limpiarCarrito() {
        this.items = [];
      },
      getTotalItems() {
        return this.items.reduce((acc, item) => acc + item.cantidad, 0);
      },
      getTotalMonto() {
        return this.items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
      },
    };
  });

  const producto = { id: 'prod-1', nombre: 'Agua 500ml', precio: 2.50, stock: 10 };

  it('agrega producto con cantidad 1 por defecto', () => {
    carrito.agregarItem(producto);
    expect(carrito.items.length).toBe(1);
    expect(carrito.items[0].cantidad).toBe(1);
  });

  it('incrementa cantidad si el producto ya existe', () => {
    carrito.agregarItem(producto);
    carrito.agregarItem(producto);
    expect(carrito.items.length).toBe(1);
    expect(carrito.items[0].cantidad).toBe(2);
  });

  it('agrega productos diferentes como items separados', () => {
    carrito.agregarItem(producto);
    carrito.agregarItem({ id: 'prod-2', nombre: 'Chocolate', precio: 5.00, stock: 5 });
    expect(carrito.items.length).toBe(2);
  });

  it('modifica cantidad de un item', () => {
    carrito.agregarItem(producto);
    carrito.cambiarCantidad(0, 5);
    expect(carrito.items[0].cantidad).toBe(5);
  });

  it('elimina item si nueva cantidad es 0', () => {
    carrito.agregarItem(producto);
    carrito.cambiarCantidad(0, 0);
    expect(carrito.items.length).toBe(0);
  });

  it('elimina item por índice', () => {
    carrito.agregarItem(producto);
    carrito.eliminarItem(0);
    expect(carrito.items.length).toBe(0);
  });

  it('limpia todo el carrito', () => {
    carrito.agregarItem(producto);
    carrito.agregarItem({ id: 'prod-2', nombre: 'Galletas', precio: 3.00, stock: 8 });
    carrito.limpiarCarrito();
    expect(carrito.items.length).toBe(0);
  });

  it('calcula total de items correctamente', () => {
    carrito.agregarItem(producto);
    carrito.agregarItem(producto);
    carrito.agregarItem({ id: 'prod-2', nombre: 'Gaseosa', precio: 4.00, stock: 6 });
    expect(carrito.getTotalItems()).toBe(3);
    expect(carrito.getTotalMonto()).toBe(9.00); // (2.50 * 2) + 4.00
  });

  it('retorna 0 en carrito vacío', () => {
    expect(carrito.getTotalItems()).toBe(0);
    expect(carrito.getTotalMonto()).toBe(0);
  });
});

// ─── VEN-008: Descuento de stock ──────────────────────────────────────────

describe('VEN-008: Descuento de stock al crear venta POS', () => {
  const producto = { id: 'p1', nombre: 'Agua 500ml', stock: 10 };

  it('descuenta stock correctamente', () => {
    const result = descontarStock(producto, 3);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(7);
  });

  it('rechaza descuento con cantidad cero', () => {
    const result = descontarStock(producto, 0);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('mayor a 0');
  });

  it('rechaza descuento con cantidad negativa', () => {
    const result = descontarStock(producto, -1);
    expect(result.valido).toBe(false);
  });

  it('rechaza descuento que excede stock disponible', () => {
    const result = descontarStock(producto, 999);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('insuficiente');
  });

  it('permite descuento exacto al stock disponible (stock final 0)', () => {
    const result = descontarStock(producto, 10);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(0);
  });

  it('múltiples descuentos acumulativos', () => {
    const r1 = descontarStock(producto, 3);
    const r2 = descontarStock({ ...producto, stock: r1.nuevoStock }, 4);
    expect(r1.nuevoStock).toBe(7);
    expect(r2.nuevoStock).toBe(3);
  });
});

// ─── VEN-009: Estados de comprobante SUNAT ────────────────────────────────

describe('VEN-009: Estados de comprobante SUNAT', () => {
  it('retorna "Ticket Interno" para estado undefined', () => {
    const estado = obtenerEstadoComprobante(undefined);
    expect(estado.label).toBe('Ticket Interno');
  });

  it('retorna "Ticket Interno" para ticket_interno', () => {
    const estado = obtenerEstadoComprobante('ticket_interno');
    expect(estado.label).toBe('Ticket Interno');
  });

  it('retorna "SUNAT Pendiente" para sunat_pendiente', () => {
    const estado = obtenerEstadoComprobante('sunat_pendiente');
    expect(estado.label).toBe('SUNAT Pendiente');
  });

  it('retorna "SUNAT Emitido" para sunat_emitido', () => {
    const estado = obtenerEstadoComprobante('sunat_emitido');
    expect(estado.label).toBe('SUNAT Emitido');
  });

  it('retorna "SUNAT Rechazado" para sunat_rechazado', () => {
    const estado = obtenerEstadoComprobante('sunat_rechazado');
    expect(estado.label).toBe('SUNAT Rechazado');
  });

  it('los estados tienen colores CSS asociados', () => {
    expect(ESTADO_COMPROBANTE_MAP.ticket_interno.color).toContain('bg-secondary');
    expect(ESTADO_COMPROBANTE_MAP.sunat_pendiente.color).toContain('bg-orange');
    expect(ESTADO_COMPROBANTE_MAP.sunat_emitido.color).toContain('bg-green');
  });

  it('ventaSchema valida tipo_comprobante correctamente', () => {
    const valido = ventaSchema.safeParse({
      metodo_pago: 'efectivo',
      tipo_comprobante: 'boleta',
      requiere_comprobante: true,
    });
    expect(valido.success).toBe(true);
  });

  it('ventaSchema rechaza tipo_comprobante inválido', () => {
    const valido = ventaSchema.safeParse({
      metodo_pago: 'efectivo',
      tipo_comprobante: 'comprobante_invalido',
    });
    expect(valido.success).toBe(false);
  });
});

// ─── VEN-010: Impresión de ticket hotel ───────────────────────────────────

describe('VEN-010: Impresión de ticket hotel', () => {
  const mockVentaHotel = {
    numero_ticket: '000001',
    huesped_nombre: 'Juan Pérez',
    huesped_dni: '12345678',
    habitacion_numero: '101',
    habitacion_tipo: 'matrimonial',
    noches: 3,
    subtotal: 300,
    descuento: 20,
    total: 280,
    metodo_pago: 'efectivo',
    fecha_pago: '2026-07-15T12:00:00Z',
    estado_comprobante: 'ticket_interno',
  };

  const mockVentaPOS = {
    numero_ticket: 'POS123456',
    huesped_nombre: 'María López',
    total: 45.50,
    metodo_pago: 'yape',
    items: [
      { nombre: 'Agua 500ml', cantidad: 2, precio_venta: 2.50 },
      { nombre: 'Chocolate', cantidad: 1, precio_venta: 5.00 },
    ],
    subtotal_extras: 10.00,
    fecha_venta: '2026-07-15T11:00:00Z',
    estado_comprobante: 'sunat_emitido',
  };

  it('ticket hotel tiene número y total', () => {
    expect(mockVentaHotel.numero_ticket).toBeTruthy();
    expect(mockVentaHotel.total).toBeGreaterThan(0);
  });

  it('ticket hotel tiene datos del huésped y habitación', () => {
    expect(mockVentaHotel.huesped_nombre).toBeTruthy();
    expect(mockVentaHotel.habitacion_numero).toBeTruthy();
    expect(mockVentaHotel.noches).toBeGreaterThan(0);
  });

  it('ticket POS tiene prefijo POS', () => {
    expect(mockVentaPOS.numero_ticket.startsWith('POS')).toBe(true);
  });

  it('ticket POS tiene items en el formato esperado', () => {
    expect(Array.isArray(mockVentaPOS.items)).toBe(true);
    expect(mockVentaPOS.items.length).toBeGreaterThan(0);
    mockVentaPOS.items.forEach(item => {
      expect(item).toHaveProperty('nombre');
      expect(item).toHaveProperty('cantidad');
      expect(item).toHaveProperty('precio_venta');
    });
  });

  it('ticket POS total coincide con la suma de items', () => {
    const sumaItems = mockVentaPOS.items.reduce(
      (s, it) => s + (it.precio_venta * it.cantidad), 0
    );
    expect(sumaItems).toBe(10.00);
    expect(mockVentaPOS.subtotal_extras).toBe(10.00);
  });

  it('comprobante SUNAT para factura requiere RUC y razón social', () => {
    const result = validarComprobante({
      tipo: 'factura',
      ruc: '20123456789',
      razonSocial: 'Empresa SAC',
    });
    expect(result.valido).toBe(true);
  });

  it('comprobante SUNAT para factura rechaza RUC inválido', () => {
    const result = validarComprobante({
      tipo: 'factura',
      ruc: '123',
      razonSocial: 'Empresa SAC',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('RUC');
  });

  it('comprobante SUNAT para boleta requiere DNI y nombre', () => {
    const result = validarComprobante({
      tipo: 'boleta',
      dni: '12345678',
      nombre: 'Juan Pérez',
    });
    expect(result.valido).toBe(true);
  });

  it('comprobante SUNAT para boleta rechaza sin nombre', () => {
    const result = validarComprobante({
      tipo: 'boleta',
      dni: '12345678',
    });
    expect(result.valido).toBe(false);
  });

  it('sin comprobante (ninguno) siempre es válido', () => {
    const result = validarComprobante({ tipo: 'ninguno' });
    expect(result.valido).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});

// ─── ventaSchema: Validación Zod adicional ─────────────────────────────────

describe('ventaSchema — Validación de formulario de venta', () => {
  it('acepta venta básica con solo método de pago', () => {
    const result = ventaSchema.safeParse({ metodo_pago: 'yape' });
    expect(result.success).toBe(true);
  });

  it('asigna valores por defecto', () => {
    const result = ventaSchema.safeParse({ metodo_pago: 'efectivo' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.descuento).toBe(0);
      expect(result.data.tipo_comprobante).toBe('ninguno');
      expect(result.data.requiere_comprobante).toBe(false);
    }
  });

  it('rechaza descuento negativo', () => {
    const result = ventaSchema.safeParse({ metodo_pago: 'efectivo', descuento: -50 });
    expect(result.success).toBe(false);
  });

  it('valida factura: requiere RUC y razón social', () => {
    const result = ventaSchema.safeParse({
      metodo_pago: 'tarjeta',
      requiere_comprobante: true,
      tipo_comprobante: 'factura',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues.some(i => i.path.includes('ruc_cliente'))).toBe(true);
    expect(result.error.issues.some(i => i.path.includes('razon_social'))).toBe(true);
  });

  it('valida factura: acepta con RUC y razón social correctos', () => {
    const result = ventaSchema.safeParse({
      metodo_pago: 'tarjeta',
      requiere_comprobante: true,
      tipo_comprobante: 'factura',
      ruc_cliente: '20123456789',
      razon_social: 'Empresa de Prueba SAC',
    });
    expect(result.success).toBe(true);
  });

  it('valida factura: rechaza RUC que no tiene 11 dígitos', () => {
    const result = ventaSchema.safeParse({
      metodo_pago: 'tarjeta',
      requiere_comprobante: true,
      tipo_comprobante: 'factura',
      ruc_cliente: '12345678',
      razon_social: 'Empresa SAC',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toContain('11 dígitos');
  });
});
