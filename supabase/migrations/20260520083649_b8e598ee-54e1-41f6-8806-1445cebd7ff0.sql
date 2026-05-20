-- Make total_km a regular editable column (was GENERATED ALWAYS, blocking End Day updates)
ALTER TABLE public.daily_checkins
  ALTER COLUMN total_km DROP EXPRESSION;

-- Backfill any nulls to 0 so reports/aggregates stay safe
UPDATE public.daily_checkins
  SET total_km = COALESCE(total_km, gps_km, 0)
  WHERE total_km IS NULL;