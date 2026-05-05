-- Extend sales UPDATE policy to allow same-team members to update each other's sales
DROP POLICY IF EXISTS "Sales update by scope" ON public.sales;

CREATE POLICY "Sales update by scope"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  public.is_planner(auth.uid())
  OR public.is_ceo(auth.uid())
  OR public.is_admin(auth.uid())
  OR ((auth.uid() = created_by) AND (locked = false))
  OR (
    (locked = false)
    AND EXISTS (
      SELECT 1
      FROM public.profiles pv
      JOIN public.profiles pt ON pt.user_id = sales.created_by
      WHERE pv.user_id = auth.uid()
        AND pv.team IS NOT NULL
        AND pt.team IS NOT NULL
        AND pv.team = pt.team
    )
  )
);