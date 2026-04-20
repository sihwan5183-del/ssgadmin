
-- Magic link tokens: short-lived login approval links (3 min TTL)
CREATE TABLE public.magic_link_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'login', -- 'login' | 'admin_override'
  issued_by UUID, -- admin user_id when purpose='admin_override'
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX idx_mlt_user ON public.magic_link_tokens(user_id);
CREATE INDEX idx_mlt_expires ON public.magic_link_tokens(expires_at);

ALTER TABLE public.magic_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tokens"
  ON public.magic_link_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Admins delete tokens"
  ON public.magic_link_tokens FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) OR auth.uid() = user_id);

-- Trusted devices: 30-day "remember me" cookies
CREATE TABLE public.trusted_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT,
  user_agent TEXT,
  ip TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_td_user ON public.trusted_devices(user_id);
CREATE INDEX idx_td_expires ON public.trusted_devices(expires_at);

ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices"
  ON public.trusted_devices FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users delete own devices"
  ON public.trusted_devices FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Auth attempts log
CREATE TABLE public.auth_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT,
  kind TEXT NOT NULL, -- 'password' | 'magic_link_request' | 'magic_link_consume' | 'trusted_device'
  success BOOLEAN NOT NULL DEFAULT false,
  ip TEXT,
  user_agent TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_aa_user ON public.auth_attempts(user_id);
CREATE INDEX idx_aa_created ON public.auth_attempts(created_at DESC);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attempts"
  ON public.auth_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));
