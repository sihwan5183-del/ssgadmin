-- 신규/미배정 리드 및 기타인입(인입 큐)을 모든 직원이 볼 수 있도록 RLS 정책 보완
-- (담당자 배정 후에는 기존 스코프 정책이 그대로 적용됨)

-- 1) leads: 미배정(assigned_to IS NULL) 인입 리드는 모든 인증 직원에게 공개
DROP POLICY IF EXISTS "View leads by scope" ON public.leads;
CREATE POLICY "View leads by scope"
ON public.leads
FOR SELECT
TO authenticated
USING (
  assigned_to IS NULL
  OR is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR is_planner(auth.uid())
  OR auth.uid() = assigned_to
  OR (assigned_to IS NOT NULL AND can_view_user_data(auth.uid(), assigned_to))
);

DROP POLICY IF EXISTS "Update leads by scope" ON public.leads;
CREATE POLICY "Update leads by scope"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  assigned_to IS NULL
  OR is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR is_planner(auth.uid())
  OR auth.uid() = assigned_to
  OR (assigned_to IS NOT NULL AND can_view_user_data(auth.uid(), assigned_to))
)
WITH CHECK (
  assigned_to IS NULL
  OR is_admin(auth.uid())
  OR is_ceo(auth.uid())
  OR is_planner(auth.uid())
  OR auth.uid() = assigned_to
  OR (assigned_to IS NOT NULL AND can_view_user_data(auth.uid(), assigned_to))
);

-- 2) inquiries(기타인입): 모든 인증 직원에게 SELECT 공개
--    (수정/삭제는 기존 스코프 정책 그대로 유지)
DROP POLICY IF EXISTS "View inquiries by scope" ON public.inquiries;
CREATE POLICY "View inquiries: all authenticated"
ON public.inquiries
FOR SELECT
TO authenticated
USING (true);

-- 3) inquiry_logs: 인입 행이 보이면 로그도 함께 볼 수 있도록 SELECT 완화
DROP POLICY IF EXISTS "Scoped inquiry_logs read" ON public.inquiry_logs;
CREATE POLICY "View inquiry_logs: all authenticated"
ON public.inquiry_logs
FOR SELECT
TO authenticated
USING (true);

-- 4) Realtime 활성화 (이미 켜져 있으면 NOOP)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.inquiries REPLICA IDENTITY FULL;
ALTER TABLE public.inquiry_logs REPLICA IDENTITY FULL;