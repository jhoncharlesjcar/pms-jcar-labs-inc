-- supabase/migrations/20260907000003_validate_cierre_caja_saldo.sql
-- FI-02: Validación server-side de consistencia del cierre de caja

CREATE OR REPLACE FUNCTION public.validate_cierre_caja_saldo()
RETURNS TRIGGER AS $$
BEGIN
  IF ABS(COALESCE(NEW.balance, 0) - (COALESCE(NEW.total_ingresos, 0) - COALESCE(NEW.total_egresos, 0))) > 0.01 THEN
    RAISE EXCEPTION 'Cierre de caja inconsistente: balance (%) ≠ ingresos (%) - egresos (%)',
      NEW.balance, NEW.total_ingresos, NEW.total_egresos
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(NEW.total_ingresos, 0) < 0 THEN
    RAISE EXCEPTION 'total_ingresos no puede ser negativo: %', NEW.total_ingresos
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(NEW.total_egresos, 0) < 0 THEN
    RAISE EXCEPTION 'total_egresos no puede ser negativo: %', NEW.total_egresos
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_cierre_caja ON public.cierres_caja;
CREATE TRIGGER trg_validate_cierre_caja
  BEFORE INSERT OR UPDATE ON public.cierres_caja
  FOR EACH ROW EXECUTE FUNCTION public.validate_cierre_caja_saldo();

NOTIFY pgrst, 'reload schema';
