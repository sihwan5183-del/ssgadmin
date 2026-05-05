-- Sales: scope SELECT and UPDATE back to roles + ownership
DROP POLICY IF EXISTS "Authenticated can view sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated can update sales" ON public.sales;

CREATE POLICY "View sales by scope"
  ON public.sales FOR SELECT
  TO authenticated
  USING (can_view_user_data(auth.uid(), created_by));

CREATE POLICY "Sales update by scope"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid()) OR is_ceo(auth.uid()) OR is_planner(auth.uid())
    OR is_team_lead(auth.uid())
    OR (auth.uid() = created_by AND locked = false)
  )
  WITH CHECK (
    is_admin(auth.uid()) OR is_ceo(auth.uid()) OR is_planner(auth.uid())
    OR is_team_lead(auth.uid())
    OR (auth.uid() = created_by AND locked = false)
  );

-- seg-files: require uploads to live in the caller's folder
DROP POLICY IF EXISTS "Auth upload seg-files" ON storage.objects;
CREATE POLICY "Auth upload seg-files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'seg-files'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
