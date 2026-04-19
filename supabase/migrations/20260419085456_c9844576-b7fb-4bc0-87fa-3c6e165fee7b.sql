
-- ============================================================
-- 1. device_inventory: 상태 확장 + stock_in_date 기본값 보장
--    (stock_in_date 컬럼은 이미 존재 — 기본 CURRENT_DATE 유지)
--    상태값: '재고' | '판매중' | '개통완료' | '이동중'
-- ============================================================
-- 현재 위치(매장) 컬럼 추가
ALTER TABLE public.device_inventory
  ADD COLUMN IF NOT EXISTS current_store_id UUID,
  ADD COLUMN IF NOT EXISTS activated_sale_id UUID,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_device_inventory_serial ON public.device_inventory (serial_no);
CREATE INDEX IF NOT EXISTS idx_device_inventory_status ON public.device_inventory (status);
CREATE INDEX IF NOT EXISTS idx_device_inventory_stock_in_date ON public.device_inventory (stock_in_date);

-- ============================================================
-- 2. 매장 마스터
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  region TEXT,
  manager TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stores"
  ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert stores"
  ON public.stores FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update stores"
  ON public.stores FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins delete stores"
  ON public.stores FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. 재고 이동 (transfer) + 승인
-- ============================================================
CREATE TABLE IF NOT EXISTS public.device_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.device_inventory(id) ON DELETE CASCADE,
  from_store_id UUID REFERENCES public.stores(id),
  to_store_id UUID NOT NULL REFERENCES public.stores(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | cancelled
  reason TEXT,
  requested_by UUID NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view transfers"
  ON public.device_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can request transfers"
  ON public.device_transfers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "Owner or admin update transfers"
  ON public.device_transfers FOR UPDATE TO authenticated
  USING (auth.uid() = requested_by OR is_admin(auth.uid()));
CREATE POLICY "Owner or admin delete transfers"
  ON public.device_transfers FOR DELETE TO authenticated
  USING (auth.uid() = requested_by OR is_admin(auth.uid()));

CREATE TRIGGER update_device_transfers_updated_at
  BEFORE UPDATE ON public.device_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_transfers_device ON public.device_transfers (device_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.device_transfers (status);

-- ============================================================
-- 4. 트리거: 이동 승인 시 device.current_store_id 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_transfer_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.device_inventory
       SET current_store_id = NEW.to_store_id,
           status = CASE WHEN status = '이동중' THEN '재고' ELSE status END
     WHERE id = NEW.device_id;
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_transfer ON public.device_transfers;
CREATE TRIGGER trg_apply_transfer
  BEFORE UPDATE ON public.device_transfers
  FOR EACH ROW EXECUTE FUNCTION public.apply_transfer_on_approval();

-- 새 이동 요청이 pending이면 device 상태를 '이동중'으로 표시
CREATE OR REPLACE FUNCTION public.mark_device_in_transit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    UPDATE public.device_inventory
       SET status = '이동중'
     WHERE id = NEW.device_id AND status = '재고';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_in_transit ON public.device_transfers;
CREATE TRIGGER trg_mark_in_transit
  AFTER INSERT ON public.device_transfers
  FOR EACH ROW EXECUTE FUNCTION public.mark_device_in_transit();

-- ============================================================
-- 5. 트리거: sales 저장 시 device_serial 매칭 → 자동 '개통완료'
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_device_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id UUID;
BEGIN
  IF NEW.device_serial IS NOT NULL AND length(trim(NEW.device_serial)) > 0 THEN
    SELECT id INTO v_device_id
      FROM public.device_inventory
     WHERE serial_no = NEW.device_serial
     LIMIT 1;
    IF v_device_id IS NOT NULL THEN
      UPDATE public.device_inventory
         SET status = '개통완료',
             activated_sale_id = NEW.id,
             activated_at = now()
       WHERE id = v_device_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_device_on_sale ON public.sales;
CREATE TRIGGER trg_sync_device_on_sale
  AFTER INSERT OR UPDATE OF device_serial, status ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sync_device_on_sale();

-- ============================================================
-- 6. 장기 재고 기준 + 자산 평균단가(폴백) 설정
-- ============================================================
INSERT INTO public.app_settings (key, value, description)
VALUES
  ('inventory.aging_days', '60'::jsonb, '장기 재고 강조 기준 일수 (관리자 조정 가능)'),
  ('inventory.fallback_unit_price', '0'::jsonb, '매입가가 비어있을 때 자산 합계 계산용 폴백 단가(원)')
ON CONFLICT (key) DO NOTHING;
