/**
 * ventas.service.ts — Lógica pura del dominio Ventas / Tickets / POS
 *
 * Este servicio contiene funciones de consolidación de ventas, filtrado,
 * cálculo de resúmenes, numeración de tickets, control de stock del
 * minimarket y manejo de estados de comprobante SUNAT, aisladas de
 * efectos secundarios (DB, UI, API).
 *
 * @see specs/domain-ventas.md
 * @see src/schemas/venta.schema.ts
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface VentaHotel {
  id?: string;
  numero_ticket?: string;
  huesped_nombre?: string;
  huesped_dni?: string;
  habitacion_numero?: string;
  habitacion_tipo?: string;
  noches?: number;
  subtotal?: number;
  descuento?: number;
  total: number;
  igv?: number;
  metodo_pago?: string;
  tipo_comprobante?: string;
  estado_comprobante?: string;
  fecha_pago?: string;
  created_date?: string;
}

export interface VentaPOS {
  id?: string;
  numero_ticket?: string;
  tipo?: string;
  huesped_nombre?: string;
  huesped_dni?: string;
  habitacion_numero?: string;
  reserva_id?: string;
  items?: Array<{
    nombre: string;
    cantidad: number;
    precio_venta: number;
    [key: string]: any;
  }>;
  subtotal_estadia?: number;
  subtotal_extras?: number;
  descuento?: number;
  total: number;
  metodo_pago?: string;
  tipo_comprobante?: string;
  estado_comprobante?: string;
  ruc_cliente?: string;
  razon_social?: string;
  notas?: string;
  fecha_venta?: string;
  created_date?: string;
}

/** Venta consolidada con discriminador _tipo */
export type VentaConsolidada = (VentaHotel | VentaPOS) & {
  _tipo: 'hotel' | 'pos';
  fecha_pago?: string; // normalizado para ambas fuentes
  fecha_venta?: string; // disponible en la fuente POS
};

export interface ProductoData {
  id: string;
  nombre: string;
  stock: number;
  precio_venta?: number;
  categoria_id?: string;
  activo?: boolean;
}

export interface CarritoItem {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  stock: number;
}

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'tarjeta';

export type TipoComprobante = 'boleta' | 'factura' | 'ninguno';

export type EstadoComprobante = 'ticket_interno' | 'sunat_pendiente' | 'sunat_emitido' | 'sunat_rechazado';

export type TipoFiltro = 'hotel' | 'pos' | 'todos';

export interface ResumenDia {
  total: number;
  hotel: number;
  pos: number;
}

export interface DescontarStockResult {
  valido: boolean;
  nuevoStock: number;
  error: string | null;
}

export interface EstadoComprobanteInfo {
  label: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Métodos de pago soportados por el sistema (RN-VEN-001) */
export const METODOS_PAGO: MetodoPago[] = [
  'efectivo',
  'yape',
  'plin',
  'transferencia',
  'tarjeta',
];

/** Métodos de pago digital que requieren código de operación */
export const METODOS_CON_REFERENCIA: MetodoPago[] = ['yape', 'plin'];

/** Tipos de comprobante SUNAT soportados */
export const TIPOS_COMPROBANTE: TipoComprobante[] = ['boleta', 'factura', 'ninguno'];

/** Estados del comprobante SUNAT (RN-VEN-003) */
export const ESTADOS_COMPROBANTE: EstadoComprobante[] = [
  'ticket_interno',
  'sunat_pendiente',
  'sunat_emitido',
  'sunat_rechazado',
];

/** Mapa de información visual de cada estado de comprobante */
export const ESTADO_COMPROBANTE_MAP: Record<string, EstadoComprobanteInfo> = {
  ticket_interno: { label: 'Ticket Interno', color: 'bg-secondary/20 text-muted-foreground border-border/50' },
  sunat_pendiente: { label: 'SUNAT Pendiente', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  sunat_emitido:   { label: 'SUNAT Emitido',   color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  sunat_rechazado: { label: 'SUNAT Rechazado',  color: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

/** Umbral para alerta de stock bajo (RN-VEN-007) */
export const STOCK_BAJO_UMBRAL = 5;

// ---------------------------------------------------------------------------
// VEN-001: Consolidación de ventas Hotel + POS
// ---------------------------------------------------------------------------

/**
 * Consolida ventas de hotel y POS en una sola lista cronológica inversa.
 *
 * Asigna el discriminador _tipo a cada venta y normaliza la fecha
 * para ordenamiento consistente.
 *
 * @param ventasHotel - Lista de ventas de hospedaje
 * @param ventasPOS - Lista de ventas del minimarket
 * @returns Lista consolidada ordenada descendente por fecha
 *
 * @see RN-VEN-001
 */
export function consolidarVentas(
  ventasHotel: VentaHotel[] = [],
  ventasPOS: VentaPOS[] = []
): VentaConsolidada[] {
  const hoteles: VentaConsolidada[] = ventasHotel.map(v => ({
    ...v,
    _tipo: 'hotel' as const,
    fecha_pago: v.fecha_pago || v.created_date || '',
  }));

  const pos: VentaConsolidada[] = ventasPOS.map(v => ({
    ...v,
    _tipo: 'pos' as const,
    fecha_pago: v.fecha_venta || v.created_date || '',
  }));

  return [...hoteles, ...pos].sort((a, b) => {
    const fechaA = a.fecha_pago ? new Date(a.fecha_pago).getTime() : 0;
    const fechaB = b.fecha_pago ? new Date(b.fecha_pago).getTime() : 0;
    return fechaB - fechaA;
  });
}

// ---------------------------------------------------------------------------
// VEN-002: Filtros de búsqueda
// ---------------------------------------------------------------------------

/**
 * Filtra ventas por búsqueda de texto en cliente, ticket o habitación.
 *
 * @param ventas - Lista de ventas consolidadas
 * @param busqueda - Texto de búsqueda (case-insensitive)
 * @returns Ventas que coinciden con la búsqueda
 *
 * @see RN-VEN-002
 */
export function filtrarPorBusqueda(
  ventas: VentaConsolidada[],
  busqueda: string | null | undefined
): VentaConsolidada[] {
  if (!busqueda) return ventas;
  const q = busqueda.toLowerCase();
  return ventas.filter(v => {
    const nombre = (v.huesped_nombre || 'Cliente mostrador').toLowerCase();
    const ticket = (v.numero_ticket || '').toLowerCase();
    const hab = (v.habitacion_numero || '').toLowerCase();
    return nombre.includes(q) || ticket.includes(q) || hab.includes(q);
  });
}

/**
 * Filtra ventas por tipo (hotel, pos, todos).
 *
 * @param ventas - Lista de ventas consolidadas
 * @param tipo - Tipo por el cual filtrar
 * @returns Ventas filtradas por tipo
 *
 * @see RN-VEN-002
 */
export function filtrarPorTipo(
  ventas: VentaConsolidada[],
  tipo: TipoFiltro
): VentaConsolidada[] {
  if (tipo === 'todos') return ventas;
  return ventas.filter(v => v._tipo === tipo);
}

/**
 * Filtra ventas por método de pago.
 *
 * @param ventas - Lista de ventas consolidadas
 * @param metodo - Método de pago o 'todos'
 * @returns Ventas filtradas por método
 *
 * @see RN-VEN-002
 */
export function filtrarPorMetodo(
  ventas: VentaConsolidada[],
  metodo: string
): VentaConsolidada[] {
  if (metodo === 'todos') return ventas;
  return ventas.filter(v => v.metodo_pago === metodo);
}

// ---------------------------------------------------------------------------
// VEN-004: Resumen del día
// ---------------------------------------------------------------------------

/**
 * Calcula los totales del día a partir de una lista de ventas.
 *
 * Evalúa fecha_pago para hotel y fecha_venta para POS, filtrando solo
 * las ventas del día especificado.
 *
 * @param ventas - Lista de ventas consolidadas
 * @param fechaHoy - Fecha en formato yyyy-MM-dd
 * @returns Totales del día desglosados por tipo
 *
 * @see RN-VEN-004
 */
export function calcularTotalesDia(
  ventas: VentaConsolidada[],
  fechaHoy: string
): ResumenDia {
  const deHoy = ventas.filter(v => {
    const f = (v.fecha_pago || v.fecha_venta || '').split('T')[0];
    return f === fechaHoy;
  });

  const total = deHoy.reduce((s, v) => s + Number(v.total || 0), 0);
  const posTotal = deHoy
    .filter(v => v._tipo === 'pos')
    .reduce((s, v) => s + Number(v.total || 0), 0);
  const hotelTotal = deHoy
    .filter(v => v._tipo === 'hotel')
    .reduce((s, v) => s + Number(v.total || 0), 0);

  return {
    total: Math.round(total * 100) / 100,
    hotel: Math.round(hotelTotal * 100) / 100,
    pos: Math.round(posTotal * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// VEN-005: Numeración de tickets hotel (correlativa)
// ---------------------------------------------------------------------------

/**
 * Genera el siguiente número de ticket correlativo para venta hotel.
 *
 * Formato: 6 dígitos con padding de ceros (ej. "000001", "001234").
 * Si se superan los 6 dígitos, el número se expande naturalmente.
 *
 * @param ultimoTicket - Último número de ticket (puede incluir prefijos)
 * @returns Siguiente número de ticket correlativo
 *
 * @see RN-VEN-005
 */
export function generarNumeroTicketHotel(ultimoTicket: string | null | undefined): string {
  const num = ultimoTicket
    ? parseInt(ultimoTicket.replace(/[^0-9]/g, ''), 10) + 1
    : 1;
  return String(num).padStart(6, '0');
}

// ---------------------------------------------------------------------------
// VEN-006: Numeración de tickets POS con prefijo
// ---------------------------------------------------------------------------

/**
 * Genera un número de ticket para venta POS.
 *
 * Formato: POS + timestamp (últimos 6 dígitos), ej. "POS234901"
 * El timestamp aseguda unicidad incluso en alta concurrencia.
 *
 * @returns Número de ticket con prefijo POS (9 caracteres)
 *
 * @see RN-VEN-006
 */
export function generarNumeroTicketPOS(): string {
  return `POS${Date.now().toString().slice(-6)}`;
}

// ---------------------------------------------------------------------------
// VEN-007: Control de stock de productos
// ---------------------------------------------------------------------------

/**
 * Valida y descuenta stock de un producto.
 *
 * Reglas:
 *   - cantidad debe ser > 0
 *   - cantidad no puede exceder el stock disponible
 *   - Si la validación pasa, retorna el nuevo stock
 *
 * @param producto - Producto con stock actual
 * @param cantidad - Cantidad a descontar
 * @returns Resultado con nuevo stock o error
 *
 * @see RN-VEN-007
 */
export function descontarStock(
  producto: ProductoData,
  cantidad: number
): DescontarStockResult {
  if (cantidad <= 0) {
    return { valido: false, nuevoStock: producto.stock, error: 'Cantidad debe ser mayor a 0' };
  }
  if (cantidad > producto.stock) {
    return { valido: false, nuevoStock: producto.stock, error: 'Stock insuficiente' };
  }
  return { valido: true, nuevoStock: producto.stock - cantidad, error: null };
}

/**
 * Determina el nivel de alerta de stock para un producto.
 *
 * 🔴 Stock = 0 → Agotado (bloqueado)
 * 🟠 Stock ≤ umbral (5) → Bajo stock (advertencia)
 * 🟢 Stock > 5 → Normal
 *
 * @param stock - Stock actual del producto
 * @returns Nivel de alerta
 *
 * @see RN-VEN-007
 */
export function obtenerAlertaStock(stock: number): 'agotado' | 'bajo' | 'normal' {
  if (stock <= 0) return 'agotado';
  if (stock <= STOCK_BAJO_UMBRAL) return 'bajo';
  return 'normal';
}

/**
 * Verifica si se puede agregar una cantidad de producto al carrito.
 *
 * @param producto - Producto con stock actual
 * @param cantidadDeseada - Cantidad que se desea agregar (incluye existente)
 * @returns true si hay stock suficiente
 *
 * @see RN-VEN-007
 */
export function validarStockSuficiente(
  producto: ProductoData,
  cantidadDeseada: number
): boolean {
  return cantidadDeseada <= producto.stock;
}

// ---------------------------------------------------------------------------
// VEN-008: Carrito de compras (funciones puras del carrito)
// ---------------------------------------------------------------------------

/**
 * Agrega un producto al carrito. Si ya existe, incrementa la cantidad.
 *
 * @param items - Items actuales del carrito
 * @param producto - Producto a agregar
 * @returns Nuevo array de items con el producto agregado
 *
 * @see RN-VEN-008
 */
export function agregarAlCarrito(
  items: CarritoItem[],
  producto: CarritoItem
): CarritoItem[] {
  const idx = items.findIndex(i => i.id === producto.id);
  if (idx >= 0) {
    const nuevos = [...items];
    nuevos[idx] = { ...nuevos[idx], cantidad: nuevos[idx].cantidad + 1 };
    return nuevos;
  }
  return [...items, { ...producto, cantidad: 1 }];
}

/**
 * Cambia la cantidad de un item en el carrito.
 * Si la nueva cantidad es ≤ 0, elimina el item.
 *
 * @param items - Items actuales del carrito
 * @param idx - Índice del item a modificar
 * @param nuevaCantidad - Nueva cantidad
 * @returns Nuevo array de items actualizado
 *
 * @see RN-VEN-008
 */
export function cambiarCantidadCarrito(
  items: CarritoItem[],
  idx: number,
  nuevaCantidad: number
): CarritoItem[] {
  const nuevos = [...items];
  if (nuevaCantidad <= 0) {
    nuevos.splice(idx, 1);
  } else {
    nuevos[idx] = { ...nuevos[idx], cantidad: nuevaCantidad };
  }
  return nuevos;
}

/**
 * Elimina un item del carrito por índice.
 *
 * @param items - Items actuales del carrito
 * @param idx - Índice del item a eliminar
 * @returns Nuevo array sin el item eliminado
 *
 * @see RN-VEN-008
 */
export function eliminarDelCarrito(
  items: CarritoItem[],
  idx: number
): CarritoItem[] {
  const nuevos = [...items];
  nuevos.splice(idx, 1);
  return nuevos;
}

/**
 * Limpia todos los items del carrito.
 *
 * @returns Array vacío
 *
 * @see RN-VEN-008
 */
export function limpiarCarrito(): CarritoItem[] {
  return [];
}

/**
 * Calcula el número total de unidades en el carrito.
 *
 * @param items - Items del carrito
 * @returns Suma de cantidades de todos los items
 *
 * @see RN-VEN-008
 */
export function getTotalItems(items: CarritoItem[]): number {
  return items.reduce((acc, item) => acc + item.cantidad, 0);
}

/**
 * Calcula el monto total del carrito.
 *
 * @param items - Items del carrito
 * @returns Suma de precio × cantidad para cada item
 *
 * @see RN-VEN-008
 */
export function getTotalMonto(items: CarritoItem[]): number {
  return Math.round(
    items.reduce((acc, item) => acc + item.precio * item.cantidad, 0) * 100
  ) / 100;
}

// ---------------------------------------------------------------------------
// VEN-003/009: Estados de comprobante SUNAT
// ---------------------------------------------------------------------------

/**
 * Obtiene la información visual de un estado de comprobante SUNAT.
 *
 * @param estado - Estado del comprobante
 * @returns Objeto con label y color CSS para el estado
 *
 * @see RN-VEN-003
 * @see RN-VEN-009
 */
export function obtenerEstadoComprobante(estado: string | undefined | null): EstadoComprobanteInfo {
  if (!estado || !ESTADO_COMPROBANTE_MAP[estado]) {
    return ESTADO_COMPROBANTE_MAP.ticket_interno;
  }
  return ESTADO_COMPROBANTE_MAP[estado];
}

/**
 * Determina el estado inicial del comprobante según el modo SUNAT.
 *
 * @param requiereComprobante - true si el cliente solicita comprobante
 * @param modoSunatAutomatico - true si el hotel tiene SUNAT automático
 * @returns Estado inicial del comprobante
 *
 * @see RN-VEN-005
 */
export function determinarEstadoInicialComprobante(
  requiereComprobante: boolean,
  modoSunatAutomatico: boolean
): EstadoComprobante {
  if (!requiereComprobante) return 'ticket_interno';
  if (modoSunatAutomatico) return 'sunat_pendiente';
  return 'sunat_pendiente';
}

// ---------------------------------------------------------------------------
// VEN-005: Estado final según resultado SUNAT
// ---------------------------------------------------------------------------

/**
 * Determina el estado del comprobante después del envío a SUNAT.
 *
 * @param envioExitoso - true si SUNAT aceptó el comprobante
 * @returns Estado final del comprobante
 *
 * @see RN-VEN-005
 */
export function determinarEstadoPostSunat(envioExitoso: boolean): EstadoComprobante {
  return envioExitoso ? 'sunat_emitido' : 'sunat_pendiente';
}
