
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function diagnostic() {
    console.log('--- DIAGNÓSTICO DE USUARIOS ---')
    
    // 1. Ver todos los usuarios registrados
    const { data: users, error } = await supabase
        .from('usuarios')
        .select('*')
    
    if (error) {
        console.error('Error al leer tabla usuarios:', error)
        return
    }

    console.log('Usuarios encontrados en la tabla:', users.length)
    users.forEach(u => {
        console.log(`- [${u.role}] ${u.email} (ID: ${u.id}) - Hotel ID: ${u.hotel_id}`)
    })

    console.log('\n--- VERIFICACIÓN DE SEGURIDAD ---')
    // Ver si la RLS está molestando
    const { data: test, error: err2 } = await supabase.from('hoteles').select('count')
    console.log('Prueba de lectura hoteles:', err2 ? 'BLOQUEADO' : 'OK')
}

diagnostic()
