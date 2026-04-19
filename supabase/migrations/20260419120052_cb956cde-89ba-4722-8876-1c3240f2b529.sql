ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS revision_fields TEXT[],
  ADD COLUMN IF NOT EXISTS revision_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revision_requested_by UUID,
  ADD COLUMN IF NOT EXISTS re_review_requested_at TIMESTAMPTZ;

-- Replace approval-change notification to include revision context
CREATE OR REPLACE FUNCTION public.notify_sale_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_msg TEXT;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
    v_msg := COALESCE(NEW.customer_name, '고객') || ' · ' || COALESCE(NEW.device_model, '');
    IF NEW.approval_status IN ('반려','수정요청') AND NEW.revision_reason IS NOT NULL THEN
      v_msg := v_msg || ' · 사유: ' || NEW.revision_reason;
    END IF;
    INSERT INTO public.notifications (recipient_id, kind, title, message, link, metadata)
    VALUES (
      NEW.created_by,
      'sale_approval',
      '실적 상태 변경: ' || NEW.approval_status,
      v_msg,
      '/activities?sale=' || NEW.id,
      jsonb_build_object(
        'sale_id', NEW.id,
        'status', NEW.approval_status,
        'revision_fields', NEW.revision_fields,
        'revision_reason', NEW.revision_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Notify admins when staff requests re-review
CREATE OR REPLACE FUNCTION public.notify_admins_on_re_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.re_review_requested_at IS DISTINCT FROM OLD.re_review_requested_at
     AND NEW.re_review_requested_at IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, kind, title, message, link, metadata)
    SELECT
      ur.user_id,
      're_review_requested',
      '재검수 요청',
      COALESCE(NEW.customer_name, '고객') || ' · ' || COALESCE(NEW.device_model, '') || ' 의 재검수가 요청되었습니다',
      '/activities?sale=' || NEW.id,
      jsonb_build_object('sale_id', NEW.id)
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND ur.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_re_review ON public.sales;
CREATE TRIGGER trg_notify_re_review
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_re_review();