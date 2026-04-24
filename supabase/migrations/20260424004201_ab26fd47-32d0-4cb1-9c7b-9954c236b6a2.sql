-- 1) 이미 가입된 h860306@naver.com 사용자에게 admin 권한 + active 상태 부여
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'h860306@naver.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    -- profile active 처리
    UPDATE public.profiles SET status = 'active' WHERE user_id = v_uid;
    -- profile 없으면 생성
    INSERT INTO public.profiles (user_id, display_name, status)
    SELECT v_uid, 'h860306', 'active'
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid);
    -- admin 역할 부여
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 2) 미가입 상태일 경우를 대비해, 해당 이메일이 가입하면 자동으로 admin + active 부여
CREATE OR REPLACE FUNCTION public.auto_grant_admin_h860306()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'h860306@naver.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET status = 'active' WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_grant_admin_h860306_trg ON auth.users;
CREATE TRIGGER auto_grant_admin_h860306_trg
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin_h860306();