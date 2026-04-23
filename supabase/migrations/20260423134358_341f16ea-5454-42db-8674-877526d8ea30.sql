
-- 1. Allow 'pending' status in profiles validation trigger
CREATE OR REPLACE FUNCTION public.validate_profile_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('active','leave','resigned','pending') THEN
    RAISE EXCEPTION '유효하지 않은 상태값: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Change default profile status to 'pending' for new signups
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Update handle_new_user to set status='pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), 'pending');
  RETURN NEW;
END; $function$;

-- 4. Update is_user_active to reject 'pending' users
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT status = 'active' FROM public.profiles WHERE user_id = _user_id LIMIT 1),
    false
  );
$function$;

-- 5. Add active_sessions table for single-session enforcement
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_token text NOT NULL,
  device_label text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own session" ON public.active_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own session" ON public.active_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own session" ON public.active_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own session" ON public.active_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
