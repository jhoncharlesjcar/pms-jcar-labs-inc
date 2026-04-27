import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
    envContent.split('\n')
        .filter(line => line.includes('=') && !line.startsWith('#'))
        .map(line => {
            const [key, ...rest] = line.split('=');
            return [key.trim(), rest.join('=').trim()];
        })
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: No se encontraron las credenciales en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
    console.log('--- INICIANDO INSPECCIÓN DE SUPABASE (PRO 3.1) ---');
    console.log('URL:', supabaseUrl);
    
    const knownTables = [
        'habitaciones', 'reservas', 'ventas', 'hoteles', 
        'config_hotel', 'servicios_extra', 'ventas_pos', 
        'codigos_desbloqueo', 'usuarios'
    ];

    console.log('\n--- VERIFICANDO TABLAS ACTIVAS ---');
    for (const table of knownTables) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.log(`❌ Tabla [${table}]: ERROR - ${error.message}`);
            } else {
                console.log(`✅ Tabla [${table}]: EXISTE (Filas: ${count})`);
            }
        } catch (e) {
            console.log(`❌ Tabla [${table}]: FALLO CRÍTICO - ${e.message}`);
        }
    }

    // Análisis de usuarios
    console.log('\n--- ANALIZANDO USUARIOS ---');
    const { data: users, error: userError } = await supabase.from('usuarios').select('*').limit(3);
    if (userError) console.log('Error usuarios:', userError.message);
    else console.log('Usuarios:', JSON.stringify(users, null, 2));

    // Análisis de hoteles vs config
    console.log('\n--- ANALIZANDO HOTELES VS CONFIG ---');
    const { data: hoteles, error: hError } = await supabase.from('hoteles').select('*').limit(3);
    const { data: config, error: cError } = await supabase.from('config_hotel').select('*').limit(3);
    
    if (hError) console.log('Error hoteles:', hError.message);
    else console.log('Hoteles:', JSON.stringify(hoteles, null, 2));
    
    if (cError) console.log('Error config_hotel:', cError.message);
    else console.log('Config Hotel:', JSON.stringify(config, null, 2));

    console.log('\n--- INSPECCIÓN FINALIZADA ---');
}

inspectDatabase();
