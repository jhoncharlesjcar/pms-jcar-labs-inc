import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsmuldqqxhirbshyogoj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbXVsZHFxeGhpcmJzaHlvZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5ODQwMDEsImV4cCI6MjA5MjU2MDAwMX0.9g_0kZkcPqsUgmflK5CQpRsxrS3FBDXVkEKoIM4wuUY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function repairAdmin() {
    const email = 'hospedajeangelicafrey@gmail.com';
    console.log(`--- INICIANDO REPARACIÓN PROFESIONAL DE ADMIN: ${email} ---`);

    try {
        // 1. Obtener el ID del usuario desde auth (si es posible con anon key, si no, lo buscamos en usuarios)
        // Nota: Con anon key no podemos listar auth.users, pero podemos intentar insertar en usuarios.
        
        // Buscamos si ya existe un hotel
        const { data: hoteles } = await supabase.from('hoteles').select('*').limit(1);
        let hotelId;

        if (!hoteles || hoteles.length === 0) {
            console.log('Creando hotel base...');
            const { data: nuevoHotel, error: errH } = await supabase.from('hoteles').insert({
                nombre: 'HOSPEDAJE ANGELICA FREY',
                direccion: 'Dirección por definir',
                telefono: '000000000',
                activo: true
            }).select().single();
            
            if (errH) throw new Error('No se pudo crear el hotel: ' + errH.message);
            hotelId = nuevoHotel.id;
            console.log('Hotel creado con ID:', hotelId);
        } else {
            hotelId = hoteles[0].id;
            console.log('Usando hotel existente ID:', hotelId);
        }

        // 2. Intentar registrar al usuario en la tabla pública
        // Como no tenemos el UUID del auth.user aquí (el script corre fuera del navegador),
        // el usuario debe loguearse en la app para que el trigger handle_new_user o el código de login haga el upsert.
        
        // SIN EMBARGO, para arreglarlo YA, vamos a intentar insertar un registro con el email.
        // Pero la tabla usuarios suele tener 'id' como UUID FK a auth.users.
        
        console.log('\n--- ACCIÓN RECOMENDADA ---');
        console.log('1. Ingresa a tu Dashboard de Supabase -> SQL Editor.');
        console.log('2. Pega y ejecuta el siguiente código para forzar tu registro:');
        console.log(`
DO $$ 
DECLARE 
    target_id UUID;
BEGIN
    SELECT id INTO target_id FROM auth.users WHERE email = '${email}';
    
    IF target_id IS NOT NULL THEN
        INSERT INTO public.usuarios (id, email, full_name, role, hotel_id)
        VALUES (target_id, '${email}', 'Administrador Principal', 'admin', '${hotelId}')
        ON CONFLICT (id) DO UPDATE SET 
            role = 'admin',
            hotel_id = '${hotelId}';
        RAISE NOTICE 'Usuario vinculado correctamente.';
    ELSE
        RAISE NOTICE 'No se encontró el usuario en auth.users. Asegúrate de haberte registrado primero.';
    END IF;
END $$;
        `);

    } catch (err) {
        console.error('Error crítico en reparación:', err.message);
    }
}

repairAdmin();
