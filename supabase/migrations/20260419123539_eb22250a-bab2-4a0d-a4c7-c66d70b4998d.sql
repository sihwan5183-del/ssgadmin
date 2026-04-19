-- 1) device_models 컬럼 확장
ALTER TABLE public.device_models
  ADD COLUMN IF NOT EXISTS official_name text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS device_models_model_name_lower_idx
  ON public.device_models (lower(model_name));
CREATE INDEX IF NOT EXISTS device_models_official_name_lower_idx
  ON public.device_models (lower(official_name));
CREATE INDEX IF NOT EXISTS device_models_aliases_gin_idx
  ON public.device_models USING gin (aliases);

-- 2) 정규화 함수 (입력값 → 등록된 펫네임)
CREATE OR REPLACE FUNCTION public.normalize_device_model(_raw text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
  v_norm text;
  v_pet text;
BEGIN
  IF _raw IS NULL OR length(trim(_raw)) = 0 THEN
    RETURN NULL;
  END IF;
  v := lower(trim(_raw));
  v_norm := regexp_replace(v, '[\s\-_]+', '', 'g');

  -- 정확한 펫네임
  SELECT model_name INTO v_pet
    FROM public.device_models
   WHERE active = true
     AND lower(model_name) = v
   LIMIT 1;
  IF v_pet IS NOT NULL THEN RETURN v_pet; END IF;

  -- 정확한 공식명
  SELECT model_name INTO v_pet
    FROM public.device_models
   WHERE active = true
     AND official_name IS NOT NULL
     AND lower(official_name) = v
   LIMIT 1;
  IF v_pet IS NOT NULL THEN RETURN v_pet; END IF;

  -- 유사어 정확매치 (대소문자 무시)
  SELECT model_name INTO v_pet
    FROM public.device_models
   WHERE active = true
     AND EXISTS (
       SELECT 1 FROM unnest(aliases) a
        WHERE lower(a) = v OR regexp_replace(lower(a), '[\s\-_]+', '', 'g') = v_norm
     )
   LIMIT 1;
  IF v_pet IS NOT NULL THEN RETURN v_pet; END IF;

  -- 부분일치: 입력값이 펫네임/공식명/유사어를 포함하거나, 그 반대
  SELECT model_name INTO v_pet
    FROM public.device_models
   WHERE active = true
     AND (
       v LIKE '%' || lower(model_name) || '%'
       OR lower(model_name) LIKE '%' || v || '%'
       OR (official_name IS NOT NULL AND v LIKE '%' || lower(official_name) || '%')
       OR (official_name IS NOT NULL AND lower(official_name) LIKE '%' || v || '%')
       OR EXISTS (
         SELECT 1 FROM unnest(aliases) a
          WHERE v LIKE '%' || lower(a) || '%' OR lower(a) LIKE '%' || v || '%'
       )
     )
   ORDER BY length(model_name) DESC
   LIMIT 1;

  RETURN v_pet; -- 못찾으면 NULL
END;
$$;

-- 3) sales 자동 정규화 트리거
CREATE OR REPLACE FUNCTION public.auto_normalize_sale_model()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet text;
BEGIN
  IF NEW.device_model IS NOT NULL AND length(trim(NEW.device_model)) > 0 THEN
    v_pet := public.normalize_device_model(NEW.device_model);
    IF v_pet IS NOT NULL THEN
      NEW.device_model := v_pet;
      IF NEW.custom_fields ? 'unmapped_model' THEN
        NEW.custom_fields := NEW.custom_fields - 'unmapped_model';
      END IF;
    ELSE
      NEW.custom_fields := COALESCE(NEW.custom_fields, '{}'::jsonb)
        || jsonb_build_object('unmapped_model', NEW.device_model);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_auto_normalize_model ON public.sales;
CREATE TRIGGER sales_auto_normalize_model
  BEFORE INSERT OR UPDATE OF device_model ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_normalize_sale_model();

-- 4) device_inventory 자동 정규화 트리거
CREATE OR REPLACE FUNCTION public.auto_normalize_inventory_model()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet text;
BEGIN
  IF NEW.model IS NOT NULL AND length(trim(NEW.model)) > 0 THEN
    v_pet := public.normalize_device_model(NEW.model);
    IF v_pet IS NOT NULL THEN
      NEW.model := v_pet;
      IF NEW.custom_fields ? 'unmapped_model' THEN
        NEW.custom_fields := NEW.custom_fields - 'unmapped_model';
      END IF;
    ELSE
      NEW.custom_fields := COALESCE(NEW.custom_fields, '{}'::jsonb)
        || jsonb_build_object('unmapped_model', NEW.model);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_auto_normalize_model ON public.device_inventory;
CREATE TRIGGER inventory_auto_normalize_model
  BEFORE INSERT OR UPDATE OF model ON public.device_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_normalize_inventory_model();