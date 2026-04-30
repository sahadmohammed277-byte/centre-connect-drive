-- Enable realtime for cross-module data sync (Dashboard, Reports, Referrals)
ALTER TABLE public.procedures REPLICA IDENTITY FULL;
ALTER TABLE public.referrals REPLICA IDENTITY FULL;
ALTER TABLE public.daily_checkins REPLICA IDENTITY FULL;
ALTER TABLE public.visits REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.procedures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;