CREATE TABLE public.quick_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  icon text NOT NULL DEFAULT 'ExternalLink',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quick_links" ON public.quick_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert quick_links" ON public.quick_links FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update quick_links" ON public.quick_links FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete quick_links" ON public.quick_links FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_quick_links_updated_at BEFORE UPDATE ON public.quick_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();