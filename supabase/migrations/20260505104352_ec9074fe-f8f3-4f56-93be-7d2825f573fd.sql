DROP POLICY IF EXISTS "View sales by scope" ON public.sales;
DROP POLICY IF EXISTS "Sales update by scope" ON public.sales;

CREATE POLICY "Authenticated users can view all sales"
ON public.sales
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update all sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);