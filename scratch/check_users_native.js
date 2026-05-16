
const url = 'https://jsmuldqqxhirbshyogoj.supabase.co/rest/v1/usuarios?select=*';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzbXVsZHFxeGhpcmJzaHlvZ29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5ODQwMDEsImV4cCI6MjA5MjU2MDAwMX0.9g_0kZkcPqsUgmflK5CQpRsxrS3FBDXVkEKoIM4wuUY';

async function check() {
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': apikey,
                'Authorization': `Bearer ${apikey}`
            }
        });
        const data = await res.json();
        console.log('--- RESPUESTA DB ---');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}
check();
