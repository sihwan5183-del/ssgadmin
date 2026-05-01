-- 직원별 목표 셋팅 메뉴: 관리자/대표만 노출
UPDATE public.menu_items
SET visible_roles = ARRAY['admin']::text[],
    is_admin_only = true
WHERE path = '/admin/staff-goals';

-- staff_goal_templates RLS: admin 뿐 아니라 ceo도 쓰기 허용
DROP POLICY IF EXISTS "Admins insert goal templates" ON public.staff_goal_templates;
DROP POLICY IF EXISTS "Admins update goal templates" ON public.staff_goal_templates;
DROP POLICY IF EXISTS "Admins delete goal templates" ON public.staff_goal_templates;

CREATE POLICY "Admins or CEO insert goal templates"
  ON public.staff_goal_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_ceo(auth.uid()));

CREATE POLICY "Admins or CEO update goal templates"
  ON public.staff_goal_templates FOR UPDATE TO authenticated
  USING (public.is_ceo(auth.uid()));

CREATE POLICY "Admins or CEO delete goal templates"
  ON public.staff_goal_templates FOR DELETE TO authenticated
  USING (public.is_ceo(auth.uid()));