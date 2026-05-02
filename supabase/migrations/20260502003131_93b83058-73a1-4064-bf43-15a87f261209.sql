-- 1. positions 확장
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS base_role app_role NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS data_scope text NOT NULL DEFAULT 'self';

-- data_scope: self | store | all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'positions_data_scope_check') THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_data_scope_check
      CHECK (data_scope IN ('self','store','all'));
  END IF;
END $$;

-- 2. position_permissions 매트릭스 테이블
CREATE TABLE IF NOT EXISTS public.position_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  access_level text NOT NULL DEFAULT 'none', -- none | read | write
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, permission_key)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'position_permissions_access_level_check') THEN
    ALTER TABLE public.position_permissions
      ADD CONSTRAINT position_permissions_access_level_check
      CHECK (access_level IN ('none','read','write'));
  END IF;
END $$;

ALTER TABLE public.position_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view position_permissions" ON public.position_permissions;
CREATE POLICY "Authenticated can view position_permissions"
  ON public.position_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins insert position_permissions" ON public.position_permissions;
CREATE POLICY "Admins insert position_permissions"
  ON public.position_permissions FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update position_permissions" ON public.position_permissions;
CREATE POLICY "Admins update position_permissions"
  ON public.position_permissions FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete position_permissions" ON public.position_permissions;
CREATE POLICY "Admins delete position_permissions"
  ON public.position_permissions FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- 3. 신규 권한 카탈로그 추가 (idempotent upsert)
INSERT INTO public.permission_catalog (permission_key, label, category, sort_order) VALUES
  ('feature.inquiry.create', '인입 작성', '인입 관리', 400),
  ('feature.inquiry.delete', '인입 삭제', '인입 관리', 410),
  ('feature.inquiry.export', '인입 엑셀 다운로드', '인입 관리', 420),
  ('feature.sale.view_all', '전체 실적 조회', '실적', 500),
  ('feature.sale.view_own', '본인 실적 조회', '실적', 510),
  ('feature.adspend.edit', '광고 지출 금액 수정', '광고/지출', 600),
  ('feature.adspend.view', '광고 지출 조회', '광고/지출', 610),
  ('feature.expense.create', '지출 내역 작성', '광고/지출', 620),
  ('feature.staffgoal.edit', '직원 목표 세팅', '관리', 700),
  ('feature.inventory.access', '재고 관리 접근', '관리', 710),
  ('feature.admin.access', '어드민 설정 접근', '관리', 720)
ON CONFLICT (permission_key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;

-- 4. updated_at 트리거
DROP TRIGGER IF EXISTS trg_position_permissions_updated_at ON public.position_permissions;
CREATE TRIGGER trg_position_permissions_updated_at
  BEFORE UPDATE ON public.position_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();