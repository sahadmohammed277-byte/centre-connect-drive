-- App settings table for configurable rates and toggles
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings"
ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete settings"
ON public.app_settings FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_app_settings_updated
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.app_settings (key, value, description) VALUES
  ('da_rate_per_km', '150'::jsonb, 'Daily Allowance rate per KM (INR)'),
  ('ta_rate_per_km', '4'::jsonb, 'Travel Allowance rate per KM (INR)'),
  ('min_doctor_visits_for_da', '5'::jsonb, 'Minimum doctor visits/day for DA eligibility'),
  ('manual_km_entry_enabled', 'true'::jsonb, 'Allow staff to enter KM manually (admin approval required)'),
  ('notifications_enabled', 'true'::jsonb, 'Enable in-app notifications');

-- Add status + active flag to centres
ALTER TABLE public.centres ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Allow admins to insert centres
CREATE POLICY "Admins can insert centres"
ON public.centres FOR INSERT TO authenticated WITH CHECK (is_admin());

-- Add status to profiles for enable/disable accounts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Allow admins to update any profile (for centre reassign block / disable)
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE TO authenticated USING (is_admin());

-- Admins can view all profiles already covered. Allow admins to view all roles already covered.
