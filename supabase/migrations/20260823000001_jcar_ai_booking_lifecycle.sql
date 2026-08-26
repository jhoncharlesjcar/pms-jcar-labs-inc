-- ============================================================
-- JCAR AI MULTICHANNEL BOOKING LIFECYCLE
-- Intention -> quote -> hold -> payment -> confirmed reservation
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Repair the dynamic-rate contract used by the existing configuration UI.
ALTER TABLE public.tarifas_dinamicas
  ADD COLUMN IF NOT EXISTS habitacion_tipo text DEFAULT 'todos';

ALTER TABLE public.tarifas_dinamicas
  DROP CONSTRAINT IF EXISTS tarifas_dinamicas_tipo_check;
ALTER TABLE public.tarifas_dinamicas
  ADD CONSTRAINT tarifas_dinamicas_tipo_check
  CHECK (tipo IN ('temporada', 'dia_semana', 'ocupacion'));

-- Configurable commercial rules. Secrets remain outside this table.
ALTER TABLE public.ai_hotel_config
  ADD COLUMN IF NOT EXISTS quote_validity_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS hold_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS deposit_value numeric(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS abandoned_followup_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS reception_agent_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.ai_hotel_config
  DROP CONSTRAINT IF EXISTS ai_hotel_config_quote_validity_check,
  DROP CONSTRAINT IF EXISTS ai_hotel_config_hold_minutes_check,
  DROP CONSTRAINT IF EXISTS ai_hotel_config_deposit_type_check,
  DROP CONSTRAINT IF EXISTS ai_hotel_config_deposit_value_check,
  DROP CONSTRAINT IF EXISTS ai_hotel_config_discount_check;

ALTER TABLE public.ai_hotel_config
  ADD CONSTRAINT ai_hotel_config_quote_validity_check CHECK (quote_validity_minutes BETWEEN 5 AND 1440),
  ADD CONSTRAINT ai_hotel_config_hold_minutes_check CHECK (hold_minutes BETWEEN 5 AND 120),
  ADD CONSTRAINT ai_hotel_config_deposit_type_check CHECK (deposit_type IN ('full', 'percentage', 'fixed')),
  ADD CONSTRAINT ai_hotel_config_deposit_value_check CHECK (deposit_value >= 0),
  ADD CONSTRAINT ai_hotel_config_discount_check CHECK (max_discount_percent BETWEEN 0 AND 100);

-- The same conversation engine serves every supported channel.
ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_channel_check,
  DROP CONSTRAINT IF EXISTS ai_conversations_status_check;

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS external_account_id text,
  ADD COLUMN IF NOT EXISTS external_contact_id text,
  ADD COLUMN IF NOT EXISTS journey_stage text NOT NULL DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS human_controlled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_outbound_at timestamptz;

ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_channel_check
    CHECK (channel IN ('web', 'whatsapp', 'instagram', 'facebook', 'guest_portal', 'manual')),
  ADD CONSTRAINT ai_conversations_status_check
    CHECK (status IN ('active', 'quoted', 'payment_pending', 'booked', 'handed_off', 'abandoned', 'closed')),
  ADD CONSTRAINT ai_conversations_journey_stage_check
    CHECK (journey_stage IN (
      'lead', 'qualified', 'availability_checked', 'quote_created', 'quote_accepted',
      'guest_data_pending', 'reservation_hold', 'payment_pending', 'payment_under_review',
      'payment_verified', 'reservation_confirmed', 'pre_checkin', 'arrival', 'stay',
      'checkout', 'post_stay', 'rebooking', 'handed_off', 'closed'
    ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_conversation_external_contact
  ON public.ai_conversations(hotel_id, channel, external_account_id, external_contact_id)
  WHERE external_account_id IS NOT NULL AND external_contact_id IS NOT NULL
    AND status NOT IN ('closed', 'abandoned');

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS external_message_id text,
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS error_code text;

ALTER TABLE public.ai_messages
  ADD CONSTRAINT ai_messages_direction_check
    CHECK (direction IN ('inbound', 'outbound', 'internal')),
  ADD CONSTRAINT ai_messages_delivery_status_check
    CHECK (delivery_status IN ('received', 'queued', 'processing', 'delayed', 'sent', 'delivered', 'read', 'failed', 'cancelled'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_messages_external
  ON public.ai_messages(hotel_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

-- Channel records contain public identifiers and operational state only.
-- Provider credentials must be stored in private.hotel_secrets or an external vault.
CREATE TABLE public.ai_channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('web', 'whatsapp', 'instagram', 'facebook', 'guest_portal')),
  name text NOT NULL,
  external_account_id text,
  status text NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'degraded', 'disconnected', 'paused')),
  enabled boolean NOT NULL DEFAULT false,
  response_delay_seconds integer NOT NULL DEFAULT 0 CHECK (response_delay_seconds BETWEEN 0 AND 120),
  max_concurrent_messages integer NOT NULL DEFAULT 1 CHECK (max_concurrent_messages BETWEEN 1 AND 50),
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_healthcheck_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, channel, external_account_id)
);

CREATE TABLE public.ai_channel_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('web', 'whatsapp', 'instagram', 'facebook', 'guest_portal')),
  external_contact_id text NOT NULL,
  guest_name text,
  guest_phone text,
  guest_email text,
  consent_status text NOT NULL DEFAULT 'unknown'
    CHECK (consent_status IN ('unknown', 'opted_in', 'opted_out')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, channel, external_contact_id)
);

CREATE TABLE public.ai_booking_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'qualified' CHECK (status IN (
    'qualified', 'quote_created', 'quote_accepted', 'guest_data_pending',
    'hold_active', 'payment_pending', 'confirmed', 'abandoned', 'cancelled'
  )),
  fecha_entrada date NOT NULL,
  fecha_salida date NOT NULL,
  adultos integer NOT NULL DEFAULT 1 CHECK (adultos BETWEEN 1 AND 20),
  ninos integer NOT NULL DEFAULT 0 CHECK (ninos BETWEEN 0 AND 20),
  selected_room_id uuid REFERENCES public.habitaciones(id),
  guest_name text,
  guest_phone text,
  guest_email text,
  guest_document text,
  guest_document_type text DEFAULT 'DNI',
  source_channel text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_salida > fecha_entrada)
);

ALTER TABLE public.ai_quotes
  ADD COLUMN IF NOT EXISTS quote_number text,
  ADD COLUMN IF NOT EXISTS booking_intent_id uuid REFERENCES public.ai_booking_intents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS price_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deposit_required numeric(12,2),
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_quotes_number
  ON public.ai_quotes(hotel_id, quote_number) WHERE quote_number IS NOT NULL;

CREATE TABLE public.ai_reservation_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  booking_intent_id uuid NOT NULL REFERENCES public.ai_booking_intents(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.ai_quotes(id) ON DELETE RESTRICT,
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id) ON DELETE RESTRICT,
  fecha_entrada date NOT NULL,
  fecha_salida date NOT NULL,
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  guest_email text,
  guest_document text NOT NULL,
  guest_document_type text NOT NULL DEFAULT 'DNI',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'payment_pending', 'converted', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  reservation_id uuid REFERENCES public.reservas(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_salida > fecha_entrada)
);

ALTER TABLE public.ai_reservation_holds
  ADD CONSTRAINT uq_ai_holds_no_overlap
  EXCLUDE USING gist (
    hotel_id WITH =,
    habitacion_id WITH =,
    daterange(fecha_entrada, fecha_salida, '[)') WITH &&
  ) WHERE (status IN ('active', 'payment_pending'));

CREATE UNIQUE INDEX uq_ai_active_hold_quote
  ON public.ai_reservation_holds(quote_id)
  WHERE status IN ('active', 'payment_pending');

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS ai_hold_id uuid REFERENCES public.ai_reservation_holds(id),
  ADD COLUMN IF NOT EXISTS num_adultos integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS num_ninos integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reservas_ai_hold
  ON public.reservas(ai_hold_id) WHERE ai_hold_id IS NOT NULL;

CREATE TABLE public.ai_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  booking_intent_id uuid NOT NULL REFERENCES public.ai_booking_intents(id) ON DELETE CASCADE,
  hold_id uuid NOT NULL REFERENCES public.ai_reservation_holds(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES public.ai_quotes(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  method text NOT NULL CHECK (method IN ('gateway', 'yape', 'plin', 'transferencia', 'tarjeta', 'efectivo')),
  provider_reference text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('created', 'pending', 'awaiting_manual_review', 'paid', 'failed', 'expired', 'cancelled', 'refunded')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'PEN' CHECK (currency ~ '^[A-Z]{3}$'),
  instructions jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  reservation_id uuid REFERENCES public.reservas(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, idempotency_key)
);

CREATE TABLE public.ai_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  payment_intent_id uuid NOT NULL REFERENCES public.ai_payment_intents(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  amount numeric(12,2),
  currency text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE public.ai_domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'published', 'failed')),
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_intents_conversation ON public.ai_booking_intents(conversation_id, created_at DESC);
CREATE INDEX idx_ai_holds_expiration ON public.ai_reservation_holds(status, expires_at);
CREATE INDEX idx_ai_payments_hold ON public.ai_payment_intents(hold_id, status);
CREATE INDEX idx_ai_domain_events_pending ON public.ai_domain_events(status, available_at);

ALTER TABLE public.ai_channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_channel_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_booking_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reservation_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_domain_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_channel_connections_staff ON public.ai_channel_connections FOR ALL TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()))
  WITH CHECK (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_channel_contacts_staff ON public.ai_channel_contacts FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_booking_intents_staff ON public.ai_booking_intents FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_holds_staff ON public.ai_reservation_holds FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_payments_staff ON public.ai_payment_intents FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_payment_events_staff ON public.ai_payment_events FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_domain_events_staff ON public.ai_domain_events FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));

-- Server-side pricing is the only source for quotes used by the agent.
CREATE OR REPLACE FUNCTION public.ai_calculate_room_quote(
  p_hotel_id uuid,
  p_habitacion_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_room public.habitaciones%ROWTYPE;
  v_day date;
  v_factor numeric;
  v_rate numeric;
  v_total numeric := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_total_rooms integer;
  v_occupied integer;
  v_occupancy integer;
BEGIN
  IF p_fecha_entrada < current_date OR p_fecha_salida <= p_fecha_entrada
     OR p_fecha_salida - p_fecha_entrada > 30 THEN
    RAISE EXCEPTION 'invalid stay date range';
  END IF;

  SELECT * INTO v_room FROM public.habitaciones
  WHERE id = p_habitacion_id AND hotel_id = p_hotel_id AND estado <> 'mantenimiento';
  IF NOT FOUND THEN RAISE EXCEPTION 'room is not available for quoting'; END IF;

  SELECT count(*) INTO v_total_rooms FROM public.habitaciones
  WHERE hotel_id = p_hotel_id AND estado <> 'mantenimiento';

  FOR v_day IN SELECT generate_series(p_fecha_entrada, p_fecha_salida - 1, interval '1 day')::date LOOP
    SELECT count(DISTINCT r.habitacion_id) INTO v_occupied
    FROM public.reservas r
    WHERE r.hotel_id = p_hotel_id
      AND r.estado IN ('pendiente', 'confirmada', 'activa')
      AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(v_day, v_day + 1, '[)');
    v_occupancy := CASE WHEN v_total_rooms = 0 THEN 0 ELSE round((v_occupied::numeric / v_total_rooms) * 100) END;

    SELECT COALESCE(max(t.factor_ajuste), 1) INTO v_factor
    FROM public.tarifas_dinamicas t
    WHERE t.hotel_id = p_hotel_id AND t.activo = true
      AND COALESCE(t.habitacion_tipo, 'todos') IN ('todos', v_room.tipo)
      AND (
        (t.tipo = 'temporada' AND v_day BETWEEN t.fecha_inicio AND t.fecha_fin)
        OR (t.tipo = 'dia_semana' AND t.dia_semana = extract(dow from v_day)::integer)
        OR (t.tipo = 'ocupacion' AND v_occupancy >= COALESCE(t.umbral_ocupacion_min, 101))
      );

    v_rate := round(v_room.precio_noche * v_factor, 2);
    v_total := v_total + v_rate;
    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'date', v_day, 'base_rate', v_room.precio_noche, 'factor', v_factor,
      'nightly_rate', v_rate, 'occupancy_percent', v_occupancy
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'habitacion_id', v_room.id, 'room_number', v_room.numero, 'room_type', v_room.tipo,
    'description', v_room.descripcion, 'amenities', v_room.amenidades,
    'capacity', v_room.capacidad, 'nights', p_fecha_salida - p_fecha_entrada,
    'nightly_rate', round(v_total / (p_fecha_salida - p_fecha_entrada), 2),
    'total', round(v_total, 2), 'currency', 'PEN', 'breakdown', v_breakdown
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_search_availability_v2(
  p_hotel_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_adultos integer DEFAULT 1,
  p_ninos integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_room record;
  v_rooms jsonb := '[]'::jsonb;
BEGIN
  IF p_adultos < 1 OR p_ninos < 0 OR p_adultos + p_ninos > 20 THEN
    RAISE EXCEPTION 'invalid occupancy';
  END IF;
  IF p_fecha_entrada < current_date OR p_fecha_salida <= p_fecha_entrada
     OR p_fecha_salida - p_fecha_entrada > 30 THEN
    RAISE EXCEPTION 'invalid stay date range';
  END IF;

  FOR v_room IN
    SELECT h.id FROM public.habitaciones h
    WHERE h.hotel_id = p_hotel_id AND h.estado <> 'mantenimiento'
      AND h.capacidad >= p_adultos + p_ninos
      AND NOT EXISTS (
        SELECT 1 FROM public.reservas r
        WHERE r.hotel_id = p_hotel_id AND r.habitacion_id = h.id
          AND r.estado IN ('pendiente', 'confirmada', 'activa')
          AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(p_fecha_entrada, p_fecha_salida, '[)')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ai_reservation_holds ah
        WHERE ah.hotel_id = p_hotel_id AND ah.habitacion_id = h.id
          AND ah.status IN ('active', 'payment_pending') AND ah.expires_at > now()
          AND daterange(ah.fecha_entrada, ah.fecha_salida, '[)') && daterange(p_fecha_entrada, p_fecha_salida, '[)')
      )
    ORDER BY h.precio_noche, h.numero
  LOOP
    v_rooms := v_rooms || jsonb_build_array(public.ai_calculate_room_quote(
      p_hotel_id, v_room.id, p_fecha_entrada, p_fecha_salida
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'available', jsonb_array_length(v_rooms) > 0,
    'rooms', v_rooms,
    'dates', jsonb_build_object('check_in', p_fecha_entrada, 'check_out', p_fecha_salida,
      'nights', p_fecha_salida - p_fecha_entrada),
    'occupancy', jsonb_build_object('adults', p_adultos, 'children', p_ninos)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_create_verified_quote(
  p_hotel_id uuid,
  p_conversation_id uuid,
  p_habitacion_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_adultos integer DEFAULT 1,
  p_ninos integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_conversation public.ai_conversations%ROWTYPE;
  v_config public.ai_hotel_config%ROWTYPE;
  v_price jsonb;
  v_intent public.ai_booking_intents%ROWTYPE;
  v_quote public.ai_quotes%ROWTYPE;
BEGIN
  SELECT * INTO v_conversation FROM public.ai_conversations
  WHERE id = p_conversation_id AND hotel_id = p_hotel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'conversation not found'; END IF;
  IF v_conversation.human_controlled OR v_conversation.status IN ('handed_off', 'closed') THEN
    RAISE EXCEPTION 'conversation is controlled by staff';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservas r WHERE r.hotel_id = p_hotel_id AND r.habitacion_id = p_habitacion_id
      AND r.estado IN ('pendiente', 'confirmada', 'activa')
      AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(p_fecha_entrada, p_fecha_salida, '[)')
  ) OR EXISTS (
    SELECT 1 FROM public.ai_reservation_holds h WHERE h.hotel_id = p_hotel_id AND h.habitacion_id = p_habitacion_id
      AND h.status IN ('active', 'payment_pending') AND h.expires_at > now()
      AND daterange(h.fecha_entrada, h.fecha_salida, '[)') && daterange(p_fecha_entrada, p_fecha_salida, '[)')
  ) THEN RAISE EXCEPTION 'room is no longer available'; END IF;

  SELECT * INTO v_config FROM public.ai_hotel_config WHERE hotel_id = p_hotel_id;
  v_price := public.ai_calculate_room_quote(p_hotel_id, p_habitacion_id, p_fecha_entrada, p_fecha_salida);

  INSERT INTO public.ai_booking_intents(
    hotel_id, conversation_id, status, fecha_entrada, fecha_salida,
    adultos, ninos, selected_room_id, source_channel
  ) VALUES (
    p_hotel_id, p_conversation_id, 'quote_created', p_fecha_entrada, p_fecha_salida,
    p_adultos, p_ninos, p_habitacion_id, v_conversation.channel
  ) RETURNING * INTO v_intent;

  INSERT INTO public.ai_quotes(
    hotel_id, conversation_id, booking_intent_id, quote_number, room_type, habitacion_id,
    fecha_entrada, fecha_salida, noches, adultos, ninos, precio_noche, total,
    currency, status, expires_at, price_breakdown
  ) VALUES (
    p_hotel_id, p_conversation_id, v_intent.id,
    'Q-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_price->>'room_type', p_habitacion_id, p_fecha_entrada, p_fecha_salida,
    (v_price->>'nights')::integer, p_adultos, p_ninos,
    (v_price->>'nightly_rate')::numeric, (v_price->>'total')::numeric,
    'PEN', 'pending', now() + make_interval(mins => COALESCE(v_config.quote_validity_minutes, 30)),
    v_price->'breakdown'
  ) RETURNING * INTO v_quote;

  UPDATE public.ai_conversations SET status = 'quoted', journey_stage = 'quote_created', updated_at = now()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object('success', true, 'quote', to_jsonb(v_quote));
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_accept_quote_and_create_hold(
  p_hotel_id uuid,
  p_conversation_id uuid,
  p_quote_id uuid,
  p_guest_name text,
  p_guest_phone text,
  p_guest_document text,
  p_guest_email text DEFAULT NULL,
  p_guest_document_type text DEFAULT 'DNI'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_quote public.ai_quotes%ROWTYPE;
  v_intent public.ai_booking_intents%ROWTYPE;
  v_config public.ai_hotel_config%ROWTYPE;
  v_hold public.ai_reservation_holds%ROWTYPE;
BEGIN
  IF length(btrim(COALESCE(p_guest_name, ''))) < 3 OR length(btrim(COALESCE(p_guest_phone, ''))) < 6
     OR length(btrim(COALESCE(p_guest_document, ''))) < 4 THEN
    RAISE EXCEPTION 'guest name, phone and document are required';
  END IF;

  SELECT * INTO v_quote FROM public.ai_quotes
  WHERE id = p_quote_id AND hotel_id = p_hotel_id AND conversation_id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote not found'; END IF;

  SELECT * INTO v_hold FROM public.ai_reservation_holds
  WHERE quote_id = p_quote_id AND status IN ('active', 'payment_pending');
  IF FOUND THEN RETURN jsonb_build_object('success', true, 'hold', to_jsonb(v_hold), 'idempotent', true); END IF;

  IF v_quote.status <> 'pending' OR v_quote.expires_at <= now() THEN
    UPDATE public.ai_quotes SET status = 'expired' WHERE id = p_quote_id AND expires_at <= now();
    RAISE EXCEPTION 'quote is no longer active';
  END IF;

  PERFORM 1 FROM public.habitaciones
  WHERE id = v_quote.habitacion_id AND hotel_id = p_hotel_id AND estado <> 'mantenimiento' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room not found'; END IF;

  -- Keep the exclusion constraint independent from cron timing.
  UPDATE public.ai_reservation_holds SET status = 'expired', updated_at = now()
  WHERE hotel_id = p_hotel_id AND habitacion_id = v_quote.habitacion_id
    AND status IN ('active', 'payment_pending') AND expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM public.reservas r WHERE r.hotel_id = p_hotel_id AND r.habitacion_id = v_quote.habitacion_id
      AND r.estado IN ('pendiente', 'confirmada', 'activa')
      AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(v_quote.fecha_entrada, v_quote.fecha_salida, '[)')
  ) OR EXISTS (
    SELECT 1 FROM public.ai_reservation_holds h WHERE h.hotel_id = p_hotel_id AND h.habitacion_id = v_quote.habitacion_id
      AND h.status IN ('active', 'payment_pending') AND h.expires_at > now()
      AND daterange(h.fecha_entrada, h.fecha_salida, '[)') && daterange(v_quote.fecha_entrada, v_quote.fecha_salida, '[)')
  ) THEN RAISE EXCEPTION 'room is no longer available'; END IF;

  SELECT * INTO v_config FROM public.ai_hotel_config WHERE hotel_id = p_hotel_id;
  SELECT * INTO v_intent FROM public.ai_booking_intents WHERE id = v_quote.booking_intent_id FOR UPDATE;

  INSERT INTO public.ai_reservation_holds(
    hotel_id, conversation_id, booking_intent_id, quote_id, habitacion_id,
    fecha_entrada, fecha_salida, guest_name, guest_phone, guest_email,
    guest_document, guest_document_type, expires_at
  ) VALUES (
    p_hotel_id, p_conversation_id, v_intent.id, v_quote.id, v_quote.habitacion_id,
    v_quote.fecha_entrada, v_quote.fecha_salida, btrim(p_guest_name), btrim(p_guest_phone),
    NULLIF(btrim(COALESCE(p_guest_email, '')), ''), btrim(p_guest_document), p_guest_document_type,
    now() + make_interval(mins => COALESCE(v_config.hold_minutes, 15))
  ) RETURNING * INTO v_hold;

  UPDATE public.ai_quotes SET status = 'accepted', accepted_at = now() WHERE id = v_quote.id;
  UPDATE public.ai_booking_intents SET status = 'hold_active', guest_name = v_hold.guest_name,
    guest_phone = v_hold.guest_phone, guest_email = v_hold.guest_email,
    guest_document = v_hold.guest_document, guest_document_type = v_hold.guest_document_type,
    updated_at = now() WHERE id = v_intent.id;
  UPDATE public.ai_conversations SET journey_stage = 'reservation_hold', guest_name = v_hold.guest_name,
    guest_phone = v_hold.guest_phone, guest_email = v_hold.guest_email, updated_at = now()
    WHERE id = p_conversation_id;

  INSERT INTO public.ai_domain_events(hotel_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (p_hotel_id, 'reservation_hold', v_hold.id, 'reservation_hold.created',
    jsonb_build_object('conversation_id', p_conversation_id, 'expires_at', v_hold.expires_at));

  RETURN jsonb_build_object('success', true, 'hold', to_jsonb(v_hold),
    'quote_total', v_quote.total, 'currency', v_quote.currency);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_create_payment_request(
  p_hotel_id uuid,
  p_conversation_id uuid,
  p_hold_id uuid,
  p_method text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_hold public.ai_reservation_holds%ROWTYPE;
  v_quote public.ai_quotes%ROWTYPE;
  v_config public.ai_hotel_config%ROWTYPE;
  v_hotel public.hoteles%ROWTYPE;
  v_payment public.ai_payment_intents%ROWTYPE;
  v_amount numeric;
  v_provider text;
  v_instructions jsonb;
BEGIN
  IF p_method NOT IN ('gateway', 'yape', 'plin', 'transferencia', 'tarjeta', 'efectivo') THEN
    RAISE EXCEPTION 'unsupported payment method';
  END IF;

  SELECT * INTO v_hold FROM public.ai_reservation_holds
  WHERE id = p_hold_id AND hotel_id = p_hotel_id AND conversation_id = p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'hold not found'; END IF;

  SELECT * INTO v_payment FROM public.ai_payment_intents
  WHERE hold_id = p_hold_id AND status IN ('created', 'pending', 'awaiting_manual_review');
  IF FOUND THEN RETURN jsonb_build_object('success', true, 'payment', to_jsonb(v_payment), 'idempotent', true); END IF;

  IF v_hold.status <> 'active' OR v_hold.expires_at <= now() THEN
    UPDATE public.ai_reservation_holds SET status = 'expired', updated_at = now()
    WHERE id = v_hold.id AND expires_at <= now();
    RAISE EXCEPTION 'hold is no longer active';
  END IF;

  SELECT * INTO v_quote FROM public.ai_quotes WHERE id = v_hold.quote_id;
  SELECT * INTO v_config FROM public.ai_hotel_config WHERE hotel_id = p_hotel_id;
  SELECT * INTO v_hotel FROM public.hoteles WHERE id = p_hotel_id;

  v_amount := CASE v_config.deposit_type
    WHEN 'percentage' THEN round(v_quote.total * v_config.deposit_value / 100, 2)
    WHEN 'fixed' THEN least(v_quote.total, v_config.deposit_value)
    ELSE v_quote.total
  END;
  IF v_amount <= 0 THEN v_amount := v_quote.total; END IF;

  v_provider := CASE WHEN p_method = 'gateway' THEN COALESCE(v_hotel.pasarela_activa, 'unconfigured') ELSE 'manual' END;
  IF p_method = 'gateway' AND COALESCE(v_hotel.modo_automatico, false) = false THEN
    RAISE EXCEPTION 'automatic payment gateway is disabled';
  END IF;

  v_instructions := COALESCE(v_config.payment_instructions, '{}'::jsonb) || jsonb_build_object(
    'method', p_method, 'qr_url', CASE p_method WHEN 'yape' THEN v_hotel.qr_yape_url WHEN 'plin' THEN v_hotel.qr_plin_url ELSE NULL END,
    'phone', CASE WHEN p_method = 'yape' THEN v_hotel.numero_yape ELSE NULL END
  );

  INSERT INTO public.ai_payment_intents(
    hotel_id, conversation_id, booking_intent_id, hold_id, quote_id, provider,
    method, status, amount, currency, instructions, idempotency_key, expires_at
  ) VALUES (
    p_hotel_id, p_conversation_id, v_hold.booking_intent_id, v_hold.id, v_hold.quote_id,
    v_provider, p_method, CASE WHEN p_method = 'gateway' THEN 'created' ELSE 'pending' END,
    v_amount, v_quote.currency, v_instructions, v_hold.id::text || ':' || p_method, v_hold.expires_at
  ) RETURNING * INTO v_payment;

  UPDATE public.ai_reservation_holds SET status = 'payment_pending', updated_at = now() WHERE id = v_hold.id;
  UPDATE public.ai_booking_intents SET status = 'payment_pending', updated_at = now() WHERE id = v_hold.booking_intent_id;
  UPDATE public.ai_conversations SET status = 'payment_pending', journey_stage = 'payment_pending', updated_at = now()
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object('success', true, 'payment', to_jsonb(v_payment));
END;
$$;

-- Internal finalizer. It has no grants for API roles and can only be reached through verified flows.
CREATE OR REPLACE FUNCTION public.ai_finalize_paid_hold(p_payment_intent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_hold public.ai_reservation_holds%ROWTYPE;
  v_quote public.ai_quotes%ROWTYPE;
  v_room public.habitaciones%ROWTYPE;
  v_reservation public.reservas%ROWTYPE;
  v_portal_token text;
  v_checkin_token text;
  v_access_expires_at timestamptz;
  v_confirmation_message_id uuid;
BEGIN
  SELECT * INTO v_payment FROM public.ai_payment_intents WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_payment.status <> 'paid' THEN RAISE EXCEPTION 'payment is not paid'; END IF;
  IF v_payment.reservation_id IS NOT NULL THEN RETURN v_payment.reservation_id; END IF;

  SELECT * INTO v_hold FROM public.ai_reservation_holds WHERE id = v_payment.hold_id FOR UPDATE;
  IF NOT FOUND OR v_hold.status NOT IN ('active', 'payment_pending') OR v_hold.expires_at <= now() THEN
    RAISE EXCEPTION 'reservation hold expired before payment confirmation';
  END IF;
  SELECT * INTO v_quote FROM public.ai_quotes WHERE id = v_hold.quote_id FOR UPDATE;
  SELECT * INTO v_room FROM public.habitaciones WHERE id = v_hold.habitacion_id FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.reservas r WHERE r.hotel_id = v_hold.hotel_id AND r.habitacion_id = v_hold.habitacion_id
      AND r.estado IN ('pendiente', 'confirmada', 'activa')
      AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(v_hold.fecha_entrada, v_hold.fecha_salida, '[)')
  ) THEN RAISE EXCEPTION 'inventory conflict while confirming reservation'; END IF;

  UPDATE public.ai_reservation_holds SET status = 'converted', updated_at = now() WHERE id = v_hold.id;

  INSERT INTO public.reservas(
    hotel_id, habitacion_id, habitacion_numero, habitacion_tipo, numero_reserva,
    estado, huesped_nombre, huesped_dni, huesped_telefono, huesped_email, tipo_documento,
    fecha_entrada, fecha_salida, noches, precio_noche, total, origen, observaciones,
    estado_pago, payment_intent_id, payment_provider, payment_currency, payment_amount,
    ai_hold_id, num_adultos, num_ninos
  ) VALUES (
    v_hold.hotel_id, v_hold.habitacion_id, v_room.numero, v_room.tipo,
    'AI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    'confirmada', v_hold.guest_name, v_hold.guest_document, v_hold.guest_phone,
    v_hold.guest_email, v_hold.guest_document_type, v_hold.fecha_entrada, v_hold.fecha_salida,
    v_quote.noches, v_quote.precio_noche, v_quote.total, 'jcar_ai',
    'Reserva confirmada por el flujo transaccional de JcarAI',
    CASE WHEN v_payment.amount >= v_quote.total THEN 'pagado' ELSE 'adelanto_pagado' END, v_payment.id,
    v_payment.provider, v_payment.currency, v_payment.amount, v_hold.id,
    v_quote.adultos, v_quote.ninos
  ) RETURNING * INTO v_reservation;

  UPDATE public.habitaciones SET estado = 'reservada' WHERE id = v_room.id;
  UPDATE public.ai_reservation_holds SET reservation_id = v_reservation.id WHERE id = v_hold.id;
  UPDATE public.ai_payment_intents SET reservation_id = v_reservation.id, updated_at = now() WHERE id = v_payment.id;
  UPDATE public.ai_booking_intents SET status = 'confirmed', updated_at = now() WHERE id = v_hold.booking_intent_id;
  UPDATE public.ai_conversations SET status = 'booked', journey_stage = 'reservation_confirmed',
    reserva_id = v_reservation.id, updated_at = now() WHERE id = v_hold.conversation_id;

  v_portal_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_checkin_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_access_expires_at := v_reservation.fecha_salida + interval '1 day';
  INSERT INTO public.guest_access_tokens(reservation_id, token_hash, scope, expires_at)
  VALUES
    (v_reservation.id, encode(digest(v_portal_token, 'sha256'), 'hex'), 'portal', v_access_expires_at),
    (v_reservation.id, encode(digest(v_checkin_token, 'sha256'), 'hex'), 'checkin', v_access_expires_at);

  INSERT INTO public.ai_messages(
    conversation_id, hotel_id, role, content, direction, delivery_status
  ) VALUES (
    v_hold.conversation_id,
    v_hold.hotel_id,
    'assistant',
    format(
      '¡Listo! Tu reserva %s está confirmada para la habitación %s, del %s al %s. El pago fue verificado correctamente. Ya puedes continuar con tu pre check-in.',
      v_reservation.numero_reserva,
      v_reservation.habitacion_numero,
      to_char(v_reservation.fecha_entrada, 'DD/MM/YYYY'),
      to_char(v_reservation.fecha_salida, 'DD/MM/YYYY')
    ),
    'outbound',
    'queued'
  ) RETURNING id INTO v_confirmation_message_id;

  INSERT INTO public.ai_domain_events(hotel_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (v_hold.hotel_id, 'reservation', v_reservation.id, 'reservation.confirmed',
    jsonb_build_object('conversation_id', v_hold.conversation_id, 'payment_intent_id', v_payment.id,
      'reservation_number', v_reservation.numero_reserva, 'message_id', v_confirmation_message_id,
      'portal_token', v_portal_token,
      'checkin_token', v_checkin_token));

  RETURN v_reservation.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_process_payment_event(
  p_payment_intent_id uuid,
  p_event_id text,
  p_amount numeric,
  p_currency text,
  p_provider text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_existing public.ai_payment_events%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_payment FROM public.ai_payment_intents WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment intent not found'; END IF;

  SELECT * INTO v_existing FROM public.ai_payment_events
  WHERE provider = p_provider AND provider_event_id = p_event_id;
  IF FOUND THEN
    IF v_existing.payment_intent_id <> p_payment_intent_id THEN RAISE EXCEPTION 'payment event already used'; END IF;
    RETURN v_payment.reservation_id;
  END IF;

  IF v_payment.provider <> p_provider OR v_payment.currency <> upper(p_currency)
     OR v_payment.amount <> p_amount OR v_payment.status NOT IN ('created', 'pending') THEN
    RAISE EXCEPTION 'payment event does not match pending intent';
  END IF;

  INSERT INTO public.ai_payment_events(
    hotel_id, payment_intent_id, provider, provider_event_id, event_type, amount, currency, payload
  ) VALUES (
    v_payment.hotel_id, v_payment.id, p_provider, p_event_id, 'payment.succeeded',
    p_amount, upper(p_currency), COALESCE(p_payload, '{}'::jsonb)
  );
  UPDATE public.ai_payment_intents SET status = 'paid', paid_at = now(), verified_at = now(), updated_at = now()
  WHERE id = v_payment.id;
  RETURN public.ai_finalize_paid_hold(v_payment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_verify_manual_payment(
  p_payment_intent_id uuid,
  p_reference text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_role text := public.get_user_role();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active() OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO v_payment FROM public.ai_payment_intents WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider <> 'manual' OR v_payment.status NOT IN ('pending', 'awaiting_manual_review') THEN
    RAISE EXCEPTION 'manual payment is not pending review';
  END IF;
  IF v_role <> 'developer' AND v_payment.hotel_id <> public.get_user_hotel_id() THEN RAISE EXCEPTION 'hotel mismatch'; END IF;
  IF length(btrim(COALESCE(p_reference, ''))) < 3 THEN RAISE EXCEPTION 'payment reference is required'; END IF;

  INSERT INTO public.ai_payment_events(
    hotel_id, payment_intent_id, provider, provider_event_id, event_type, amount, currency, payload
  ) VALUES (
    v_payment.hotel_id, v_payment.id, 'manual', 'manual:' || v_payment.id::text,
    'payment.manually_verified', v_payment.amount, v_payment.currency,
    jsonb_build_object('reference', btrim(p_reference), 'verified_by', auth.uid())
  );
  UPDATE public.ai_payment_intents SET status = 'paid', provider_reference = btrim(p_reference),
    paid_at = now(), verified_at = now(), verified_by = auth.uid(), updated_at = now()
  WHERE id = v_payment.id;
  RETURN public.ai_finalize_paid_hold(v_payment.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_expire_booking_artifacts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_quotes integer;
  v_holds integer;
  v_payments integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  UPDATE public.ai_quotes SET status = 'expired' WHERE status = 'pending' AND expires_at <= now();
  GET DIAGNOSTICS v_quotes = ROW_COUNT;
  UPDATE public.ai_reservation_holds SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'payment_pending') AND expires_at <= now();
  GET DIAGNOSTICS v_holds = ROW_COUNT;
  UPDATE public.ai_payment_intents SET status = 'expired', updated_at = now()
  WHERE status IN ('created', 'pending', 'awaiting_manual_review') AND expires_at <= now();
  GET DIAGNOSTICS v_payments = ROW_COUNT;
  RETURN jsonb_build_object('quotes', v_quotes, 'holds', v_holds, 'payments', v_payments);
END;
$$;

-- External connectors poll this queue for asynchronous messages such as payment confirmations.
CREATE OR REPLACE FUNCTION public.ai_claim_channel_messages(
  p_hotel_id uuid,
  p_channel text,
  p_external_account_id text,
  p_limit integer DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_messages jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_channel NOT IN ('whatsapp', 'instagram', 'facebook', 'guest_portal') THEN
    RAISE EXCEPTION 'unsupported external channel';
  END IF;

  WITH candidates AS (
    SELECT m.id
    FROM public.ai_messages m
    JOIN public.ai_conversations c ON c.id = m.conversation_id
    WHERE m.hotel_id = p_hotel_id
      AND m.direction = 'outbound'
      AND m.delivery_status = 'queued'
      AND c.channel = p_channel
      AND c.external_account_id = p_external_account_id
    ORDER BY m.created_at
    FOR UPDATE OF m SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
  ), claimed AS (
    UPDATE public.ai_messages m
    SET delivery_status = 'processing'
    WHERE m.id IN (SELECT id FROM candidates)
    RETURNING m.id, m.conversation_id, m.content, m.created_at
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'message_id', cm.id,
        'conversation_id', cm.conversation_id,
        'external_contact_id', c.external_contact_id,
        'content', cm.content,
        'created_at', cm.created_at
      ) ORDER BY cm.created_at
    ),
    '[]'::jsonb
  ) INTO v_messages
  FROM claimed cm
  JOIN public.ai_conversations c ON c.id = cm.conversation_id;

  RETURN v_messages;
END;
$$;

-- Any reservation source must respect active JcarAI holds.
CREATE OR REPLACE FUNCTION public.enforce_ai_holds_on_reservation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.habitacion_id IS NULL OR NEW.estado NOT IN ('pendiente', 'confirmada', 'activa') THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.habitaciones WHERE id = NEW.habitacion_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.ai_reservation_holds h
    WHERE h.hotel_id = NEW.hotel_id AND h.habitacion_id = NEW.habitacion_id
      AND h.status IN ('active', 'payment_pending') AND h.expires_at > now()
      AND h.id IS DISTINCT FROM NEW.ai_hold_id
      AND daterange(h.fecha_entrada, h.fecha_salida, '[)') && daterange(NEW.fecha_entrada, NEW.fecha_salida, '[)')
  ) THEN RAISE EXCEPTION 'room is temporarily held by another booking process'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservas_respect_ai_holds ON public.reservas;
CREATE TRIGGER trg_reservas_respect_ai_holds
  BEFORE INSERT OR UPDATE OF hotel_id, habitacion_id, fecha_entrada, fecha_salida, estado
  ON public.reservas FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_holds_on_reservation();

-- Bridge the existing payment webhook to the new lifecycle while preserving legacy reservations.
CREATE OR REPLACE FUNCTION public.confirm_reservation_payment(
  p_payment_intent_id uuid,
  p_event_id text,
  p_amount numeric,
  p_currency text,
  p_provider text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF EXISTS (SELECT 1 FROM public.ai_payment_intents WHERE id = p_payment_intent_id) THEN
    RETURN public.ai_process_payment_event(
      p_payment_intent_id, p_event_id, p_amount, p_currency, p_provider, '{}'::jsonb
    );
  END IF;

  UPDATE public.reservas
  SET estado_pago = 'pagado', estado = CASE WHEN estado = 'pendiente' THEN 'confirmada' ELSE estado END,
      webhook_event_id = p_event_id, webhook_processed_at = now()
  WHERE payment_intent_id = p_payment_intent_id AND payment_provider = p_provider
    AND payment_currency = upper(p_currency) AND payment_amount = p_amount
    AND estado_pago = 'pendiente'
    AND NOT EXISTS (SELECT 1 FROM public.reservas r2 WHERE r2.webhook_event_id = p_event_id)
  RETURNING id INTO v_reserva_id;
  IF v_reserva_id IS NULL THEN RAISE EXCEPTION 'payment confirmation did not match a pending order'; END IF;
  RETURN v_reserva_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_calculate_room_quote(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_search_availability_v2(uuid, date, date, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_create_verified_quote(uuid, uuid, uuid, date, date, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_accept_quote_and_create_hold(uuid, uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_create_payment_request(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_finalize_paid_hold(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_process_payment_event(uuid, text, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_expire_booking_artifacts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_claim_channel_messages(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_verify_manual_payment(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ai_calculate_room_quote(uuid, uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_search_availability_v2(uuid, date, date, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_create_verified_quote(uuid, uuid, uuid, date, date, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_accept_quote_and_create_hold(uuid, uuid, uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_create_payment_request(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_process_payment_event(uuid, text, numeric, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_expire_booking_artifacts() TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_claim_channel_messages(uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_verify_manual_payment(uuid, text) TO authenticated;

-- The old anonymous mutation path must no longer be available.
REVOKE ALL ON FUNCTION public.ai_create_guest_and_reservation(
  uuid, uuid, text, text, text, uuid, date, date, numeric, numeric, integer, integer
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_check_availability(uuid, date, date, integer, integer)
  FROM PUBLIC, anon, authenticated;

-- Only hotel administrators may change agent behavior and knowledge.
DROP POLICY IF EXISTS "Permitir mutaciones ai_hotel_config para staff" ON public.ai_hotel_config;
CREATE POLICY ai_hotel_config_admin_mutation ON public.ai_hotel_config
  FOR ALL TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()))
  WITH CHECK (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));

DROP POLICY IF EXISTS "Permitir mutaciones ai_hotel_knowledge para staff" ON public.ai_hotel_knowledge;
CREATE POLICY ai_hotel_knowledge_admin_mutation ON public.ai_hotel_knowledge
  FOR ALL TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()))
  WITH CHECK (public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));

DROP POLICY IF EXISTS "Permitir mutaciones ai_conversations para staff" ON public.ai_conversations;
DROP POLICY IF EXISTS "Permitir lectura ai_conversations solo para staff" ON public.ai_conversations;
CREATE POLICY ai_conversations_operator_select ON public.ai_conversations
  FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_conversations_operator_mutation ON public.ai_conversations
  FOR ALL TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()))
  WITH CHECK (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));

DROP POLICY IF EXISTS "Permitir mutaciones ai_messages para staff" ON public.ai_messages;
DROP POLICY IF EXISTS "Permitir lectura ai_messages solo para staff" ON public.ai_messages;
CREATE POLICY ai_messages_operator_select ON public.ai_messages
  FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));
CREATE POLICY ai_messages_operator_mutation ON public.ai_messages
  FOR ALL TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()))
  WITH CHECK (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));

DROP POLICY IF EXISTS "Permitir mutaciones ai_quotes para staff" ON public.ai_quotes;
DROP POLICY IF EXISTS "Permitir lectura ai_quotes solo para staff" ON public.ai_quotes;
CREATE POLICY ai_quotes_operator_select ON public.ai_quotes
  FOR SELECT TO authenticated
  USING (public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id()));

NOTIFY pgrst, 'reload schema';
