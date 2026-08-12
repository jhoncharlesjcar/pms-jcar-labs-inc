// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as crypto from "https://deno.land/std@0.177.0/crypto/mod.ts"

serve(async (req) => {
  // Solo aceptamos POST para Webhooks
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const signature = req.headers.get('culqi-signature') || req.headers.get('x-signature')
    const rawBody = await req.text()
    
    // HU-10: Validación de firma HMAC-SHA256 (Simulada para este demo)
    // En producción se valida comparando HMAC(webhookSecret, rawBody) == signature
    if (!signature) {
      console.warn("Webhook sin firma recibida, asumiendo ambiente de desarrollo");
    }

    const payload = JSON.parse(rawBody)
    
    // Supongamos que el payload trae el ID que vinculamos
    const paymentIntentId = payload.data?.id || payload.id || null;

    if (!paymentIntentId) {
      return new Response('No payment intent found', { status: 400 })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Actualizamos el estado_pago a "pagado" en < 500ms
    const { error } = await supabaseClient
      .from('reservas')
      .update({ estado_pago: 'pagado' })
      .eq('payment_intent_id', paymentIntentId)

    if (error) throw error;

    return new Response(JSON.stringify({ status: 'ok', updated: paymentIntentId }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
