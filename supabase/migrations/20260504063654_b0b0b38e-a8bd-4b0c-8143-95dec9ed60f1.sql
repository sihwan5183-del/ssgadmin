-- master_audit_log
DROP POLICY IF EXISTS "Authenticated can view master_audit" ON public.master_audit_log;
CREATE POLICY "Admins view master_audit" ON public.master_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));
CREATE POLICY "Users view own master_audit" ON public.master_audit_log
  FOR SELECT TO authenticated
  USING (changed_by = auth.uid());

-- sales_audit_log
DROP POLICY IF EXISTS "Authenticated can view audit" ON public.sales_audit_log;
CREATE POLICY "Scoped sales_audit_log read" ON public.sales_audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sales_audit_log.sale_id
        AND public.can_view_user_data(auth.uid(), s.created_by)
    )
  );

-- inquiry_logs
DROP POLICY IF EXISTS "Authenticated can view inquiry_logs" ON public.inquiry_logs;
CREATE POLICY "Scoped inquiry_logs read" ON public.inquiry_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_logs.inquiry_id
        AND public.can_view_user_data(auth.uid(), i.created_by)
    )
  );

-- sale_documents (table)
DROP POLICY IF EXISTS "Authenticated can read sale_documents" ON public.sale_documents;
DROP POLICY IF EXISTS "Authenticated can read sale-documents" ON public.sale_documents;
CREATE POLICY "Scoped sale_documents read" ON public.sale_documents
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_documents.sale_id
        AND public.can_view_user_data(auth.uid(), s.created_by)
    )
  );

-- sale-documents storage bucket: scope to sale ownership via path prefix (sale_id/...)
DROP POLICY IF EXISTS "Authenticated can read sale-documents" ON storage.objects;
CREATE POLICY "Scoped sale-documents storage read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sale-documents'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.sale_documents sd
        JOIN public.sales s ON s.id = sd.sale_id
        WHERE sd.storage_path = storage.objects.name
          AND public.can_view_user_data(auth.uid(), s.created_by)
      )
    )
  );