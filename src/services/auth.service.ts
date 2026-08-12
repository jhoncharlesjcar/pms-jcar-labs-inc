import { supabase } from '@/config/supabase';
import { UserProfile, AuditLogPayload } from '@/types';
import logger from '@/lib/logger';
import { generateUUID } from '@/lib/utils';

export const AuthService = {
  /**
   * Obtiene la sesión activa de Supabase
   */
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  /**
   * Carga el perfil completo de un usuario desde la tabla 'usuarios'
   *
   * Validaciones:
   *   - Si el usuario no existe en 'usuarios' (PGRST116) → crea perfil demo
   *   - Si el usuario está desactivado (activo = false) → lanza error
   *   - Normaliza roles antiguos ('administrador' → 'admin')
   */
  async loadUserProfile(userId: string): Promise<UserProfile> {
    const { data: profile, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Registro automático si no existe en base de datos (Entorno Demo)
        return this.createDemoProfile(userId);
      }
      throw error;
    }

    // Validar que el usuario no esté desactivado (soft-delete)
    if (profile.activo === false) {
      throw new Error('Usuario desactivado. Contacta al administrador.');
    }

    // Auto-reparación si el rol registrado en base de datos es 'administrador' en lugar de 'admin'
    let assignedRole = profile.role as 'admin' | 'recepcionista' | 'limpieza' | 'developer' || 'recepcionista';

    // Forzar rol de developer para el dueño usando el email del perfil
    if (profile.email === 'almanacenromeroj@gmail.com') {
      assignedRole = 'developer';
      if (profile.role !== 'developer') {
        await supabase.from('usuarios').update({ role: 'developer' }).eq('id', profile.id);
      }
    } else if (profile.role === 'administrador') {
      assignedRole = 'admin';
      await supabase.from('usuarios').update({ role: 'admin' }).eq('id', profile.id);
    }

    return {
      ...profile,
      role: assignedRole
    };
  },

  /**
   * Crea un perfil demo fallback en caso de autologin
   */
  async createDemoProfile(userId: string): Promise<UserProfile> {
    const defaultHotelId = '11111111-1111-1111-1111-111111111111';
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('Usuario de autenticación no disponible');

    const defaultRole: 'admin' | 'developer' = user.email === 'almanacenromeroj@gmail.com' ? 'developer' : 'admin';

    const { data: newProfile, error } = await supabase
      .from('usuarios')
      .insert({
        id: userId,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario Demo',
        role: defaultRole,
        hotel_id: defaultHotelId
      })
      .select()
      .single();

    if (error) throw error;
    return newProfile;
  },

  /**
   * Guarda un log inmutable de auditoría para evitar fraudes
   */
  async registerAuditLog(payload: Omit<AuditLogPayload, 'id' | 'created_date'>): Promise<void> {
    const logData = {
      ...payload,
      accion: payload.accion.toUpperCase(),
      created_date: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert(logData);

      if (error) throw error;
      logger.info(`[AUDIT LOG] Acción '${payload.accion}' registrada exitosamente en Supabase.`);
    } catch (err) {
      logger.warn('[AUDIT LOG FALLBACK] No se pudo guardar en Supabase. Almacenando en LocalStorage local:', err);
      try {
        const fallbackQueue = JSON.parse(localStorage.getItem('audit_logs_fallback') || '[]');
        fallbackQueue.unshift({
          ...logData,
          id: generateUUID()
        });
        localStorage.setItem('audit_logs_fallback', JSON.stringify(fallbackQueue.slice(0, 100)));
      } catch (localErr) {
        logger.error('[AUDIT LOG CRITICAL] Error en fallback de auditoría:', localErr);
      }
    }
  }
};
export type AuthServiceType = typeof AuthService;
