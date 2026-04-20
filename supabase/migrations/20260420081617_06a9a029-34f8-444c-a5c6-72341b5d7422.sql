-- 1) device_inventory에 device_kind(재고유형) 컬럼 추가 ('휴대폰' | 'IoT(도그마루)')
ALTER TABLE public.device_inventory
  ADD COLUMN IF NOT EXISTS device_kind text NOT NULL DEFAULT '휴대폰';

CREATE INDEX IF NOT EXISTS idx_device_inventory_kind ON public.device_inventory(device_kind);

-- 2) serial_no 정규화 + 활성 재고 내 중복 방지 (개통완료/반품 제외)
-- 정규화 함수: 공백/하이픈/제어문자 제거 후 대문자
CREATE OR REPLACE FUNCTION public.normalize_serial_no(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(upper(regexp_replace(coalesce(_raw,''), '[\s\-_\u0000-\u001F]+', '', 'g')), '');
$$;

-- 트리거: serial_no를 INSERT/UPDATE 시 정규화
CREATE OR REPLACE FUNCTION public.tg_normalize_inventory_serial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.serial_no IS NOT NULL THEN
    NEW.serial_no := public.normalize_serial_no(NEW.serial_no);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_inventory_serial ON public.device_inventory;
CREATE TRIGGER trg_normalize_inventory_serial
BEFORE INSERT OR UPDATE OF serial_no ON public.device_inventory
FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_inventory_serial();

-- 활성 재고 중복 방지 (개통완료/반품/불량 제외한 상태들끼리만 unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_inventory_active_serial
  ON public.device_inventory (serial_no)
  WHERE serial_no IS NOT NULL
    AND status NOT IN ('개통완료','판매완료','반품','반납','불량');

-- 3) field_options 시드 (device_kind, status 신규값)
INSERT INTO public.field_options (field, value, sort_order, active) VALUES
  ('device_kind', '휴대폰', 10, true),
  ('device_kind', 'IoT(도그마루)', 20, true)
ON CONFLICT DO NOTHING;

-- 신규 status 옵션: 입고 / 반납 / 불량 (기존 재고/판매중/이동중/개통완료/반품 보존)
INSERT INTO public.field_options (field, value, sort_order, active) VALUES
  ('inventory_status', '입고', 5, true),
  ('inventory_status', '재고', 10, true),
  ('inventory_status', '판매중', 20, true),
  ('inventory_status', '이동중', 30, true),
  ('inventory_status', '개통완료', 40, true),
  ('inventory_status', '반품', 50, true),
  ('inventory_status', '반납', 60, true),
  ('inventory_status', '불량', 70, true)
ON CONFLICT DO NOTHING;

-- 4) sync_device_on_sale: 정규화된 serial로 매칭하도록 보강
CREATE OR REPLACE FUNCTION public.sync_device_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id UUID;
  v_norm text;
BEGIN
  IF NEW.device_serial IS NOT NULL AND length(trim(NEW.device_serial)) > 0 THEN
    v_norm := public.normalize_serial_no(NEW.device_serial);
    SELECT id INTO v_device_id
      FROM public.device_inventory
     WHERE serial_no = v_norm
     LIMIT 1;
    IF v_device_id IS NOT NULL THEN
      UPDATE public.device_inventory
         SET status = '판매완료',
             activated_sale_id = NEW.id,
             activated_at = now()
       WHERE id = v_device_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;