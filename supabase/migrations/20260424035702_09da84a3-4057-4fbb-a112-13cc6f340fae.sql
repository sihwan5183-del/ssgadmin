CREATE OR REPLACE FUNCTION public.auto_grant_admin_h860306()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(NEW.email) = 'udka@daum.net' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET status = 'active' WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;