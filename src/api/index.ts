// src/api/index.ts
// Main API entry point - re-exports all modules

import { entities, TABLE_MAP, TABLE_DATE_COLUMN, createEntityProxy } from './entities';
import type { EntityName, TableName, EntityProxy } from './entities';
import { auth, users } from './auth';
import { forHotel, clearScopedCache, onHotelChange } from './cache';

export { entities, TABLE_MAP, TABLE_DATE_COLUMN, createEntityProxy };
export type { EntityName, TableName, EntityProxy };
export { enqueueOfflineMutation, getPendingCount, getDeadLetterCount, processQueue, purgeQueuesForIdentity, OfflineMutationError, getCurrentHotelId } from './offline';
export { forHotel, clearScopedCache, onHotelChange };
export { auth, users };

export const db = {
  entities,
  auth,
  users,
  forHotel,
  clearScopedCache,
  onHotelChange,
};
