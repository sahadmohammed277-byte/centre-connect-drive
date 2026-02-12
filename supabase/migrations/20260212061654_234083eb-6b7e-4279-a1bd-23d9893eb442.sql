
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');
CREATE TYPE public.visitor_type AS ENUM ('doctor', 'lab', 'ambulance_driver', 'hospital', 'other');
CREATE TYPE public.service_type AS ENUM ('lab', 'opd', 'scan', 'admission');
CREATE TYPE public.claim_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
CREATE TYPE public.km_entry_type AS ENUM ('gps', 'manual');

-- ============================================
-- CENTRES TABLE
-- ============================================
CREATE TABLE public.centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geo_fence_radius_meters INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  employee_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  centre_id UUID REFERENCES public.centres(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- USER ROLES TABLE
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ============================================
-- DAILY CHECK-INS TABLE
-- ============================================
CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  centre_id UUID REFERENCES public.centres(id) NOT NULL,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checkin_time TIMESTAMPTZ,
  checkin_lat DOUBLE PRECISION,
  checkin_lng DOUBLE PRECISION,
  checkout_time TIMESTAMPTZ,
  checkout_lat DOUBLE PRECISION,
  checkout_lng DOUBLE PRECISION,
  gps_km DOUBLE PRECISION,
  manual_start_km DOUBLE PRECISION,
  manual_end_km DOUBLE PRECISION,
  manual_km_approved BOOLEAN DEFAULT false,
  total_km DOUBLE PRECISION GENERATED ALWAYS AS (
    COALESCE(gps_km, CASE WHEN manual_end_km IS NOT NULL AND manual_start_km IS NOT NULL THEN manual_end_km - manual_start_km ELSE NULL END, 0)
  ) STORED,
  status TEXT NOT NULL DEFAULT 'checked_in',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

-- ============================================
-- VISITS TABLE
-- ============================================
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checkin_id UUID REFERENCES public.daily_checkins(id) ON DELETE CASCADE NOT NULL,
  centre_id UUID REFERENCES public.centres(id) NOT NULL,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checkin_time TIMESTAMPTZ,
  checkout_time TIMESTAMPTZ,
  visitor_type visitor_type NOT NULL,
  visitor_name TEXT NOT NULL,
  designation TEXT,
  contact_number TEXT,
  purpose TEXT,
  notes TEXT,
  visit_lat DOUBLE PRECISION,
  visit_lng DOUBLE PRECISION,
  photo_urls TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- REFERRALS TABLE
-- ============================================
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checkin_id UUID REFERENCES public.daily_checkins(id) ON DELETE CASCADE,
  centre_id UUID REFERENCES public.centres(id) NOT NULL,
  referral_received BOOLEAN NOT NULL DEFAULT false,
  patient_name TEXT,
  service_type service_type,
  estimated_value NUMERIC(10,2),
  referral_date DATE NOT NULL DEFAULT CURRENT_DATE,
  referral_centre TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MONTHLY CLAIMS TABLE
-- ============================================
CREATE TABLE public.monthly_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  centre_id UUID REFERENCES public.centres(id) NOT NULL,
  claim_month DATE NOT NULL, -- first day of month
  working_days INTEGER NOT NULL DEFAULT 0,
  total_km DOUBLE PRECISION NOT NULL DEFAULT 0,
  total_doctor_visits INTEGER NOT NULL DEFAULT 0,
  da_eligible_days INTEGER NOT NULL DEFAULT 0,
  total_da NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_ta NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status claim_status NOT NULL DEFAULT 'draft',
  admin_comments TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, claim_month)
);

-- ============================================
-- AUDIT LOGS TABLE
-- ============================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'staff')
$$;

-- ============================================
-- TIMESTAMP UPDATE TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_daily_checkins_updated_at BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_claims_updated_at BEFORE UPDATE ON public.monthly_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- CENTRES: everyone authenticated can read
CREATE POLICY "Authenticated users can view centres" ON public.centres
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update centres" ON public.centres
  FOR UPDATE TO authenticated USING (public.is_admin());

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- USER ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_admin());

-- DAILY CHECK-INS
CREATE POLICY "Own or admin can view checkins" ON public.daily_checkins
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Staff can insert own checkins" ON public.daily_checkins
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own or admin can update checkins" ON public.daily_checkins
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- VISITS
CREATE POLICY "Own or admin can view visits" ON public.visits
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Staff can insert own visits" ON public.visits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own or admin can update visits" ON public.visits
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- REFERRALS
CREATE POLICY "Own or admin can view referrals" ON public.referrals
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Staff can insert own referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own or admin can update referrals" ON public.referrals
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- MONTHLY CLAIMS
CREATE POLICY "Own or admin can view claims" ON public.monthly_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Staff can insert own claims" ON public.monthly_claims
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own or admin can update claims" ON public.monthly_claims
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- AUDIT LOGS
CREATE POLICY "Own or admin can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS
CREATE POLICY "Own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Insert own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================
-- SEED CENTRES DATA
-- ============================================
INSERT INTO public.centres (name, latitude, longitude) VALUES
  ('KH Malappuram', 11.0510, 76.0711),
  ('KH Kochi', 9.9312, 76.2673),
  ('KH Tirur', 10.9146, 75.9224),
  ('KH Calicut', 11.2588, 75.7804),
  ('KH Edappal', 10.7867, 76.0030),
  ('KH Perumpilavu', 10.5670, 76.1750),
  ('KH Kottayam', 9.5916, 76.5222),
  ('KH Trivandrum', 8.5241, 76.9366);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, employee_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'employee_id', 'EMP-' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE BUCKET FOR VISIT PHOTOS
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('visit-photos', 'visit-photos', true);

CREATE POLICY "Authenticated users can upload visit photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'visit-photos');
CREATE POLICY "Anyone can view visit photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'visit-photos');
CREATE POLICY "Users can delete own visit photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
