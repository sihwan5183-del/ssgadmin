-- 1) role_permissions: 권한 그룹별 세부 항목 매트릭스
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 자신이 어떤 권한을 가졌는지 알기 위해 조회 가능
CREATE POLICY "Authenticated can view role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- 관리자만 변경 가능
CREATE POLICY "Admins can insert role_permissions"
  ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update role_permissions"
  ON public.role_permissions FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete role_permissions"
  ON public.role_permissions FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- 2) 슈퍼관리자 헬퍼 함수 (이메일 기준)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'h860306@naver.com'
  )
$$;

-- 3) profiles 소프트 삭제 컬럼 + 'deleted' 상태 허용
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE OR REPLACE FUNCTION public.validate_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status NOT IN ('active','leave','resigned','pending','suspended','deleted') THEN
    RAISE EXCEPTION '유효하지 않은 상태값: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) 권한 키 카탈로그(선택적): 어드민 UI에서 항목을 보여줄 때 사용
CREATE TABLE IF NOT EXISTS public.permission_catalog (
  permission_key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL DEFAULT '기타',
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view permission_catalog"
  ON public.permission_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage permission_catalog"
  ON public.permission_catalog FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 기본 권한 키 시드
INSERT INTO public.permission_catalog (permission_key, label, category, sort_order) VALUES
  ('menu.dashboard', '대시보드', '메뉴', 10),
  ('menu.input', '실적 입력', '메뉴', 20),
  ('menu.ledger', '판매실적장표', '메뉴', 30),
  ('menu.review', '검수관리', '메뉴', 40),
  ('menu.profit', '수익 확인', '메뉴', 50),
  ('menu.inventory', '재고 관리', '메뉴', 60),
  ('menu.inquiries', '문의 관리', '메뉴', 70),
  ('menu.calendar', '캘린더', '메뉴', 80),
  ('menu.downloads', '다운로드', '메뉴', 90),
  ('menu.admin', '어드민 설정', '메뉴', 100),
  ('feature.sale.create', '실적 생성', '기능', 200),
  ('feature.sale.edit_any', '타인 실적 수정', '기능', 210),
  ('feature.sale.delete', '실적 삭제', '기능', 220),
  ('feature.sale.approve', '실적 승인/검수', '기능', 230),
  ('feature.account.manage', '계정 관리', '기능', 300),
  ('feature.account.delete', '계정 삭제(퇴사)', '기능', 310)
ON CONFLICT (permission_key) DO NOTHING;