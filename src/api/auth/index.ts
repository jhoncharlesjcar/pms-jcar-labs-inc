// src/api/auth/index.ts
// Auth wrapper - logout, inviteUser

import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { clearPersistedCache } from '@/lib/query-client';
import { clearScopedCache } from '../cache';
import { purgeAllQueues } from '@/lib/sync-queue';

export const auth = {
  /**
   * Cierra sesión del usuario actual
   * Limpia sesión, cache, colas offline y redirige a login
   */
  async logout(): Promise<void> {
    logger.debug('--- LOGOUT INICIADO ---');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) logger.error('Error Supabase signOut:', error);

      // Limpieza selectiva para no borrar configuraciones (tema, pwa)
      Object.keys(localStorage).forEach(k => k.startsWith('sb-') && localStorage.removeItem(k));
      sessionStorage.clear();

      // Purgar caché de React Query en IndexedDB
      await clearPersistedCache();

      // Purgar colas offline
      await purgeAllQueues();

      // Limpiar cache scoped por hotel
      clearScopedCache();

      logger.debug('Limpieza completada. Redireccionando...');

      // Redirección forzada
      window.location.replace(window.location.origin);
    } catch (err) {
      logger.error('Error crítico en logout:', err);
      Object.keys(localStorage).forEach(k => k.startsWith('sb-') && localStorage.removeItem(k));
      sessionStorage.clear();
      window.location.replace(window.location.origin);
    }
  },
};

/**
 * Invita a un usuario por email
 * Usa Edge Function con service_role para crear usuario
 */
export const users = {
  async inviteUser(email: string, appRole: string, hotelId: string) {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, role: appRole, hotel_id: hotelId },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'No se pudo invitar al usuario de forma segura');
    return data;
  },
};