// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pasarela, publicKey, privateKey } = await req.json()

    let isValid = false;

    // Dependiendo de la pasarela, hacemos un llamado de prueba para validar el token
    if (pasarela === 'culqi') {
      // Endpoint ligero para probar la llave secreta en Culqi
      const response = await fetch('https://api.culqi.com/v2/events', {
        headers: {
          'Authorization': `Bearer ${privateKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Si el status NO es 401 (Unauthorized), asumimos que la llave es válida. 
      // Podría dar 200 (lista vacía) o 400, pero 401 significa llave incorrecta.
      isValid = response.status !== 401;

    } else if (pasarela === 'izipay') {
      // Ejemplo simplificado para Izipay
      const auth = btoa(`${publicKey}:${privateKey}`);
      const response = await fetch('https://api.micuentaweb.pe/api-payment/V4/Charge/Get', {
         method: 'POST',
         headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
         },
         body: JSON.stringify({ "uuid": "test-uuid-no-existe" })
      });
      isValid = response.status !== 401;

    } else if (pasarela === 'niubiz') {
      // Ejemplo simplificado para Niubiz
      const response = await fetch('https://apitestenv.vnforapps.com/api.security/v1/security', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa('test:test')}` // Requiere lógica específica de Niubiz para el token
        }
      });
      // Mock para este demo, en producción aquí se generaría el token de seguridad de Niubiz
      isValid = privateKey.length > 10;
    }

    return new Response(
      JSON.stringify({ valid: isValid, message: isValid ? 'OK' : 'Invalid Credentials' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
