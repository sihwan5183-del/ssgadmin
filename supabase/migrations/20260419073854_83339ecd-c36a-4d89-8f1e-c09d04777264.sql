-- ===== 1. 권한 시스템 =====
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 권한 체크용 SECURITY DEFINER 함수 (RLS 무한 재귀 방지)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- user_roles RLS
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ===== 2. 전사 공통 설정 =====
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings"
  ON public.app_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete settings"
  ON public.app_settings FOR DELETE
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 3. 필드 라벨/표시 커스터마이즈 =====
CREATE TABLE public.field_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  section TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view field_labels"
  ON public.field_labels FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert field_labels"
  ON public.field_labels FOR INSERT
  TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update field_labels"
  ON public.field_labels FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete field_labels"
  ON public.field_labels FOR DELETE
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_field_labels_updated
  BEFORE UPDATE ON public.field_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 4. field_options 정책 강화 (수정/삭제는 admin만) =====
DROP POLICY IF EXISTS "Authenticated can update field_options" ON public.field_options;
DROP POLICY IF EXISTS "Authenticated can delete field_options" ON public.field_options;
DROP POLICY IF EXISTS "Authenticated can insert field_options" ON public.field_options;

CREATE POLICY "Admins can insert field_options"
  ON public.field_options FOR INSERT
  TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update field_options"
  ON public.field_options FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete field_options"
  ON public.field_options FOR DELETE
  TO authenticated USING (public.is_admin(auth.uid()));

-- ===== 5. 초기 데이터 =====
-- 기존 두 사용자를 admin으로
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('1d19490f-b4ad-4d9e-84b8-62acb48590be', 'admin'),
  ('09894e28-5a88-4dc1-b505-a6a0a606d4aa', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 기본 위젯/목표치 설정
INSERT INTO public.app_settings (key, value, description) VALUES
  ('dashboard.widgets', '{"stat_cards":true,"performance_chart":true,"channel_donut":true,"mobile_breakdown":true,"strategy_gauges":true,"channel_matrix":true,"ranking_panel":true,"recent_activities":true}'::jsonb, '대시보드 위젯 표시 여부'),
  ('targets.strategy_product_share', '40'::jsonb, '전략상품 비중 목표 (%)'),
  ('targets.monthly_activations', '500'::jsonb, '월별 신규 개통 목표 건수')
ON CONFLICT (key) DO NOTHING;