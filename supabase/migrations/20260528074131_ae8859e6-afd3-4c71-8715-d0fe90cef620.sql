-- 1) Tighten ad_spend SELECT: restrict from "all authenticated" to admin/ceo/manager/owner
DROP POLICY IF EXISTS "Authenticated can view all ad_spend" ON public.ad_spend;

CREATE POLICY "Finance leaders or owners view ad_spend"
ON public.ad_spend
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- 2) trusted_devices: allow users to insert/update their own device rows
CREATE POLICY "Users insert own devices"
ON public.trusted_devices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own devices"
ON public.trusted_devices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR is_admin(auth.uid()));