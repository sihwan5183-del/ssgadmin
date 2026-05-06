ALTER TABLE public.regulars ADD COLUMN IF NOT EXISTS is_promotion boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_regulars_is_promotion ON public.regulars(is_promotion);