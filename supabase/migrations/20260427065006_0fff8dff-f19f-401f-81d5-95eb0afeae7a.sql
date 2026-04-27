
-- Extend staff_product_goals to support sale_type breakdown + ratio goals
ALTER TABLE public.staff_product_goals
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT '__all',
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'count',
  ADD COLUMN IF NOT EXISTS goal_value numeric NOT NULL DEFAULT 0;

-- Backfill goal_value from goal_count when previously stored
UPDATE public.staff_product_goals
   SET goal_value = goal_count
 WHERE goal_value = 0 AND goal_count > 0;

-- Drop old unique constraint if any, recreate with sale_type + goal_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_product_goals_user_id_product_year_month_key'
  ) THEN
    ALTER TABLE public.staff_product_goals DROP CONSTRAINT staff_product_goals_user_id_product_year_month_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_product_goals_uniq
  ON public.staff_product_goals (user_id, product, sale_type, goal_type, year_month);

-- Monthly inquiry counts per staff (for conversion rate KPI)
CREATE TABLE IF NOT EXISTS public.staff_monthly_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year_month text NOT NULL,
  inflow_count integer NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year_month)
);

ALTER TABLE public.staff_monthly_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view staff_monthly_inquiries"
  ON public.staff_monthly_inquiries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert staff_monthly_inquiries"
  ON public.staff_monthly_inquiries FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update staff_monthly_inquiries"
  ON public.staff_monthly_inquiries FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete staff_monthly_inquiries"
  ON public.staff_monthly_inquiries FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER trg_staff_monthly_inquiries_updated
  BEFORE UPDATE ON public.staff_monthly_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
