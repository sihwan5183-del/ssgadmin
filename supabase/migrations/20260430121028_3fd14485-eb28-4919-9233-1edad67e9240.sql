-- 1) 팀장이 같은 팀 사용자인지 확인하는 헬퍼 함수
CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'team_lead');
$$;

-- 2) 뷰어가 대상 사용자(target)의 데이터를 볼 수 있는지 (본인 / 같은팀 + team_lead / admin·ceo·planner·super_admin)
CREATE OR REPLACE FUNCTION public.can_view_user_data(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 본인
    _viewer = _target
    -- 관리자/대표/기획팀/슈퍼관리자
    OR public.is_admin(_viewer)
    OR public.is_ceo(_viewer)
    OR public.is_planner(_viewer)
    OR public.is_super_admin(_viewer)
    -- 팀장: profiles.team 일치 (둘 다 team 값이 있고 동일할 때)
    OR (
      public.is_team_lead(_viewer)
      AND EXISTS (
        SELECT 1
          FROM public.profiles pv
          JOIN public.profiles pt ON pt.user_id = _target
         WHERE pv.user_id = _viewer
           AND pv.team IS NOT NULL
           AND pt.team IS NOT NULL
           AND pv.team = pt.team
      )
    );
$$;

-- 3) sales: SELECT 정책 교체
DROP POLICY IF EXISTS "Authenticated can view all sales" ON public.sales;
CREATE POLICY "View sales by scope"
ON public.sales
FOR SELECT
TO authenticated
USING (public.can_view_user_data(auth.uid(), created_by));

-- sales UPDATE/DELETE에 팀장 권한 추가 (수정/삭제도 같은 범위)
DROP POLICY IF EXISTS "Sales update by planner or owner-unlocked" ON public.sales;
CREATE POLICY "Sales update by scope"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  is_planner(auth.uid()) OR is_ceo(auth.uid()) OR is_admin(auth.uid())
  OR ((auth.uid() = created_by) AND (locked = false))
  OR (
    public.is_team_lead(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pv
      JOIN public.profiles pt ON pt.user_id = sales.created_by
      WHERE pv.user_id = auth.uid() AND pv.team IS NOT NULL AND pt.team = pv.team
    )
    AND (locked = false)
  )
);

DROP POLICY IF EXISTS "Sales delete by ceo planner or owner-unlocked" ON public.sales;
CREATE POLICY "Sales delete by scope"
ON public.sales
FOR DELETE
TO authenticated
USING (
  is_planner(auth.uid()) OR is_ceo(auth.uid()) OR is_admin(auth.uid())
  OR ((auth.uid() = created_by) AND (locked = false))
);

-- 4) inquiries
DROP POLICY IF EXISTS "Authenticated can view inquiries" ON public.inquiries;
CREATE POLICY "View inquiries by scope"
ON public.inquiries
FOR SELECT
TO authenticated
USING (public.can_view_user_data(auth.uid(), created_by));

DROP POLICY IF EXISTS "Users update own or admin/planner inquiries" ON public.inquiries;
CREATE POLICY "Update inquiries by scope"
ON public.inquiries
FOR UPDATE
TO authenticated
USING (public.can_view_user_data(auth.uid(), created_by));

DROP POLICY IF EXISTS "Users delete own or admin inquiries" ON public.inquiries;
CREATE POLICY "Delete inquiries by scope"
ON public.inquiries
FOR DELETE
TO authenticated
USING ((auth.uid() = created_by) OR is_admin(auth.uid()) OR is_ceo(auth.uid()));

-- 5) regulars
DROP POLICY IF EXISTS "Authenticated users can view regulars" ON public.regulars;
CREATE POLICY "View regulars by scope"
ON public.regulars
FOR SELECT
TO authenticated
USING (public.can_view_user_data(auth.uid(), created_by));

DROP POLICY IF EXISTS "Users can update their own regulars" ON public.regulars;
CREATE POLICY "Update regulars by scope"
ON public.regulars
FOR UPDATE
TO authenticated
USING (public.can_view_user_data(auth.uid(), created_by));