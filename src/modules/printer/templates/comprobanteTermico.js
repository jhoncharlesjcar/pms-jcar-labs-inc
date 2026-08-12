// comprobanteTermico.js
// Template ESC/POS para Boleta / Factura en ticketera térmica 58mm
// Compatible con RawBT (Android/iOS/Desktop) via printer module
//
// Ancho útil 58mm ≈ 32 caracteres en fuente normal
// Comando ESC/POS usados:
//   ESC @ = reset
//   ESC a N = alineación (0=izq, 1=centro, 2=der)
//   ESC E 1 = negrita ON  |  ESC E 0 = negrita OFF
//   ESC ! n = tamaño fuente (0=normal, 16=doble alto, 48=doble)
//   GS V m  = corte de papel (m=1 corte parcial, m=0 corte total)

const ESC  = '\x1B';
const GS   = '\x1D';
const NL   = '\n';

const CMD = {
  RESET:       ESC + '@',
  ALIGN_LEFT:  ESC + 'a\x00',
  ALIGN_CENTER:ESC + 'a\x01',
  ALIGN_RIGHT: ESC + 'a\x02',
  BOLD_ON:     ESC + 'E\x01',
  BOLD_OFF:    ESC + 'E\x00',
  SIZE_NORMAL: ESC + '!\x00',
  SIZE_DOUBLE: ESC + '!\x30',
  SIZE_TALL:   ESC + '!\x10',
  CUT_PARTIAL: GS  + 'V\x01',
  CUT_TOTAL:   GS  + 'V\x00',
  LINE_FEED:   NL,
};

/** Pad izquierda + derecha en 32 chars (útil para precio en misma línea) */
const padLine = (left, right, width = 32) => {
  const total = width - right.length;
  return left.substring(0, total).padEnd(total) + right;
};

/** Línea de separación */
const separador = (char = '-', width = 32) => char.repeat(width);

/** Formatea número como moneda */
const money = (n) => `S/${Number(n || 0).toFixed(2)}`;

/** Formato fecha corta */
const fechaCorta = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-PE') : new Date().toLocaleDateString('es-PE');

/** Formato hora */
const horaCorta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';

/**
 * Genera el buffer ESC/POS para un comprobante SUNAT (Boleta o Factura)
 * en formato 58mm (32 caracteres por línea)
 *
 * @param {Object} ventaPos  - Registro de ventas_pos (Supabase)
 * @param {Object} hotel     - Registro de hoteles (Supabase)
 * @returns {string}         - Buffer ESC/POS listo para enviar a RawBT
 */
export const buildComprobanteTermico = (ventaPos, hotel) => {
  const tipo = ventaPos.tipo_comprobante === 'factura' ? 'FACTURA' : 'BOLETA DE VENTA';
  const serie = ventaPos.tipo_comprobante === 'factura'
    ? `F001-${String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}`
    : `B001-${String(ventaPos.numero_ticket || '1').replace(/\D/g, '').padStart(8, '0')}`;

  const aplicaIgv = hotel?.aplica_igv !== false;
  const total     = Number(ventaPos.total || 0);
  const base      = aplicaIgv ? total / 1.18 : total;
  const igv       = aplicaIgv ? total - base : 0;

  // Construir ítems
  const items = [];
  if (ventaPos.subtotal_estadia > 0) {
    items.push({
      nombre:   `Hospedaje Hab.${ventaPos.habitacion_numero || ''}`,
      cantidad: 1,
      precio:   ventaPos.subtotal_estadia,
    });
  }
  (ventaPos.items || []).forEach(it => {
    items.push({
      nombre:   it.nombre || it.descripcion || 'Producto',
      cantidad: it.cantidad || 1,
      precio:   it.precio  || it.precio_venta || 0,
    });
  });

  let buf = '';

  // ── RESET ──────────────────────────────────────────────────────────────────
  buf += CMD.RESET;

  // ── ENCABEZADO HOTEL ───────────────────────────────────────────────────────
  buf += CMD.ALIGN_CENTER;
  buf += CMD.BOLD_ON + CMD.SIZE_TALL;
  buf += (hotel?.nombre || 'HOSPEDAJE').substring(0, 32) + NL;
  buf += CMD.SIZE_NORMAL + CMD.BOLD_OFF;

  if (hotel?.ruc)      buf += `RUC: ${hotel.ruc}` + NL;
  if (hotel?.direccion) buf += hotel.direccion.substring(0, 32) + NL;
  if (hotel?.ciudad)    buf += hotel.ciudad.substring(0, 32) + NL;
  if (hotel?.telefono)  buf += `Tel: ${hotel.telefono}` + NL;

  buf += NL;

  // ── TIPO DE COMPROBANTE ────────────────────────────────────────────────────
  buf += CMD.BOLD_ON + CMD.SIZE_TALL;
  buf += tipo + NL;
  buf += CMD.SIZE_NORMAL;
  buf += serie + NL;
  buf += CMD.BOLD_OFF;

  buf += separador('=') + NL;

  // ── FECHA Y MÉTODO DE PAGO ─────────────────────────────────────────────────
  buf += CMD.ALIGN_LEFT;
  buf += padLine('Fecha:', fechaCorta(ventaPos.fecha_venta)) + NL;
  buf += padLine('Hora:',  horaCorta(ventaPos.fecha_venta))  + NL;
  buf += padLine('Pago:',  (ventaPos.metodo_pago || 'efectivo').toUpperCase()) + NL;

  // ── DATOS DEL CLIENTE ──────────────────────────────────────────────────────
  buf += separador() + NL;

  if (ventaPos.tipo_comprobante === 'factura') {
    buf += `RUC : ${ventaPos.ruc_cliente || '—'}` + NL;
    const rs = (ventaPos.razon_social || '—').substring(0, 32);
    buf += `RAZON: ${rs}` + NL;
  } else {
    const nombre = (ventaPos.huesped_nombre || 'Consumidor Final').substring(0, 32);
    buf += `CLIENTE: ${nombre}` + NL;
    if (ventaPos.huesped_dni) {
      buf += `DNI/DOC: ${ventaPos.huesped_dni}` + NL;
    }
  }

  buf += separador() + NL;

  // ── DETALLE DE ÍTEMS ───────────────────────────────────────────────────────
  buf += CMD.BOLD_ON;
  buf += padLine('DESCRIPCION', 'SUBTOTAL') + NL;
  buf += CMD.BOLD_OFF;
  buf += separador() + NL;

  items.forEach(item => {
    const subtotal = Number(item.cantidad) * Number(item.precio);
    // Nombre del producto (puede ocupar 2 líneas si es largo)
    const nombre = item.nombre.substring(0, 32);
    buf += nombre + NL;
    buf += padLine(`  ${item.cantidad} x ${money(item.precio)}`, money(subtotal)) + NL;
  });

  buf += separador('=') + NL;

  // ── TOTALES ────────────────────────────────────────────────────────────────
  if (aplicaIgv) {
    buf += CMD.ALIGN_RIGHT;
    buf += `OP. GRAVADAS : ${money(base)}` + NL;
    buf += `IGV 18%     : ${money(igv)}`  + NL;
  } else {
    buf += CMD.ALIGN_RIGHT;
    buf += `OP. EXONERADA : ${money(total)}` + NL;
    buf += `(Exonerado Ley Amazonia N.27037)` + NL;
  }

  buf += CMD.BOLD_ON + CMD.SIZE_TALL;
  buf += CMD.ALIGN_RIGHT;
  buf += `TOTAL: ${money(total)}` + NL;
  buf += CMD.SIZE_NORMAL + CMD.BOLD_OFF;

  buf += separador() + NL;

  // ── DESCUENTO ──────────────────────────────────────────────────────────────
  if (Number(ventaPos.descuento) > 0) {
    buf += CMD.ALIGN_RIGHT;
    buf += `DESCUENTO: -${money(ventaPos.descuento)}` + NL;
    buf += separador() + NL;
  }

  // ── OBSERVACIONES ──────────────────────────────────────────────────────────
  if (ventaPos.notas) {
    buf += CMD.ALIGN_LEFT;
    buf += `Obs: ${ventaPos.notas.substring(0, 60)}` + NL;
  }

  // ── PIE LEGAL SUNAT ────────────────────────────────────────────────────────
  buf += NL;
  buf += CMD.ALIGN_CENTER;
  buf += CMD.BOLD_ON;
  buf += 'Representacion Impresa' + NL;
  buf += 'de Comprobante Electronico' + NL;
  buf += CMD.BOLD_OFF;
  buf += 'Verifica en:' + NL;
  buf += 'e-consulta.sunat.gob.pe' + NL;

  if (hotel?.mensaje_ticket) {
    buf += NL;
    buf += hotel.mensaje_ticket.substring(0, 32) + NL;
  }

  // ── ESPACIADO Y CORTE ──────────────────────────────────────────────────────
  buf += NL + NL + NL;
  buf += CMD.CUT_PARTIAL;

  return buf;
};

/**
 * Genera ticket de PRUEBA con datos de ejemplo (útil para test de hardware)
 * Llamar desde el panel de desarrollador
 */
export const buildTicketPrueba58mm = (hotel) => {
  const ventaMock = {
    numero_ticket:    '00000001',
    tipo_comprobante: 'boleta',
    fecha_venta:      new Date().toISOString(),
    huesped_nombre:   'CLIENTE PRUEBA',
    huesped_dni:      '12345678',
    habitacion_numero:'101',
    subtotal_estadia: 100.00,
    subtotal_extras:  0,
    descuento:        0,
    total:            100.00,
    metodo_pago:      'efectivo',
    items:            [],
    notas:            'Ticket de prueba 58mm',
  };
  return buildComprobanteTermico(ventaMock, hotel);
};
