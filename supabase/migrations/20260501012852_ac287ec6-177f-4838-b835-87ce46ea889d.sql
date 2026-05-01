-- 1) 목표 템플릿 테이블
CREATE TABLE IF NOT EXISTS public.staff_goal_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  goals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_goal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view goal templates"
  ON public.staff_goal_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert goal templates"
  ON public.staff_goal_templates FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update goal templates"
  ON public.staff_goal_templates FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete goal templates"
  ON public.staff_goal_templates FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_staff_goal_templates_updated
  BEFORE UPDATE ON public.staff_goal_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) 메뉴 항목 추가: 재고/설정 어드민 그룹 하위 [직원별 목표 셋팅]
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM public.menu_groups
   WHERE name ILIKE '%재고%' OR name ILIKE '%설정%' OR name ILIKE '%어드민%' OR name ILIKE '%admin%'
   ORDER BY sort_order LIMIT 1;

  IF v_group_id IS NOT NULL THEN
    INSERT INTO public.menu_items (label, path, icon, sort_order, visible_roles, is_admin_only, group_id, active)
    SELECT '직원별 목표 셋팅', '/admin/staff-goals', 'Target', 95,
           ARRAY['admin','manager']::text[], false, v_group_id, true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.menu_items WHERE path = '/admin/staff-goals'
    );
  END IF;
END $$;