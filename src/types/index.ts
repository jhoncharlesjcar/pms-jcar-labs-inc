export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  role: 'admin' | 'recepcionista' | 'limpieza' | 'developer';
  hotel_id?: string;
  activo?: boolean;
  created_date?: string;
}

export interface AuditLogPayload {
  hotel_id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_role: string;
  accion: string;
  descripcion: string;
  modulo: 'recepcion' | 'ventas' | 'caja' | 'pos' | 'limpieza' | 'configuracion' | 'dev';
}

/**
 * Hotel — Configuración completa del establecimiento
 *
 * @see specs/domain-hotel.md — RN-HOTEL-002
 */
export interface Hotel {
  id: string;
  nombre: string;
  ruc?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  email?: string;
  logo_url?: string;
  mensaje_ticket?: string;
  activo: boolean;

  // Configuración fiscal
  aplica_igv: boolean;
  modo_sunat: 'manual' | 'automatico' | 'desactivado';
  sunat_usuario_sol?: string;
  sunat_clave_sol?: string;

  // Configuración operativa
  hora_checkin: string;
  hora_checkout: string;
  numero_yape?: string;
  tipo_cambio: number;

  // Auditoría
  created_date?: string;
}

/**
 * Habitacion — Inventario de cuartos del hotel
 *
 * @see specs/domain-habitaciones.md
 * @see src/services/recepcion.service.ts — EstadoHabitacion
 */
export interface Habitacion {
  id: string;
  hotel_id: string;
  numero: string;
  piso?: string;
  tipo: 'simple' | 'doble simple' | 'matrimonial' | 'doble matrimonial' | 'mixta' | 'queen';
  estado: 'disponible' | 'ocupada' | 'reservada' | 'mantenimiento' | 'limpieza';
  precio_noche: number;
  capacidad: number;
  descripcion?: string;
  created_date?: string;
}

/**
 * Reserva — Expedientes de reservas y hospedaje activos
 *
 * @see specs/domain-recepcion.md
 * @see src/services/recepcion.service.ts — EstadoReserva
 */
export interface Reserva {
  id: string;
  hotel_id: string;
  habitacion_id: string;
  habitacion_numero?: string;
  habitacion_tipo?: string;
  huesped_nombre: string;
  huesped_dni?: string;
  huesped_telefono?: string;
  huesped_procedencia?: string;
  nacionalidad?: string;
  tipo_documento?: string;
  huesped_fecha_nacimiento?: string;
  huesped_profesion?: string;
  huesped_estado_civil?: string;
  huesped_destino?: string;
  motivo_viaje?: string;
  fecha_entrada: string;
  fecha_salida: string;
  noches: number;
  precio_noche: number;
  total: number;
  num_adultos: number;
  num_ninos: number;
  estado: 'pendiente' | 'confirmada' | 'activa' | 'finalizada' | 'cancelada';
  observaciones?: string;
  numero_reserva?: string;
  token_autoregistro?: string;
  autoregistro_completado?: boolean;
  created_date?: string;
}

/**
 * ConfigHotel — Configuración global del hotel
 */
export interface ConfigHotel {
  id: string;
  loyalty_program_enabled?: boolean;
  modo_sunat?: 'manual' | 'automatico' | 'desactivado';
  aplica_igv?: boolean;
  pasarela_activa?: string;
  qr_yape_url?: string;
  qr_plin_url?: string;
  modo_automatico?: boolean;
}
