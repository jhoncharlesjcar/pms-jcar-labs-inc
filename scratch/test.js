import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://nwprnycqplnmztpjicea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53cHJueWNxcGxubXp0cGppY2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTY0NjgsImV4cCI6MjA5NDk5MjQ2OH0.lipHJEE3oJp9jJgjb7sH_Dq5t8Xv5GdAXXM2bd917Jg'
);

async function run() {
  const { data, error } = await supabase.from('reservas').select('*').limit(5);
  console.log(JSON.stringify(data, null, 2));
}

run();
