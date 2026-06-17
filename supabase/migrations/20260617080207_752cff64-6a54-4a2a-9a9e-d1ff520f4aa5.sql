
-- sms_templates
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_templates TO authenticated;
GRANT ALL ON public.sms_templates TO service_role;
ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read sms_templates" ON public.sms_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage sms_templates" ON public.sms_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- lead_status_logs
CREATE TABLE IF NOT EXISTS public.lead_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_status_logs_lead_id_idx ON public.lead_status_logs(lead_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_status_logs TO authenticated;
GRANT ALL ON public.lead_status_logs TO service_role;
ALTER TABLE public.lead_status_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read lead_status_logs" ON public.lead_status_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert lead_status_logs" ON public.lead_status_logs FOR INSERT TO authenticated WITH CHECK (true);

-- leads new columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT,
  ADD COLUMN IF NOT EXISTS pkg_number TEXT;

-- sales new columns
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;
