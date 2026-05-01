-- 1) Pending item definitions table
CREATE TABLE public.pending_item_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  required BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_item_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pending_item_definitions"
  ON public.pending_item_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert pending_item_definitions"
  ON public.pending_item_definitions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update pending_item_definitions"
  ON public.pending_item_definitions FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete pending_item_definitions"
  ON public.pending_item_definitions FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- updated_at 자동 갱신
CREATE TRIGGER trg_pending_item_definitions_updated_at
  BEFORE UPDATE ON public.pending_item_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 실시간 반영을 위해 publication 에 추가
ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_item_definitions;
ALTER TABLE public.pending_item_definitions REPLICA IDENTITY FULL;

-- 2) 기본 항목 시드 (기존 PENDING_ITEM_OPTIONS 와 동일 순서)
INSERT INTO public.pending_item_definitions (label, sort_order, active, required) VALUES
  ('약정 처리',       10, true, false),
  ('할부 등록',       20, true, false),
  ('결합 할인',       30, true, false),
  ('부가서비스 가입', 40, true, false),
  ('서류 보완',       50, true, false),
  ('청구계정통합',    60, true, false),
  ('2ND쉐어링결합',   70, true, false)
ON CONFLICT (label) DO NOTHING;

-- 3) 사이드바 메뉴 항목 추가
INSERT INTO public.menu_items (group_id, label, path, icon, sort_order, is_admin_only, active, visible_roles)
VALUES (
  'ec561862-2763-4656-a423-3972ca2f01aa', -- 재고 / 설정(admin)
  '미처리 항목 설정',
  '/admin/pending-items',
  'ListChecks',
  85,
  true,
  true,
  ARRAY['admin']
)
ON CONFLICT DO NOTHING;