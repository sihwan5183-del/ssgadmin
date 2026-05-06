CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own push tokens" ON public.user_push_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own push tokens" ON public.user_push_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "Users delete own push tokens" ON public.user_push_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()));
CREATE POLICY "Users update own push tokens" ON public.user_push_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user ON public.user_push_tokens(user_id);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;