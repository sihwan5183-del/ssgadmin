CREATE TABLE IF NOT EXISTS public.plan_retention_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_type TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 183,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_retention_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view plan_retention_rules"
  ON public.plan_retention_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins or CEO insert plan_retention_rules"
  ON public.plan_retention_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "Admins or CEO update plan_retention_rules"
  ON public.plan_retention_rules FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()));
CREATE POLICY "Admins or CEO delete plan_retention_rules"
  ON public.plan_retention_rules FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE TRIGGER trg_plan_retention_rules_updated
  BEFORE UPDATE ON public.plan_retention_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plan_retention_rules (sale_type, retention_days, note, sort_order) VALUES
  ('선택약정', 93, '기본 3개월', 1),
  ('선택약정+유통망지원금', 183, '기본 6개월', 2),
  ('이통사지원금(공시)', 183, '기본 6개월', 3),
  ('이통사지원금+유통망지원금', 183, '기본 6개월', 4)
ON CONFLICT (sale_type) DO NOTHING;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS plan_change_due_date DATE,
  ADD COLUMN IF NOT EXISTS plan_change_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_change_note TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_plan_change_due_date
  ON public.sales(plan_change_due_date)
  WHERE plan_change_due_date IS NOT NULL;

CREATE OR REPLACE FUNCTION public.compute_plan_change_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INTEGER;
BEGIN
  IF NEW.open_date IS NULL OR NEW.sale_type IS NULL THEN
    -- 사용자가 수동으로 완료 처리한 건은 due_date 유지
    IF TG_OP = 'INSERT' THEN
      NEW.plan_change_due_date := NULL;
    END IF;
    RETURN NEW;
  END IF;

  SELECT retention_days INTO v_days
    FROM public.plan_retention_rules
   WHERE sale_type = NEW.sale_type
     AND active = true
   LIMIT 1;

  IF v_days IS NULL THEN
    NEW.plan_change_due_date := NULL;
  ELSE
    NEW.plan_change_due_date := NEW.open_date + v_days;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_plan_change_due ON public.sales;
CREATE TRIGGER trg_compute_plan_change_due
  BEFORE INSERT OR UPDATE OF sale_type, open_date ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.compute_plan_change_due_date();

-- 기존 데이터 백필
UPDATE public.sales s
   SET plan_change_due_date = s.open_date + r.retention_days
  FROM public.plan_retention_rules r
 WHERE s.sale_type = r.sale_type
   AND r.active = true
   AND s.open_date IS NOT NULL
   AND s.plan_change_due_date IS NULL;

INSERT INTO public.menu_items (label, path, icon, sort_order, visible_roles, active, is_admin_only)
VALUES
  ('요금제 변경 캘린더', '/plan-change-calendar', 'CalendarClock', 850, ARRAY['admin','manager','user']::text[], true, false),
  ('요금제 유지 조건 설정', '/admin/plan-retention', 'Settings2', 851, ARRAY['admin']::text[], true, true)
ON CONFLICT DO NOTHING;