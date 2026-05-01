ALTER TABLE public.regulars ADD COLUMN IF NOT EXISTS carrier text;
CREATE INDEX IF NOT EXISTS idx_regulars_carrier ON public.regulars(carrier);