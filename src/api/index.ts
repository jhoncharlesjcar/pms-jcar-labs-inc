// src/api/index.ts
// Main API entry point - re-exports all modules

import { entities, TABLE_MAP, TABLE_DATE_COLUMN, createEntityProxy } from './entities';
import type { EntityName, TableName, EntityProxy } from './entities';

export { entities, TABLE_MAP, TABLE_DATE_COLUMN, createEntityProxy };
export type { EntityName, TableName, EntityProxy };
export { enqueueOfflineMutation, getPendingCount, getDeadLetterCount, processQueue, purgeQueuesForIdentity, OfflineMutationError, getCurrentHotelId } from './offline';
export { forHotel, clearScopedCache, onHotelChange } from './cache';
export { auth, users } from './auth';

// Main db object for backward compatibility
export const db = {
  get entities() { return entities; },
  forHotel: (hotelId: string) => import('./cache').then(m => m.forHotel(hotelId)),
  clearScopedCache: () => import('./cache').then(m => m.clearScopedCache()),
  get auth() { return import('./auth').then(m => m.auth); },
  get users() { return import('./auth').then(m => m.users); },
  get offline() { return import('./offline'); },
  get cache() { return import('./cache'); },
};