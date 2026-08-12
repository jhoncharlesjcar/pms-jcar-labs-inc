// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Acepta llamadas OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const { hotel_id } = await req.json();

    if (!hotel_id) {
      return new Response(JSON.stringify({ error: 'Missing hotel_id' }), { status: 400 });
    }

    console.log(`[ota-sync-rates] Iniciando sincronización de TARIFAS YIELD para hotel_id: ${hotel_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Obtener configuraciones de OTAs activas
    const { data: otaConfigs, error: configError } = await supabase
      .from('ota_config')
      .select('*')
      .eq('hotel_id', hotel_id)
      .eq('is_active', true);

    if (configError) throw configError;

    if (!otaConfigs || otaConfigs.length === 0) {
      return new Response(JSON.stringify({ message: 'No active OTAs' }), { status: 200 });
    }

    // 2. Obtener Reglas de Yield por Ocupación
    const { data: yieldRules, error: yieldError } = await supabase
      .from('tarifas_dinamicas')
      .select('*')
      .eq('hotel_id', hotel_id)
      .eq('tipo', 'ocupacion')
      .eq('activo', true)
      .order('umbral_ocupacion_min', { ascending: true });
      
    if (yieldError) throw yieldError;

    // 3. Obtener mapeo de habitaciones
    const { data: mappings, error: mappingError } = await supabase
      .from('ota_room_mappings')
      .select('*')
      .eq('hotel_id', hotel_id);

    if (mappingError) throw mappingError;

    // TODO: En producción, se calcularía la ocupación proyectada para cada uno de los próximos X días.
    // Para esta Fase 1, simulamos que hoy la ocupación es del 85%.
    const currentOccupancyMock = 85; 

    console.log(`[ota-sync-rates] Ocupación simulada: ${currentOccupancyMock}%`);

    // Calcular factor multiplicador total
    let yieldFactor = 1.0;
    if (yieldRules && yieldRules.length > 0) {
      for (const rule of yieldRules) {
        if (currentOccupancyMock >= rule.umbral_ocupacion_min) {
          console.log(`[ota-sync-rates] Regla aplicada: >= ${rule.umbral_ocupacion_min}% -> Factor x${rule.factor_ajuste}`);
          yieldFactor = yieldFactor * Number(rule.factor_ajuste);
        }
      }
    }

    console.log(`[ota-sync-rates] Factor Yield total a aplicar: ${yieldFactor.toFixed(4)}`);

    // MOCK RATES 
    const baseRates = [
      { pms_room_type: 'simple', price: 100 },
      { pms_room_type: 'doble', price: 150 },
    ];

    // 4. Iterar sobre las OTAs activas y enviar nuevas tarifas
    for (const config of otaConfigs) {
      console.log(`[ota-sync-rates] Preparando envío de TARIFAS a OTA: ${config.ota_name}`);
      
      const payload = {
        hotel_code: config.hotel_code_ota,
        timestamp: new Date().toISOString(),
        rates: []
      };

      for (const item of baseRates) {
        const mapInfo = mappings?.find(m => m.ota_name === config.ota_name && m.pms_room_type === item.pms_room_type);
        if (mapInfo) {
          payload.rates.push({
            ota_room_id: mapInfo.ota_room_id,
            price: Number((item.price * yieldFactor).toFixed(2))
          });
        }
      }

      console.log(`[ota-sync-rates] Payload para ${config.ota_name}:`, JSON.stringify(payload, null, 2));

      // MOCK POST REQUEST: API real de Booking/Despegar
      console.log(`[ota-sync-rates] ✅ Tarifas actualizadas simuladamente en ${config.ota_name}`);
    }

    return new Response(JSON.stringify({ success: true, yieldFactor, message: 'Rates sync simulated successfully' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error('[ota-sync-rates] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
})
