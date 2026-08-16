-- Loyalty isolation and server-side, atomic balance mutations.

DROP POLICY IF EXISTS "Permitir acceso a loyalty_accounts por hotel" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "Permitir acceso a loyalty_transactions por hotel" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_accounts_select_by_hotel" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "loyalty_accounts_insert_by_hotel" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "loyalty_accounts_update_by_hotel" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "loyalty_accounts_delete_dev_only" ON public.loyalty_accounts;
DROP POLICY IF EXISTS "loyalty_transactions_select_by_hotel" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "loyalty_transactions_insert_by_hotel" ON public.loyalty_transactions;

ALTER TABLE public.loyalty_transactions
  ADD COLUMN IF NOT EXISTS operation_id uuid;

UPDATE public.loyalty_transactions
SET operation_id = gen_random_uuid()
WHERE operation_id IS NULL;

ALTER TABLE public.loyalty_transactions
  ALTER COLUMN operation_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN operation_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_transactions_operation
  ON public.loyalty_transactions(operation_id);

CREATE OR REPLACE FUNCTION public.enforce_loyalty_transaction_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_account_hotel uuid;
BEGIN
  SELECT la.hotel_id INTO v_account_hotel
  FROM public.loyalty_accounts AS la
  WHERE la.id = NEW.loyalty_account_id;

  IF v_account_hotel IS NULL OR NEW.hotel_id IS DISTINCT FROM v_account_hotel THEN
    RAISE EXCEPTION 'loyalty transaction/account tenant mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_transaction_tenant ON public.loyalty_transactions;
CREATE TRIGGER trg_loyalty_transaction_tenant
  BEFORE INSERT OR UPDATE ON public.loyalty_transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loyalty_transaction_tenant();

CREATE POLICY "loyalty_accounts_select_by_hotel" ON public.loyalty_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "loyalty_transactions_select_by_hotel" ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

REVOKE INSERT, UPDATE, DELETE ON public.loyalty_accounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_transactions FROM anon, authenticated;
GRANT SELECT ON public.loyalty_accounts TO authenticated;
GRANT SELECT ON public.loyalty_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_loyalty_transaction(
  p_operation_id uuid,
  p_account_id uuid,
  p_type text,
  p_points integer,
  p_reference_type text,
  p_reference_id uuid DEFAULT NULL,
  p_nights_count integer DEFAULT NULL
)
RETURNS public.loyalty_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_account public.loyalty_accounts%ROWTYPE;
  v_existing public.loyalty_transactions%ROWTYPE;
  v_role text := public.get_user_role();
  v_hotel uuid := public.get_user_hotel_id();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active() OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_operation_id IS NULL OR p_points = 0 THEN
    RAISE EXCEPTION 'operation_id and non-zero points are required';
  END IF;
  IF (p_type = 'earned' AND p_points < 0)
     OR (p_type IN ('redeemed', 'expired', 'reversed') AND p_points > 0)
     OR p_type NOT IN ('earned', 'redeemed', 'expired', 'reversed') THEN
    RAISE EXCEPTION 'invalid loyalty transaction sign/type';
  END IF;

  SELECT * INTO v_existing
  FROM public.loyalty_transactions
  WHERE operation_id = p_operation_id;
  IF FOUND THEN
    SELECT * INTO v_account FROM public.loyalty_accounts WHERE id = v_existing.loyalty_account_id;
    RETURN v_account;
  END IF;

  SELECT * INTO v_account
  FROM public.loyalty_accounts
  WHERE id = p_account_id
  FOR UPDATE;
  IF NOT FOUND OR (v_role <> 'developer' AND v_account.hotel_id <> v_hotel) THEN
    RAISE EXCEPTION 'loyalty account not found';
  END IF;
  IF v_account.points_balance + p_points < 0 THEN
    RAISE EXCEPTION 'insufficient loyalty balance';
  END IF;

  UPDATE public.loyalty_accounts
  SET points_balance = points_balance + p_points,
      last_stay_date = CASE WHEN p_type = 'earned' THEN CURRENT_DATE ELSE last_stay_date END,
      updated_at = now()
  WHERE id = p_account_id
  RETURNING * INTO v_account;

  INSERT INTO public.loyalty_transactions(
    operation_id, loyalty_account_id, hotel_id, type, points,
    reference_type, reference_id, nights_count, created_by
  ) VALUES (
    p_operation_id, p_account_id, v_account.hotel_id, p_type, p_points,
    p_reference_type, p_reference_id, p_nights_count, auth.uid()
  );
  RETURN v_account;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_loyalty_transaction(uuid, uuid, text, integer, text, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_loyalty_transaction(uuid, uuid, text, integer, text, uuid, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_loyalty_transaction_tenant() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_loyalty_account(p_document_type text, p_document_number text, p_guest_name text)
RETURNS public.loyalty_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_account public.loyalty_accounts%ROWTYPE; v_hotel uuid := public.get_user_hotel_id();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR public.get_user_role() NOT IN ('recepcionista', 'admin', 'developer') OR v_hotel IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_document_type NOT IN ('DNI', 'CE', 'Pasaporte')
     OR length(btrim(p_document_number)) NOT BETWEEN 6 AND 20
     OR length(btrim(p_guest_name)) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'invalid loyalty guest data'; END IF;
  INSERT INTO public.loyalty_accounts(hotel_id, guest_document_type, guest_document_number, guest_name)
  VALUES (v_hotel, p_document_type, btrim(p_document_number), btrim(p_guest_name))
  ON CONFLICT (hotel_id, guest_document_type, guest_document_number)
  DO UPDATE SET guest_name = EXCLUDED.guest_name, updated_at = now()
  RETURNING * INTO v_account;
  RETURN v_account;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_loyalty_account(p_account_id uuid, p_cutoff_date date, p_operation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_account public.loyalty_accounts%ROWTYPE; v_points integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_account FROM public.loyalty_accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND OR v_account.last_stay_date >= p_cutoff_date OR v_account.points_balance <= 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.loyalty_transactions WHERE operation_id = p_operation_id) THEN RETURN false; END IF;
  v_points := v_account.points_balance;
  UPDATE public.loyalty_accounts SET points_balance = 0, updated_at = now() WHERE id = p_account_id;
  INSERT INTO public.loyalty_transactions(operation_id, loyalty_account_id, hotel_id, type, points, reference_type, created_by)
  VALUES (p_operation_id, p_account_id, v_account.hotel_id, 'expired', -v_points, 'expiration_job', NULL);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_loyalty_account(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_loyalty_account(text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_loyalty_account(uuid, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_loyalty_account(uuid, date, uuid) TO service_role;
