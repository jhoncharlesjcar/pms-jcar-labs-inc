import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsmuldqqxhirbshyogoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbXVsZHFxeGhpcmJzaHlvZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5ODQwMDEsImV4cCI6MjA5MjU2MDAwMX0.9g_0kZkcPqsUgmflK5CQpRsxrS3FBDXVkEKoIM4wuUY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepInspect() {
    console.log('--- INICIANDO INSPECCIÓN PROFUNDA DE SUPABASE ---');

    // 1. Listar tablas del esquema public
    const { data: tables, error: errT } = await supabase
        .rpc('get_tables_info'); // Intentamos RPC si existe, si no vamos por query directa

    // Nota: Como no podemos hacer consultas directas a information_schema vía REST fácilmente sin un RPC,
    // vamos a intentar listar datos de las tablas probables y ver qué columnas devuelven.

    const probables = ['hoteles', 'habitaciones', 'usuarios', 'ventas', 'reservas', 'productos', 'categorias_productos', 'categorias'];
    
    for (const table of probables) {
        console.log(`\n> Inspeccionando tabla: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        
        if (error) {
            if (error.code === '42P01') {
                console.log(`  [X] La tabla '${table}' NO existe.`);
            } else {
                console.log(`  [!] Error en '${table}': ${error.message}`);
            }
        } else {
            console.log(`  [OK] La tabla '${table}' existe.`);
            if (data && data.length > 0) {
                console.log('  Columnas detectadas:', Object.keys(data[0]).join(', '));
            } else {
                console.log('  Tabla vacía, pero existe.');
            }
        }
    }

    // 2. Ver habitaciones actuales para confirmar 101, 102, 103
    console.log('\n--- VERIFICANDO HABITACIONES ---');
    const { data: habs } = await supabase.from('habitaciones').select('numero, piso').order('numero');
    if (habs) {
        console.log('Habitaciones encontradas:', habs.map(h => h.numero).join(', '));
    }
}

deepInspect();
