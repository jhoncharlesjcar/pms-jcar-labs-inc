import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectAdmin() {
    const email = 'hospedajeangelicafrey@gmail.com';
    console.log(`--- INSPECCIONANDO ADMIN: ${email} ---`);

    // 1. Ver en tabla usuarios
    const { data: usuario, error: errU } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .single();

    if (errU) {
        console.error('Error buscando en tabla usuarios:', errU.message);
    } else {
        console.log('Usuario en tabla public.usuarios:', usuario);
    }

    // 2. Ver hoteles disponibles
    const { data: hoteles, error: errH } = await supabase
        .from('hoteles')
        .select('*');

    if (errH) {
        console.error('Error listando hoteles:', errH.message);
    } else {
        console.log(`Hoteles encontrados: ${hoteles.length}`);
        hoteles.forEach(h => console.log(`- [${h.id}] ${h.nombre} (Activo: ${h.activo})`));
    }

    // 3. Ver si hay desajuste
    if (usuario && hoteles.length > 0) {
        const hotelAsignado = hoteles.find(h => h.id === usuario.hotel_id);
        if (!hotelAsignado) {
            console.warn('¡ALERTA! El usuario tiene un hotel_id que NO existe en la tabla hoteles.');
        } else {
            console.log('Vinculación correcta: el hotel asignado existe.');
        }
    }
}

inspectAdmin();
