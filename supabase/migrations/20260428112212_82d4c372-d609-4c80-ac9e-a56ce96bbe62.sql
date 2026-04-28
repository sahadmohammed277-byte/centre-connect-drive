-- Payment status enum for referrals/procedures
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'released');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_updater AS ENUM ('staff', 'finance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_updated_by public.payment_updater,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_updated_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_procedures_payment_status ON public.procedures(payment_status);
CREATE INDEX IF NOT EXISTS idx_procedures_doctor_name ON public.procedures(doctor_name);