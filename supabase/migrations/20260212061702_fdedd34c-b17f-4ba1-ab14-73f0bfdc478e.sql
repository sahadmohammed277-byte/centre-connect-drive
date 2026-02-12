
-- Fix permissive audit log insert policy
DROP POLICY "Authenticated can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin());
