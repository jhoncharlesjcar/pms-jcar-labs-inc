import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsmuldqqxhirbshyogoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbXVsZHFxeGhpcmJzaHlvZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5ODQwMDEsImV4cCI6MjA5MjU2MDAwMX0.9g_0kZkcPqsUgmflK5CQpRsxrS3FBDXVkEKoIM4wuUY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAdmin() {
    const email = 'hospedajeangelicafrey@gmail.com';
    console.log(`--- INSPECCIONANDO ADMIN: ${email} ---`);

    // 1. Ver en tabla usuarios
    const { data: usuario, error: errU } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email);

    if (errU) {
        console.error('Error buscando en tabla usuarios:', errU.message);
    } else {
        console.log('Usuarios encontrados en tabla public.usuarios:', usuario);
    }

    // 2. Ver hoteles disponibles
    const { data: hoteles, error: errH } = await supabase
        .from('hoteles')
        .select('*');

    if (errH) {
        console.error('Error listando hoteles:', errH.message);
    } else {
        console.log(`Hoteles encontrados: ${hoteles?.length || 0}`);
        hoteles?.forEach(h => console.log(`- [${h.id}] ${h.nombre} (Activo: ${h.activo})`));
    }
}

inspectAdmin();
