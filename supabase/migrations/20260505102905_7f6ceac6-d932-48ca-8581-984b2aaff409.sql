-- Allow all authenticated users to view and update any sales row
DROP POLICY IF EXISTS "View sales by scope" ON public.sales;
DROP POLICY IF EXISTS "Sales update by scope" ON public.sales;
DROP POLICY IF EXISTS "Sales delete by scope" ON public.sales;

CREATE POLICY "Authenticated can view sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update sales"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Owner or admin delete sales"
  ON public.sales FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid()) OR is_ceo(auth.uid()) OR is_planner(auth.uid())
    OR (auth.uid() = created_by AND locked = false)
  );
