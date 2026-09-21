// src/api/db.ts
// Compatibility layer — same synchronous shape as src/api/db.js

import { entities as _entities, TABLE_MAP, TABLE_DATE_COLUMN, createEntityProxy } from './entities';
import type { EntityName, TableName, EntityProxy } from './entities';
import { auth, users } from './auth';
import { forHotel, clearScopedCache, onHotelChange } from './cache';

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

export { forHotel, clearScopedCache, onHotelChange };
export { auth, users };

export const db = {
  entities: _entities,
  auth,
  users,
  forHotel,
  clearScopedCache,
  onHotelChange,
};
