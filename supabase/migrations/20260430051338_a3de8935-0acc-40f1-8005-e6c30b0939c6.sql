
-- 1. 결제수단(카드) 정보 컬럼 추가
ALTER TABLE public.ad_spend
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS card_name text,
  ADD COLUMN IF NOT EXISTS card_last4 text;

-- 2. 관리자도 모든 지출 내역 수정/삭제 가능하도록 RLS 정책 보강
DROP POLICY IF EXISTS "Users update own ad_spend" ON public.ad_spend;
DROP POLICY IF EXISTS "Users delete own ad_spend" ON public.ad_spend;

CREATE POLICY "Owners or admins update ad_spend"
ON public.ad_spend
FOR UPDATE
TO authenticated
USING ((auth.uid() = created_by) OR public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));

CREATE POLICY "Owners or admins delete ad_spend"
ON public.ad_spend
FOR DELETE
TO authenticated
USING ((auth.uid() = created_by) OR public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));
