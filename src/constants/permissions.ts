export type AppRole = 'admin' | 'developer' | 'recepcionista' | 'limpieza' | 'user';

/** Fuente compartida por guards, navegación y command palette. */
export const ROUTE_ROLE_MAP: Record<string, readonly AppRole[]> = {
  '/': ['admin', 'developer'],
  '/dev': ['developer'],
  '/configuracion': ['admin', 'developer'],
  '/caja': ['admin', 'developer', 'recepcionista'],
  '/reportes': ['admin', 'developer', 'recepcionista'],
  '/ventas': ['admin', 'developer', 'recepcionista'],
  '/recepcion': ['admin', 'developer', 'recepcionista'],
  '/huespedes': ['admin', 'developer', 'recepcionista'],
  '/pos': ['admin', 'developer', 'recepcionista'],
  '/habitaciones': ['admin', 'developer', 'recepcionista', 'limpieza'],
  '/limpieza': ['admin', 'developer', 'recepcionista', 'limpieza'],
  '/revenue': ['admin', 'developer'],
  '/jcar-ai': ['admin', 'developer'],
  '/insumos': ['admin', 'developer'],
  '/fidelizacion': ['admin', 'developer', 'recepcionista'],
};

export function canAccessPath(role: string | null | undefined, path: string): boolean {
  if (!role) return false;
  const allowedRoles = ROUTE_ROLE_MAP[path] || ['developer'];
  return allowedRoles.includes(role as AppRole);
}

export function getRoleHome(role: string | null | undefined): string {
  if (role === 'limpieza') return '/limpieza';
  if (role === 'recepcionista') return '/recepcion';
  return '/';
}
