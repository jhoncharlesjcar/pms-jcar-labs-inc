-- Opaque guest links and database-level reservation overlap protection.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reservas'::regclass
      AND conname = 'reservas_no_room_overlap'
  ) THEN
    ALTER TABLE public.reservas ADD CONSTRAINT reservas_no_room_overlap
      EXCLUDE USING gist (
        habitacion_id WITH =,
        daterange(fecha_entrada, fecha_salida, '[)') WITH &&
      ) WHERE (estado IN ('pendiente', 'activa'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.guest_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  reservation_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('portal', 'checkin')),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_access_tokens_reservation
  ON public.guest_access_tokens(reservation_id, scope);
ALTER TABLE public.guest_access_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_access_tokens FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.checkins_publicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL UNIQUE REFERENCES public.reservas(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo_documento text NOT NULL CHECK (tipo_documento IN ('DNI', 'Pasaporte', 'CE')),
  documento text NOT NULL,
  telefono text NOT NULL,
  email text,
  observaciones text,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'validado', 'rechazado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checkins_publicos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checkins_publicos FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "checkins_staff_select" ON public.checkins_publicos;
CREATE POLICY "checkins_staff_select" ON public.checkins_publicos
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

DROP POLICY IF EXISTS "checkins_staff_update" ON public.checkins_publicos;
CREATE POLICY "checkins_staff_update" ON public.checkins_publicos
  FOR UPDATE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );
GRANT SELECT, UPDATE ON public.checkins_publicos TO authenticated;
