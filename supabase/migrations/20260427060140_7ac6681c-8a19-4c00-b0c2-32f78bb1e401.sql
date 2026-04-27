-- Staff product goals (per user, per product, per month)
CREATE TABLE public.staff_product_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product TEXT NOT NULL,
  year_month TEXT NOT NULL, -- 'YYYY-MM'
  goal_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, product, year_month)
);

CREATE INDEX idx_staff_product_goals_user_month
  ON public.staff_product_goals (user_id, year_month);

ALTER TABLE public.staff_product_goals ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read goals
CREATE POLICY "Authenticated can view staff_product_goals"
ON public.staff_product_goals FOR SELECT TO authenticated
USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins insert staff_product_goals"
ON public.staff_product_goals FOR INSERT TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update staff_product_goals"
ON public.staff_product_goals FOR UPDATE TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete staff_product_goals"
ON public.staff_product_goals FOR DELETE TO authenticated
USING (is_admin(auth.uid()));

CREATE TRIGGER trg_staff_product_goals_updated_at
BEFORE UPDATE ON public.staff_product_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();