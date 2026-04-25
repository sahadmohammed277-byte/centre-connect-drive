CREATE TABLE IF NOT EXISTS public.centre_procedure_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  centre_id uuid NOT NULL UNIQUE,
  cag_rate numeric NOT NULL DEFAULT 0,
  ptca_rate numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.centre_procedure_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view procedure rates"
  ON public.centre_procedure_rates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert procedure rates"
  ON public.centre_procedure_rates FOR INSERT
  TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Admins can update procedure rates"
  ON public.centre_procedure_rates FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete procedure rates"
  ON public.centre_procedure_rates FOR DELETE
  TO authenticated USING (is_admin());

CREATE TRIGGER update_centre_procedure_rates_updated_at
  BEFORE UPDATE ON public.centre_procedure_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_centre_procedure_rates_centre ON public.centre_procedure_rates(centre_id);