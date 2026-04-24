
-- 1) 슈퍼관리자 자동 부여 트리거: UDak@daum.net (대소문자 무관) 신규/기존 가입 시 admin 자동 부여 + active
CREATE OR REPLACE FUNCTION public.auto_grant_admin_udak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF lower(NEW.email) = 'udak@daum.net' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET status = 'active' WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_grant_admin_udak ON auth.users;
CREATE TRIGGER trg_auto_grant_admin_udak
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin_udak();

-- 2) 이미 udak@daum.net 으로 가입된 계정이 있다면 즉시 admin + active 부여
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'udak@daum.net' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET status = 'active' WHERE user_id = v_uid;
  END IF;
END$$;

-- 3) 기존 udak@udak.com 계정이 있다면 비활성(suspended) 처리하고 권한 회수
DO $$
DECLARE
  v_old uuid;
BEGIN
  SELECT id INTO v_old FROM auth.users WHERE lower(email) = 'udak@udak.com' LIMIT 1;
  IF v_old IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_old;
    UPDATE public.profiles SET status = 'suspended' WHERE user_id = v_old;
    -- ban
    UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = v_old;
  END IF;
END$$;
