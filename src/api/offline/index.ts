// src/api/offline/index.ts
// Offline queue management

import { enqueueMutation, OfflineMutationError, getPendingCount, getDeadLetterCount, processQueue, purgeQueuesForIdentity } from '@/lib/sync-queue';
import logger from '@/lib/logger';

/** Helper: obtener userId de la sesión actual */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await import('@/config/supabase').then(m => m.supabase.auth.getSession());
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/** Helper: obtener hotelId del localStorage */
export function getCurrentHotelId(): string | null {
  return localStorage.getItem('hotel_activo_id') || null;
}

export interface OfflineQueueOptions {
  operation: 'create' | 'update' | 'delete';
  tableName: string;
  data?: Record<string, any>;
  recordId: string;
  userId: string | null;
  hotelId: string | null;
}

/**
 * Encola una mutación para sincronización posterior
 * Lanza OfflineMutationError si está offline (por diseño)
 */
export async function enqueueOfflineMutation(options: OfflineQueueOptions): Promise<void> {
  if (!navigator.onLine) {
    const { userId, hotelId, operation, tableName, data, recordId } = options;
    logger.warn(`Modo offline: Encolando ${operation} en ${tableName}`, data || recordId);
    await enqueueMutation(operation, options.tableName, data || null, recordId, userId, hotelId);
    throw new OfflineMutationError(operation, options.tableName, 'offline');
  }
  // Si está online, no encolar - dejar que el caller haga la operación directa
}

export { getPendingCount, getDeadLetterCount, processQueue, purgeQueuesForIdentity, OfflineMutationError };