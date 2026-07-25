
CREATE OR REPLACE FUNCTION public.reset_system_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _counts jsonb := '{}'::jsonb;
  _n int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reset system data';
  END IF;

  -- Everything below runs inside the caller's transaction; any error rolls back all deletes.
  ALTER TABLE public.monthly_claims DISABLE TRIGGER USER;

  DELETE FROM public.visits;                GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('visits', _n);
  DELETE FROM public.referrals;             GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('referrals', _n);
  DELETE FROM public.procedures;            GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('procedures', _n);
  DELETE FROM public.monthly_activities;    GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('monthly_activities', _n);
  DELETE FROM public.monthly_claims;        GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('monthly_claims', _n);
  DELETE FROM public.daily_checkins;        GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('daily_checkins', _n);
  DELETE FROM public.leave_requests;        GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('leave_requests', _n);
  DELETE FROM public.notifications;         GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('notifications', _n);
  DELETE FROM public.audit_logs;            GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('audit_logs', _n);

  -- Clear uploaded visit photos / attachments
  DELETE FROM storage.objects WHERE bucket_id = 'visit-photos';
  GET DIAGNOSTICS _n = ROW_COUNT; _counts := _counts || jsonb_build_object('storage_visit_photos', _n);

  ALTER TABLE public.monthly_claims ENABLE TRIGGER USER;

  RETURN jsonb_build_object('success', true, 'deleted', _counts, 'reset_at', now());
END;
$function$;
