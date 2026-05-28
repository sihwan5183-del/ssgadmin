
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS registration_date text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS branch_name text,
  ADD COLUMN IF NOT EXISTS activation_status text,
  ADD COLUMN IF NOT EXISTS cancellation_status text,
  ADD COLUMN IF NOT EXISTS activation_number text;

CREATE INDEX IF NOT EXISTS idx_leads_campaign_name ON public.leads(campaign_name);
