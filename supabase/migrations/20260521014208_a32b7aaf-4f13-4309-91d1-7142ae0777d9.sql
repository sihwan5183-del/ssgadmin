
-- 1) Scope sales UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update all sales" ON public.sales;

CREATE POLICY "Scoped sales update"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
  OR public.is_team_lead(auth.uid())
  OR (auth.uid() = created_by AND COALESCE(locked, false) = false)
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
  OR public.is_team_lead(auth.uid())
  OR (auth.uid() = created_by AND COALESCE(locked, false) = false)
);

-- 2) Scope sales_addon_tasks INSERT/UPDATE to users who can view the parent sale
DROP POLICY IF EXISTS "auth insert addon_tasks" ON public.sales_addon_tasks;
DROP POLICY IF EXISTS "auth update addon_tasks" ON public.sales_addon_tasks;

CREATE POLICY "Scoped addon_tasks insert"
ON public.sales_addon_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sales_addon_tasks.sale_id
      AND public.can_view_user_data(auth.uid(), s.created_by)
  )
);

CREATE POLICY "Scoped addon_tasks update"
ON public.sales_addon_tasks
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sales_addon_tasks.sale_id
      AND public.can_view_user_data(auth.uid(), s.created_by)
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_planner(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sales_addon_tasks.sale_id
      AND public.can_view_user_data(auth.uid(), s.created_by)
  )
);

-- 3) Tighten sale-documents storage INSERT to require user-folder prefix
DROP POLICY IF EXISTS "Authenticated can upload sale-documents" ON storage.objects;

CREATE POLICY "Scoped sale-documents insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sale-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4) Add explicit UPDATE policy for secure-files bucket
CREATE POLICY "secure-files: uploader update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'secure-files'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
    OR public.is_ceo(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'secure-files'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_admin(auth.uid())
    OR public.is_ceo(auth.uid())
  )
);
