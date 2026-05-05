ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS show_in_dashboard boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_show_in_dashboard
  ON public.profiles(show_in_dashboard)
  WHERE show_in_dashboard = true;