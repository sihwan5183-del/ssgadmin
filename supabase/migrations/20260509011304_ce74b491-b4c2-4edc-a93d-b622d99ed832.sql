-- 1. Remove overly permissive sale_documents SELECT policy
DROP POLICY IF EXISTS "Authenticated can view sale_documents" ON public.sale_documents;

-- 2. Lock down auth_attempts writes (admin/service-role only)
CREATE POLICY "Admins can insert auth_attempts"
ON public.auth_attempts FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update auth_attempts"
ON public.auth_attempts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete auth_attempts"
ON public.auth_attempts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Lock down magic_link_tokens INSERT/UPDATE (admin only; edge functions use service role and bypass RLS)
CREATE POLICY "Admins can insert magic_link_tokens"
ON public.magic_link_tokens FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update magic_link_tokens"
ON public.magic_link_tokens FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Restrict seg-files storage SELECT to file owner (folder = uid) or admins
DROP POLICY IF EXISTS "Auth view seg-files" ON storage.objects;

CREATE POLICY "Owner or admin view seg-files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'seg-files'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);
