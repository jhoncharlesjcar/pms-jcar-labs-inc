import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
    const { data: hotels } = await supabase.from('hoteles').select('id, nombre');
    console.log('--- HOTELES ---');
    console.table(hotels);

    const { data: rooms } = await supabase.from('habitaciones').select('id, numero, hotel_id, estado');
    console.log('\n--- HABITACIONES ---');
    console.table(rooms);
}

inspect();
