// src/api/db.ts
// Compatibility layer - re-exports from new modular structure
// This file maintains backward compatibility with existing imports from '@/api/db'

import { entities as _entities, TABLE_MAP, TABLE_DATE_COLUMN, createEntityProxy } from './entities';
import type { EntityName, TableName, EntityProxy } from './entities';

export { TABLE_MAP, TABLE_DATE_COLUMN, createEntityProxy };
export type { EntityName, TableName, EntityProxy };

export {
  enqueueOfflineMutation,
  getPendingCount,
  getDeadLetterCount,
  processQueue,
  purgeQueuesForIdentity,
  OfflineMutationError,
  getCurrentHotelId
} from './offline';

export {
  forHotel,
  clearScopedCache,
  onHotelChange
} from './cache';

export {
  auth,
  users
} from './auth';

// Main db object for backward compatibility — entities is sync (backward compat)
export const db = {
  get entities() { return _entities; },
  forHotel: (hotelId: string) => import('./cache').then(m => m.forHotel(hotelId)),
  clearScopedCache: () => import('./cache').then(m => m.clearScopedCache()),
  get auth() { return import('./auth').then(m => m.auth); },
  get users() { return import('./auth').then(m => m.users); },
  get offline() { return import('./offline'); },
  get cache() { return import('./cache'); },
};