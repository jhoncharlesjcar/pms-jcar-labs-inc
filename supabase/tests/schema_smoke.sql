begin;
select plan(12);

select has_table('public', 'hoteles', 'hoteles existe');
select has_table('public', 'usuarios', 'usuarios existe');
select has_table('public', 'habitaciones', 'habitaciones existe');
select has_table('public', 'reservas', 'reservas existe');
select has_table('public', 'ventas', 'ventas existe');
select has_table('public', 'ai_conversations', 'conversaciones AI existen');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.usuarios'::regclass),
  'usuarios tiene RLS habilitado'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.reservas'::regclass),
  'reservas tiene RLS habilitado'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.ventas'::regclass),
  'ventas tiene RLS habilitado'
);

select has_function('public', 'ai_search_availability_v2', 'disponibilidad AI se resuelve en servidor');
select has_function('public', 'checkout_reserva_atomic', 'checkout atómico existe');
select has_function('public', 'create_public_booking_checkout', 'booking público usa checkout controlado');

select * from finish();
rollback;
