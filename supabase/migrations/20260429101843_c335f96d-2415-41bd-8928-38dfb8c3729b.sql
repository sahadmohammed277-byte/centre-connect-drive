-- Add procedure_status enum and columns to procedures
DO $$ BEGIN
  CREATE TYPE public.procedure_status AS ENUM ('pending', 'done', 'not_done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS procedure_status public.procedure_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS not_done_reason text,
  ADD COLUMN IF NOT EXISTS payment_date date;

-- Backfill: existing 'released' rows considered done
UPDATE public.procedures
  SET procedure_status = 'done'
  WHERE payment_status = 'released' AND procedure_status = 'pending';

-- Validation trigger: payment cannot be released unless procedure_status = done
CREATE OR REPLACE FUNCTION public.validate_procedure_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'released' AND NEW.procedure_status <> 'done' THEN
    RAISE EXCEPTION 'Payment can only be released when procedure_status is done';
  END IF;
  IF NEW.procedure_status = 'not_done' AND (NEW.not_done_reason IS NULL OR length(trim(NEW.not_done_reason)) = 0) THEN
    RAISE EXCEPTION 'not_done_reason is required when procedure_status is not_done';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_procedure_payment ON public.procedures;
CREATE TRIGGER trg_validate_procedure_payment
BEFORE INSERT OR UPDATE ON public.procedures
FOR EACH ROW EXECUTE FUNCTION public.validate_procedure_payment();