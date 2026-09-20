// src/api/cache/index.ts
// Scoped cache per hotel_id

import { entities, type EntityProxy } from '../entities';

const _scopedCache = new Map<string, Record<string, EntityProxy>>();

/** Purga la caché de proxies scoped (llamar en logout o cambio de hotel) */
export function clearScopedCache(): void {
  _scopedCache.clear();
}

/**
 * Crea una instancia de entidades filtrada automáticamente por hotel_id
 * Usa cache interna para evitar re-crear objetos proxy en cada render
 * @param hotelId
 */
export async function forHotel(hotelId: string): Promise<Record<string, EntityProxy>> {
  if (!hotelId) return entities;

  if (_scopedCache.has(hotelId)) return _scopedCache.get(hotelId)!;

  const scoped: Record<string, EntityProxy> = {};
  for (const [name, proxy] of Object.entries(entities)) {
    const filterKey = name === 'Hotel' || name === 'ConfigHotel' ? 'id' : 'hotel_id';

    scoped[name] = {
      ...proxy,
      list: (orderBy?: string, limit?: number, columns?: string) => proxy.filter({ [filterKey]: hotelId }, columns, orderBy),
      filter: (filters: Record<string, any>, columns?: string, orderBy?: string) => proxy.filter({ ...filters, [filterKey]: hotelId }, columns, orderBy),
      create: (data: Record<string, any>) => proxy.create({ ...data, [filterKey]: hotelId }),
    };
  }
  _scopedCache.set(hotelId, scoped);
  return scoped;
}

/** Purga la caché cuando cambia el hotel activo */
export function onHotelChange(): void {
  clearScopedCache();
}