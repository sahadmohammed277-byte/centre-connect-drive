
CREATE TYPE public.activity_status AS ENUM ('planning', 'completed', 'cancelled');

CREATE TABLE public.monthly_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  centre_id UUID REFERENCES public.centres(id) ON DELETE SET NULL,
  activity_date DATE NOT NULL,
  activity_name TEXT NOT NULL,
  location TEXT,
  expected_completion_date DATE NOT NULL,
  completion_date DATE,
  notes TEXT,
  completion_notes TEXT,
  completion_photo_url TEXT,
  status public.activity_status NOT NULL DEFAULT 'planning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_monthly_activities_staff ON public.monthly_activities(staff_id);
CREATE INDEX idx_monthly_activities_centre ON public.monthly_activities(centre_id);
CREATE INDEX idx_monthly_activities_date ON public.monthly_activities(activity_date);
CREATE INDEX idx_monthly_activities_status ON public.monthly_activities(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_activities TO authenticated;
GRANT ALL ON public.monthly_activities TO service_role;

ALTER TABLE public.monthly_activities ENABLE ROW LEVEL SECURITY;

-- Staff can view their own; admins can view all
CREATE POLICY "View own or admin all"
  ON public.monthly_activities FOR SELECT
  TO authenticated
  USING (auth.uid() = staff_id OR public.is_admin());

-- Staff insert their own; admin can insert for anyone
CREATE POLICY "Insert own or admin"
  ON public.monthly_activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = staff_id OR public.is_admin());

-- Staff can update their own while not completed; admin any
CREATE POLICY "Update own not completed or admin"
  ON public.monthly_activities FOR UPDATE
  TO authenticated
  USING ((auth.uid() = staff_id AND status <> 'completed') OR public.is_admin())
  WITH CHECK (auth.uid() = staff_id OR public.is_admin());

-- Only admins can delete
CREATE POLICY "Admin can delete"
  ON public.monthly_activities FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_monthly_activities_updated_at
  BEFORE UPDATE ON public.monthly_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.monthly_activities REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_activities;
