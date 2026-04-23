
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS retry_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fail_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_action_at timestamptz DEFAULT now();

UPDATE public.inquiries SET last_action_at = updated_at WHERE last_action_at IS NULL;

CREATE TABLE IF NOT EXISTS public.inquiry_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id uuid NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT '메모',
  content text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inquiry_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view inquiry_logs"
  ON public.inquiry_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own inquiry_logs"
  ON public.inquiry_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner or admin delete inquiry_logs"
  ON public.inquiry_logs FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_inquiry_logs_inquiry_id ON public.inquiry_logs(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_last_action ON public.inquiries(last_action_at);

CREATE OR REPLACE FUNCTION public.update_inquiry_last_action()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.inquiries SET last_action_at = now() WHERE id = NEW.inquiry_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER tg_inquiry_log_action
  AFTER INSERT ON public.inquiry_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_inquiry_last_action();
