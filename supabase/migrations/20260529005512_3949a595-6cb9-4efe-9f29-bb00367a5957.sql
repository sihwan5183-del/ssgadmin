
-- ── leads: scope to assignee / team / leadership (was USING(true)) ──
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;

CREATE POLICY "View leads by scope"
ON public.leads
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR is_planner(auth.uid())
  OR auth.uid() = assigned_to
  OR (assigned_to IS NOT NULL AND can_view_user_data(auth.uid(), assigned_to))
);

-- Inserts: keep open to authenticated employees (manual registration) and webhooks (service_role bypasses RLS)
CREATE POLICY "Authenticated insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Update leads by scope"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR is_planner(auth.uid())
  OR auth.uid() = assigned_to
  OR (assigned_to IS NOT NULL AND can_view_user_data(auth.uid(), assigned_to))
)
WITH CHECK (
  is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR is_planner(auth.uid())
  OR auth.uid() = assigned_to
  OR (assigned_to IS NOT NULL AND can_view_user_data(auth.uid(), assigned_to))
);

-- ── sales: scope SELECT to team (was USING(true)) ──
DROP POLICY IF EXISTS "Authenticated users can view all sales" ON public.sales;

CREATE POLICY "View sales by scope"
ON public.sales
FOR SELECT
TO authenticated
USING (can_view_user_data(auth.uid(), created_by));

-- ── seg_partners: scope SELECT to owner / assignee / leadership (was USING(true)) ──
DROP POLICY IF EXISTS "Authenticated view seg_partners" ON public.seg_partners;

CREATE POLICY "View seg_partners by scope"
ON public.seg_partners
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by
  OR auth.uid() = assignee
  OR is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR is_planner(auth.uid())
);
