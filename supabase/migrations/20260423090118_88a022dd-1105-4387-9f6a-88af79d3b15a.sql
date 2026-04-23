-- Function to generate/refresh monthly claims for a given month from daily activity
CREATE OR REPLACE FUNCTION public.generate_monthly_claims(_claim_month date)
RETURNS TABLE(claims_created int, claims_updated int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ta_rate numeric := 4;
  _da_rate numeric := 150;
  _min_doc int := 5;
  _month_start date;
  _month_end date;
  _created int := 0;
  _updated int := 0;
  _row record;
  _existing record;
BEGIN
  -- Only admins can run
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate monthly claims';
  END IF;

  -- Load settings if present
  SELECT (value #>> '{}')::numeric INTO _ta_rate FROM public.app_settings WHERE key = 'ta_rate_per_km';
  SELECT (value #>> '{}')::numeric INTO _da_rate FROM public.app_settings WHERE key = 'da_rate_per_km';
  SELECT (value #>> '{}')::int INTO _min_doc FROM public.app_settings WHERE key = 'min_doctor_visits_for_da';
  _ta_rate := COALESCE(_ta_rate, 4);
  _da_rate := COALESCE(_da_rate, 150);
  _min_doc := COALESCE(_min_doc, 5);

  _month_start := date_trunc('month', _claim_month)::date;
  _month_end := (_month_start + interval '1 month - 1 day')::date;

  FOR _row IN
    WITH day_stats AS (
      SELECT
        c.user_id,
        c.centre_id,
        c.checkin_date,
        COALESCE(c.total_km, 0) AS km,
        (SELECT COUNT(*) FROM public.visits v WHERE v.checkin_id = c.id AND v.visitor_type = 'doctor') AS doc_visits
      FROM public.daily_checkins c
      WHERE c.checkin_date BETWEEN _month_start AND _month_end
        AND c.status = 'checked_out'
    )
    SELECT
      user_id,
      centre_id,
      COUNT(*)::int AS working_days,
      COALESCE(SUM(km), 0) AS total_km,
      COALESCE(SUM(doc_visits), 0)::int AS total_doctor_visits,
      COUNT(*) FILTER (WHERE doc_visits >= _min_doc)::int AS da_eligible_days,
      COALESCE(SUM(km) * _ta_rate, 0) AS total_ta,
      COALESCE(SUM(CASE WHEN doc_visits >= _min_doc THEN km ELSE 0 END) * _da_rate, 0) AS total_da
    FROM day_stats
    GROUP BY user_id, centre_id
  LOOP
    SELECT * INTO _existing FROM public.monthly_claims
    WHERE user_id = _row.user_id AND claim_month = _month_start;

    IF _existing.id IS NULL THEN
      INSERT INTO public.monthly_claims(
        user_id, centre_id, claim_month, working_days, total_km,
        total_doctor_visits, da_eligible_days, total_ta, total_da, grand_total, status
      ) VALUES (
        _row.user_id, _row.centre_id, _month_start, _row.working_days, _row.total_km,
        _row.total_doctor_visits, _row.da_eligible_days, _row.total_ta, _row.total_da,
        _row.total_ta + _row.total_da, 'submitted'
      );
      _created := _created + 1;
    ELSIF _existing.status IN ('draft','submitted','rejected') THEN
      UPDATE public.monthly_claims SET
        centre_id = _row.centre_id,
        working_days = _row.working_days,
        total_km = _row.total_km,
        total_doctor_visits = _row.total_doctor_visits,
        da_eligible_days = _row.da_eligible_days,
        total_ta = _row.total_ta,
        total_da = _row.total_da,
        grand_total = _row.total_ta + _row.total_da,
        status = CASE WHEN _existing.status = 'rejected' THEN 'submitted'::claim_status ELSE _existing.status END,
        submitted_at = COALESCE(_existing.submitted_at, now()),
        updated_at = now()
      WHERE id = _existing.id;
      _updated := _updated + 1;
    END IF;
    -- approved claims are locked, skip
  END LOOP;

  RETURN QUERY SELECT _created, _updated;
END;
$$;

-- Trigger to lock approved claims from edits
CREATE OR REPLACE FUNCTION public.prevent_approved_claim_edits()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Approved claims are locked and cannot be modified';
  END IF;
  -- Even admins: only allow status change away from approved with a reason
  IF OLD.status = 'approved' AND NEW.status = 'approved' AND public.is_admin() THEN
    -- allow comment-only updates
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_approved_claims ON public.monthly_claims;
CREATE TRIGGER lock_approved_claims
BEFORE UPDATE ON public.monthly_claims
FOR EACH ROW EXECUTE FUNCTION public.prevent_approved_claim_edits();