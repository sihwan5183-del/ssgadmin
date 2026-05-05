-- 1) Drop the FK that prevents deleting sales when an AFTER DELETE audit trigger inserts a row
ALTER TABLE public.sales_audit_log
  DROP CONSTRAINT IF EXISTS sales_audit_log_sale_id_fkey;

-- 2) Allow sale_id to be nullable for historical audit rows whose parent is deleted
ALTER TABLE public.sales_audit_log
  ALTER COLUMN sale_id DROP NOT NULL;

-- 3) Ensure prior audit rows are cleaned up when a sale is deleted (in addition to the trigger logging the DELETE itself)
CREATE OR REPLACE FUNCTION public.cleanup_sales_audit_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sales_audit_log WHERE sale_id = OLD.id AND action <> 'DELETE';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_sales_audit ON public.sales;
CREATE TRIGGER trg_cleanup_sales_audit
BEFORE DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.cleanup_sales_audit_on_delete();
