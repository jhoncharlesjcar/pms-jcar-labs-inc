// src/api/facturacion.ts
// Wrapper for Facturación Edge Function API

/**
 * Envía los datos necesarios para generar un comprobante y enviarlo a SUNAT.
 * La respuesta incluye el estado final del envío (aceptado, observado, rechazado)
 * y el ID del comprobante creado.
 */
export async function crearComprobante(payload: any) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = await getSupabaseSessionToken();

  const response = await fetch(`${supabaseUrl}/functions/v1/facturacion/generar-comprobante`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase auth token (if needed). Assuming the user is authenticated via supabase client.
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error generando comprobante: ${err}`);
  }

  return response.json();
}

// Helper to obtain current supabase session access token
async function getSupabaseSessionToken() {
  // Import inside to avoid circular deps (supabase client is already loaded elsewhere)
  const { supabase } = await import('@/lib/supabaseClient');
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}
