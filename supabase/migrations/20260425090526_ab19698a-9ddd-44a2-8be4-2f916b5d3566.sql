ALTER TABLE public.sales DISABLE TRIGGER trg_log_sales_changes;
DELETE FROM public.sales_audit_log WHERE sale_id IN (SELECT id FROM public.sales WHERE created_by = '1d19490f-b4ad-4d9e-84b8-62acb48590be'::uuid);
DELETE FROM public.sale_documents WHERE sale_id IN (SELECT id FROM public.sales WHERE created_by = '1d19490f-b4ad-4d9e-84b8-62acb48590be'::uuid);
DELETE FROM public.sales WHERE created_by = '1d19490f-b4ad-4d9e-84b8-62acb48590be'::uuid;
ALTER TABLE public.sales ENABLE TRIGGER trg_log_sales_changes;