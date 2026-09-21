// src/api/cache/index.ts
// Scoped cache per hotel_id

import { entities, type EntityProxy } from '../entities';

const _scopedCache = new Map<string, Record<string, EntityProxy>>();

/** Purga la caché de proxies scoped (llamar en logout o cambio de hotel) */
export function clearScopedCache(): void {
  _scopedCache.clear();
}

/**
 * Crea una instancia de entidades filtrada automáticamente por hotel_id.
 * Síncrono: los consumidores (useHotelData) acceden a hotelDb.Habitacion sin await.
 */
export function forHotel(hotelId: string): Record<string, EntityProxy> {
  if (!hotelId) return entities;

  const cached = _scopedCache.get(hotelId);
  if (cached) return cached;

  const scoped: Record<string, EntityProxy> = {};
  for (const [name, proxy] of Object.entries(entities)) {
    const filterKey = name === 'Hotel' || name === 'ConfigHotel' ? 'id' : 'hotel_id';

    scoped[name] = {
      ...proxy,
      list: (orderBy?: string, limit?: number, columns?: string) =>
        proxy.filter({ [filterKey]: hotelId }, columns, orderBy),
      filter: (filters?: any, columns?: string, orderBy?: string) =>
        proxy.filter({ ...filters, [filterKey]: hotelId }, columns, orderBy),
      create: (data?: any) => proxy.create({ ...data, [filterKey]: hotelId }),
    };
  }
  _scopedCache.set(hotelId, scoped);
  return scoped;
}

/** Purga la caché cuando cambia el hotel activo */
export function onHotelChange(): void {
  clearScopedCache();
}
