-- 1) 부가서비스 유지 조건 규칙
CREATE TABLE IF NOT EXISTS public.addon_retention_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_name TEXT NOT NULL UNIQUE,
  retention_days INTEGER NOT NULL DEFAULT 95,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.addon_retention_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view addon_retention_rules"
  ON public.addon_retention_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "ceo insert addon_retention_rules"
  ON public.addon_retention_rules FOR INSERT TO authenticated WITH CHECK (public.is_ceo(auth.uid()));
CREATE POLICY "ceo update addon_retention_rules"
  ON public.addon_retention_rules FOR UPDATE TO authenticated USING (public.is_ceo(auth.uid()));
CREATE POLICY "ceo delete addon_retention_rules"
  ON public.addon_retention_rules FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));
CREATE TRIGGER trg_addon_retention_rules_updated
  BEFORE UPDATE ON public.addon_retention_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) 고객별 부가서비스 해지 작업
CREATE TABLE IF NOT EXISTS public.sales_addon_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  addon_name TEXT NOT NULL,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  completed_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sale_id, addon_name)
);
ALTER TABLE public.sales_addon_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth view addon_tasks"
  ON public.sales_addon_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert addon_tasks"
  ON public.sales_addon_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update addon_tasks"
  ON public.sales_addon_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ceo delete addon_tasks"
  ON public.sales_addon_tasks FOR DELETE TO authenticated USING (public.is_ceo(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_sales_addon_tasks_due
  ON public.sales_addon_tasks(due_date) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sales_addon_tasks_sale
  ON public.sales_addon_tasks(sale_id);
CREATE TRIGGER trg_sales_addon_tasks_updated
  BEFORE UPDATE ON public.sales_addon_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) 실적 vas1/vas2/open_date 변경 시 작업 자동 동기화
CREATE OR REPLACE FUNCTION public.sync_sales_addon_tasks()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_addon TEXT;
  v_days INTEGER;
  v_addons TEXT[];
BEGIN
  -- 미완료 작업만 제거(이미 처리한 이력은 보존)
  DELETE FROM public.sales_addon_tasks
   WHERE sale_id = NEW.id AND completed_at IS NULL;

  IF NEW.open_date IS NULL THEN RETURN NEW; END IF;
  v_addons := ARRAY[NEW.vas1, NEW.vas2];

  FOREACH v_addon IN ARRAY v_addons LOOP
    IF v_addon IS NULL OR length(trim(v_addon)) = 0 THEN CONTINUE; END IF;
    SELECT retention_days INTO v_days
      FROM public.addon_retention_rules
     WHERE addon_name = v_addon AND active = true LIMIT 1;
    IF v_days IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.sales_addon_tasks (sale_id, addon_name, due_date)
    VALUES (NEW.id, v_addon, NEW.open_date + v_days)
    ON CONFLICT (sale_id, addon_name) DO UPDATE
      SET due_date = EXCLUDED.due_date, completed_at = NULL, completed_by = NULL, completed_note = NULL;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_sales_addon_tasks ON public.sales;
CREATE TRIGGER trg_sync_sales_addon_tasks
  AFTER INSERT OR UPDATE OF vas1, vas2, open_date ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_sales_addon_tasks();

-- 4) 시드 부가서비스
INSERT INTO public.addon_retention_rules (addon_name, retention_days, note, sort_order) VALUES
  ('V컬러링', 95, '기본 95일', 1),
  ('스마트기기 보험', 95, '기본 95일', 2),
  ('지니뮤직', 95, '기본 95일', 3)
ON CONFLICT (addon_name) DO NOTHING;

-- 5) 기존 실적 백필
UPDATE public.sales s
   SET plan_change_due_date = s.open_date + r.retention_days
  FROM public.plan_retention_rules r
 WHERE s.sale_type = r.sale_type
   AND r.active = true
   AND s.open_date IS NOT NULL;

INSERT INTO public.sales_addon_tasks (sale_id, addon_name, due_date)
SELECT s.id, s.vas1, s.open_date + r.retention_days
  FROM public.sales s
  JOIN public.addon_retention_rules r ON r.addon_name = s.vas1 AND r.active = true
 WHERE s.open_date IS NOT NULL AND s.vas1 IS NOT NULL AND length(trim(s.vas1))>0
ON CONFLICT (sale_id, addon_name) DO UPDATE SET due_date = EXCLUDED.due_date;

INSERT INTO public.sales_addon_tasks (sale_id, addon_name, due_date)
SELECT s.id, s.vas2, s.open_date + r.retention_days
  FROM public.sales s
  JOIN public.addon_retention_rules r ON r.addon_name = s.vas2 AND r.active = true
 WHERE s.open_date IS NOT NULL AND s.vas2 IS NOT NULL AND length(trim(s.vas2))>0
ON CONFLICT (sale_id, addon_name) DO UPDATE SET due_date = EXCLUDED.due_date;

-- 6) 메뉴 등록
INSERT INTO public.menu_items (label, path, icon, sort_order, visible_roles, active, is_admin_only)
VALUES
  ('부가서비스 관리', '/addon-tasks', 'ShieldAlert', 852, ARRAY['admin','manager','user']::text[], true, false),
  ('부가서비스 유지 조건 설정', '/admin/addon-retention', 'Settings2', 853, ARRAY['admin']::text[], true, true)
ON CONFLICT DO NOTHING;