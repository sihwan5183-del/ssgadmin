-- 1. profiles 테이블 (담당자 정보)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  team TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated"
  ON public.profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

-- 2. updated_at 트리거 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. 신규 가입 시 profile 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. sales 테이블 (엑셀 '실적장표' 1행 = 1건)
CREATE TABLE public.sales (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 기본정보
  seq INTEGER,
  channel TEXT,                    -- 인입경로 (모요, 유닥, 오프라인, 캠페인 등)
  moyo_excluded BOOLEAN DEFAULT false, -- 모요 미적용
  manager TEXT,                    -- 담당자명
  open_month TEXT,                 -- 개통년월

  -- 가입정보
  product TEXT,                    -- 가입상품 (모바일/USIM MNP/세컨/홈/IOT/대명/TV프리/인터넷)
  sale_type TEXT,                  -- 판매유형 (MNP/신규/기변/USIM MNP)
  bundle TEXT,                     -- 동판/번들
  open_method TEXT,                -- 개통방식 (선개통/후개통)
  status TEXT DEFAULT '개통완료',   -- 최종상태
  open_date DATE,                  -- 개통일자
  customer_name TEXT,              -- 고객명
  birth_date TEXT,                 -- 생년월일 (6자리 텍스트)
  phone TEXT,                      -- 연락처
  device_model TEXT,               -- 단말기
  device_serial TEXT,              -- 단말 일련번호
  usim_model TEXT,                 -- USIM
  usim_serial TEXT,                -- USIM 일련번호
  rate_plan TEXT,                  -- 개통요금제
  vas1 TEXT,                       -- 부가서비스1
  vas2 TEXT,                       -- 부가서비스2

  -- 수익성
  unit_price NUMERIC DEFAULT 0,    -- 단가표 기준 (리베이트)
  vas_fee NUMERIC DEFAULT 0,       -- VAS 수수료
  voucher TEXT,                    -- 상품권
  voucher_returned TEXT,           -- 반납 유/무

  -- 미수금
  receivable_amount NUMERIC DEFAULT 0,
  receivable_paid TEXT,            -- 입금 유/무

  -- 그 외 지원금
  cash_open BOOLEAN DEFAULT false, -- 현금개통
  distributor_amount NUMERIC DEFAULT 0,  -- 유통망 지원금
  extra_subsidy NUMERIC DEFAULT 0,       -- 추가지원금

  -- 현금지원금 (고객에게 입금)
  cash_support_amount NUMERIC DEFAULT 0, -- 입금금액
  cash_bank TEXT,                        -- 은행
  cash_account TEXT,                     -- 입금계좌
  cash_holder TEXT,                      -- 예금주

  -- 최종
  net_fee NUMERIC DEFAULT 0,       -- 최종 수수료(순수익)

  -- 배송현황
  delivery_type TEXT,              -- 발송유형 (택배/매장방문/퀵배송/직접전달)
  tracking_no TEXT,                -- 운송장
  note TEXT,                       -- 특이사항

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_created_by ON public.sales(created_by);
CREATE INDEX idx_sales_open_date ON public.sales(open_date DESC);
CREATE INDEX idx_sales_channel ON public.sales(channel);
CREATE INDEX idx_sales_product ON public.sales(product);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- 로그인한 모든 팀원은 모두 조회 가능
CREATE POLICY "Authenticated can view all sales"
  ON public.sales FOR SELECT
  TO authenticated USING (true);

-- 본인만 작성/수정/삭제
CREATE POLICY "Users insert own sales"
  ON public.sales FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own sales"
  ON public.sales FOR UPDATE
  TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users delete own sales"
  ON public.sales FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER trg_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();