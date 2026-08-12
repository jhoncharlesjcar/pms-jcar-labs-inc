export const ZONA_HORARIA = 'America/Lima';

export const MONEDA = {
  codigo: 'PEN',
  simbolo: 'S/',
  nombre: 'Soles',
  decimales: 2
};

export const FORMATOS_PERU = {
  fecha: 'DD/MM/YYYY',
  fechaHora: 'DD/MM/YYYY HH:mm',
  dniLongitud: 8,
  rucLongitud: 11,
  celularLongitud: 9
};

export const METODOS_PAGO = [
  { id: 'efectivo', label: 'Efectivo', offline: true },
  { id: 'yape', label: 'Yape', offline: true },
  { id: 'plin', label: 'Plin', offline: true },
  { id: 'tarjeta', label: 'Tarjeta de Crédito/Débito', offline: false },
  { id: 'transferencia', label: 'Transferencia Bancaria', offline: false }
] as const;

export const ESTADOS_HABITACION = {
  DISPONIBLE: { id: 'disponible', label: 'Disponible', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' },
  OCUPADA: { id: 'ocupada', label: 'Ocupada', color: 'bg-rose-500/10 text-rose-500 border-rose-500/25' },
  LIMPIEZA: { id: 'limpieza', label: 'Limpieza', color: 'bg-amber-500/10 text-amber-500 border-amber-500/25' },
  MANTENIMIENTO: { id: 'mantenimiento', label: 'Mantenimiento', color: 'bg-slate-500/10 text-slate-500 border-slate-500/25' }
} as const;

export const ESTADOS_RESERVA = {
  PENDIENTE: { id: 'pendiente', label: 'Pendiente', color: 'text-yellow-500 bg-yellow-500/10' },
  CONFIRMADA: { id: 'confirmada', label: 'Confirmada', color: 'text-blue-500 bg-blue-500/10' },
  ACTIVA: { id: 'activa', label: 'Activa (Check-In)', color: 'text-green-500 bg-green-500/10' },
  FINALIZADA: { id: 'finalizada', label: 'Finalizada (Check-Out)', color: 'text-slate-500 bg-slate-500/10' },
  CANCELADA: { id: 'cancelada', label: 'Cancelada', color: 'text-red-500 bg-red-500/10' },
  NOSHOW: { id: 'noshow', label: 'No Show', color: 'text-purple-500 bg-purple-500/10' }
} as const;

export const ROLES_HOTEL = {
  ADMIN: 'admin',
  RECEPCIONISTA: 'recepcionista',
  LIMPIEZA: 'limpieza',
  DEVELOPER: 'developer'
} as const;

export const IMPUESTOS = {
  IGV: 0.18,
  TASA_SERVICIOS: 0.10
};
