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

    console.log(`[ota-sync-inventory] Iniciando sincronización para hotel_id: ${hotel_id}`);

    // Inicializar Supabase Admin Client
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
      console.log(`[ota-sync-inventory] No hay OTAs activas para el hotel ${hotel_id}. Abortando sincronización.`);
      return new Response(JSON.stringify({ message: 'No active OTAs' }), { status: 200 });
    }

    // 2. Obtener mapeo de habitaciones
    const { data: mappings, error: mappingError } = await supabase
      .from('ota_room_mappings')
      .select('*')
      .eq('hotel_id', hotel_id);

    if (mappingError) throw mappingError;

    // TODO: En producción, aquí calcularíamos el inventario real disponible (total habitaciones físicas - reservas) para los próximos X días.
    // Para esta Fase 1, simulamos el cálculo.
    const mockInventory = [
      { pms_room_type: 'simple', available_count: 5 },
      { pms_room_type: 'doble', available_count: 2 },
    ];

    // 3. Iterar sobre las OTAs activas y enviar los datos
    for (const config of otaConfigs) {
      console.log(`[ota-sync-inventory] Preparando envío a OTA: ${config.ota_name}`);
      
      const payload = {
        hotel_code: config.hotel_code_ota,
        timestamp: new Date().toISOString(),
        inventory: []
      };

      for (const item of mockInventory) {
        // Buscar si existe un mapeo para este tipo de habitación en esta OTA
        const mapInfo = mappings?.find(m => m.ota_name === config.ota_name && m.pms_room_type === item.pms_room_type);
        if (mapInfo) {
          payload.inventory.push({
            ota_room_id: mapInfo.ota_room_id,
            available: item.available_count
          });
        }
      }

      console.log(`[ota-sync-inventory] Payload para ${config.ota_name}:`, JSON.stringify(payload, null, 2));

      // MOCK POST REQUEST:
      // En producción, haríamos fetch() hacia la API real de Booking/Despegar con config.api_key
      console.log(`[ota-sync-inventory] ✅ Inventario enviado simuladamente a ${config.ota_name}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'Sync simulated successfully' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    console.error('[ota-sync-inventory] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
})
