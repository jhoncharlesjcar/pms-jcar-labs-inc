// supabase/functions/_shared/auth-middleware.ts
// Middleware compartido para validar JWT y resolver usuario/rol/hotel
// P1 Fix #4: Edge Functions privilegiadas sin autorización interna

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

declare const Deno: { env: { get(key: string): string | undefined } };

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  hotel_id: string | null;
  activo: boolean;
}

export interface AuthResult {
  user: AuthenticatedUser | null;
  error: string | null;
  status: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, x-request-id, x-jcar-key-id, x-jcar-timestamp, x-jcar-nonce, x-jcar-signature',
};

/**
 * Valida el JWT del request y resuelve el perfil del usuario desde la BD.
 * Retorna el usuario autenticado o un error con status HTTP.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Verificar JWT con el anon key (valida la firma)
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
  if (authError || !authUser) {
    return { user: null, error: 'Invalid or expired token', status: 401 };
  }

  // Resolver perfil completo desde BD con service_role
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile, error: profileError } = await adminClient
    .from('usuarios')
    .select('id, email, role, hotel_id, activo')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    return { user: null, error: 'User profile not found', status: 403 };
  }

  if (profile.activo !== true) {
    return { user: null, error: 'User account is deactivated', status: 403 };
  }

  const allowedRoles = ['recepcionista', 'limpieza', 'admin', 'developer'];
  if (!allowedRoles.includes(profile.role)) {
    return { user: null, error: 'User role is invalid', status: 403 };
  }

  if (!profile.hotel_id) {
    return { user: null, error: 'User has no active hotel membership', status: 403 };
  }

  return {
    user: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      hotel_id: profile.hotel_id,
      activo: profile.activo,
    },
    error: null,
    status: 200,
  };
}

/**
 * Valida que un request viene del Supabase Cron Scheduler.
 * Usa un secreto compartido en el header X-Cron-Secret.
 */
export function authenticateCronJob(req: Request): { valid: boolean; error?: string } {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('[AUTH] CRON_SECRET no configurado');
    return { valid: false, error: 'Server misconfigured' };
  }

  const providedSecret = req.headers.get('X-Cron-Secret') || req.headers.get('x-cron-secret');
  if (!providedSecret || providedSecret !== cronSecret) {
    return { valid: false, error: 'Invalid cron credentials' };
  }

  return { valid: true };
}

/**
 * Crea la respuesta de error estándar.
 */
export function errorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    }
  );
}

/**
 * Crea un Supabase admin client (service_role).
 * SOLO llamar después de autenticar al usuario.
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export { corsHeaders };
