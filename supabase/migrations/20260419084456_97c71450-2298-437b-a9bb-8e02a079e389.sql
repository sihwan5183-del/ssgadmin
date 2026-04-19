
-- ============================================================
-- 1. 동적 필드 정의 테이블
-- ============================================================
CREATE TABLE public.field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,                 -- 'sales' | 'device_inventory' | 'ad_spend'
  field_key TEXT NOT NULL,                  -- 시스템 키 (snake_case)
  label TEXT NOT NULL,                      -- 화면 표시명
  field_type TEXT NOT NULL DEFAULT 'text',  -- text | number | date | select | boolean | textarea
  options JSONB DEFAULT '[]'::jsonb,        -- select 타입일 때 선택지
  required BOOLEAN NOT NULL DEFAULT false,
  visible_in_list BOOLEAN NOT NULL DEFAULT true,
  visible_in_form BOOLEAN NOT NULL DEFAULT true,
  section TEXT,                             -- '기본정보' | '결제' 등 그룹핑
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_value TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(table_name, field_key)
);

ALTER TABLE public.field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view field_definitions"
  ON public.field_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert field_definitions"
  ON public.field_definitions FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update field_definitions"
  ON public.field_definitions FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete field_definitions"
  ON public.field_definitions FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_field_definitions_updated_at
  BEFORE UPDATE ON public.field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. 엑셀 매핑 프리셋
-- ============================================================
CREATE TABLE public.excel_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,           -- 'sales' | 'device_inventory' | 'ad_spend'
  preset_name TEXT NOT NULL,
  mapping JSONB NOT NULL,             -- { "엑셀헤더명": "시스템필드키", ... }
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(table_name, preset_name)
);

ALTER TABLE public.excel_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view excel_mappings"
  ON public.excel_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert excel_mappings"
  ON public.excel_mappings FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin update excel_mappings"
  ON public.excel_mappings FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()));
CREATE POLICY "Owner or admin delete excel_mappings"
  ON public.excel_mappings FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE TRIGGER update_excel_mappings_updated_at
  BEFORE UPDATE ON public.excel_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. 각 데이터 테이블에 custom_fields JSONB 컬럼 추가
-- ============================================================
ALTER TABLE public.sales            ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.device_inventory ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ad_spend         ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sales_custom_fields            ON public.sales            USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_device_inventory_custom_fields ON public.device_inventory USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_ad_spend_custom_fields         ON public.ad_spend         USING GIN (custom_fields);

-- ============================================================
-- 4. 기본 수식 시드 (app_settings) — 사칙연산 변수만 사용
--    변수: unit_price, vas_fee, distributor_amount, extra_subsidy,
--          cash_support_amount, receivable_amount
-- ============================================================
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'formula.net_fee',
  '"unit_price + vas_fee - distributor_amount - extra_subsidy + cash_support_amount"'::jsonb,
  '실적 net_fee(순수익) 계산 수식. 변수: unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, receivable_amount'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value, description)
VALUES (
  'formula.variables',
  '["unit_price","vas_fee","distributor_amount","extra_subsidy","cash_support_amount","receivable_amount"]'::jsonb,
  '수식에서 사용 가능한 변수 목록 (sales 테이블의 숫자 컬럼)'
)
ON CONFLICT (key) DO NOTHING;
