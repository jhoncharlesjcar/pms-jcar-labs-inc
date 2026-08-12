// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reserva_id, monto, pasarela, hotel_id } = await req.json()
    
    // Aquí en un entorno de producción, obtendríamos la Private Key desencriptando
    // con la master key del servidor desde la tabla hoteles.
    // Para esta simulación, generamos un código QR dinámico ficticio 
    // pero válido visualmente que representa el "Payment Intent".

    const paymentIntentId = crypto.randomUUID();

    // Actualizamos la reserva para guardar el payment_intent_id (HU-09)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseClient
      .from('reservas')
      .update({ payment_intent_id: paymentIntentId })
      .eq('id', reserva_id)

    // Generamos una URL de pago dinámica real
    // (en producción esto te lo devuelve la API de Culqi / Izipay)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PAY-INTENT:${paymentIntentId}|AMT:${monto}`)}`

    return new Response(
      JSON.stringify({ 
        qrUrl, 
        paymentIntentId, 
        message: 'QR generado correctamente' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
