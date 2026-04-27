-- =========================================================
-- 1. PROCEDURES TABLE (CAG / PTCA, etc.)
-- =========================================================
CREATE TYPE public.procedure_kind AS ENUM ('cag', 'ptca', 'other');

CREATE TABLE public.procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  centre_id UUID NOT NULL,
  checkin_id UUID,
  visit_id UUID,
  procedure_type public.procedure_kind NOT NULL,
  patient_name TEXT NOT NULL,
  doctor_name TEXT,
  hospital_name TEXT,
  estimated_value NUMERIC,
  procedure_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_procedures_user_date ON public.procedures(user_id, procedure_date DESC);
CREATE INDEX idx_procedures_centre_date ON public.procedures(centre_id, procedure_date DESC);
CREATE INDEX idx_procedures_checkin ON public.procedures(checkin_id);

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert own procedures"
  ON public.procedures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own or admin can view procedures"
  ON public.procedures FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin());

CREATE POLICY "Own or admin can update procedures"
  ON public.procedures FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin());

CREATE POLICY "Own or admin can delete procedures"
  ON public.procedures FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin());

CREATE TRIGGER trg_procedures_updated_at
  BEFORE UPDATE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2. LEAVE REQUESTS TABLE
-- =========================================================
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE public.leave_kind AS ENUM ('casual', 'sick', 'earned', 'unpaid', 'other');

CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  centre_id UUID,
  leave_type public.leave_kind NOT NULL DEFAULT 'casual',
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status public.leave_status NOT NULL DEFAULT 'pending',
  admin_comments TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leave_requests_user ON public.leave_requests(user_id, from_date DESC);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);

-- Validation: to_date >= from_date (use trigger, not CHECK)
CREATE OR REPLACE FUNCTION public.validate_leave_dates()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.to_date < NEW.from_date THEN
    RAISE EXCEPTION 'to_date cannot be before from_date';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_leave_dates
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_leave_dates();

CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert own leave"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own or admin can view leave"
  ON public.leave_requests FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR public.is_admin());

-- Staff can update only their own pending leaves (e.g. cancel); admins can update any
CREATE POLICY "Update own pending or admin any"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND status = 'pending')
  );

CREATE POLICY "Admin or owner can delete pending"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (user_id = auth.uid() AND status = 'pending')
  );