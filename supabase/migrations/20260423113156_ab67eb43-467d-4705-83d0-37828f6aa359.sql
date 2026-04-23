-- New enum for procedure types on referrals
DO $$ BEGIN
  CREATE TYPE public.procedure_type AS ENUM ('cag', 'ptca', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Referrals: add procedure type, patient count, hospital name
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS procedure_type public.procedure_type,
  ADD COLUMN IF NOT EXISTS patient_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hospital_name text;

-- Visits: add doctor name + place label (GPS lat/lng already exist)
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS doctor_name text,
  ADD COLUMN IF NOT EXISTS place text;
