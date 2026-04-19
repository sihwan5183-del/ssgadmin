-- Add approval/lock fields to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT '승인대기',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- Constrain values
DO $$ BEGIN
  ALTER TABLE public.sales
    ADD CONSTRAINT sales_approval_status_chk
    CHECK (approval_status IN ('승인대기','확정','환수','취소'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_sales_approval_status ON public.sales(approval_status);

-- Trigger: when status set to 확정, lock; clear lock when reverted (admin only via RLS)
CREATE OR REPLACE FUNCTION public.sync_sale_lock_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NEW.approval_status = '확정' THEN
      NEW.locked := true;
      NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
      NEW.approved_at := COALESCE(NEW.approved_at, now());
    ELSE
      NEW.locked := false;
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_lock ON public.sales;
CREATE TRIGGER trg_sync_sale_lock
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_sale_lock_on_approval();

-- Replace RLS update/delete policies to enforce lock for non-admins
DROP POLICY IF EXISTS "Users update own sales" ON public.sales;
DROP POLICY IF EXISTS "Users delete own sales" ON public.sales;

CREATE POLICY "Users update own unlocked or admin"
  ON public.sales
  FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (auth.uid() = created_by AND locked = false)
  );

CREATE POLICY "Users delete own unlocked or admin"
  ON public.sales
  FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR (auth.uid() = created_by AND locked = false)
  );

-- Notify creator when their sale is approved/changed status
CREATE OR REPLACE FUNCTION public.notify_sale_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (recipient_id, kind, title, message, link, metadata)
    VALUES (
      NEW.created_by,
      'sale_approval',
      '실적 상태 변경: ' || NEW.approval_status,
      COALESCE(NEW.customer_name, '고객') || ' · ' || COALESCE(NEW.device_model, ''),
      '/activities?sale=' || NEW.id,
      jsonb_build_object('sale_id', NEW.id, 'status', NEW.approval_status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sale_approval ON public.sales;
CREATE TRIGGER trg_notify_sale_approval
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sale_approval_change();