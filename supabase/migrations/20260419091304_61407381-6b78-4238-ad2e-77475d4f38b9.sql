-- 1) 휴대폰 모델 마스터
CREATE TABLE IF NOT EXISTS public.device_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer text NOT NULL DEFAULT '',
  model_name text NOT NULL,
  retail_price numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manufacturer, model_name)
);

CREATE INDEX IF NOT EXISTS idx_device_models_active ON public.device_models(active);

ALTER TABLE public.device_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view device_models"
  ON public.device_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert device_models"
  ON public.device_models FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update device_models"
  ON public.device_models FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins delete device_models"
  ON public.device_models FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_device_models_updated_at
  BEFORE UPDATE ON public.device_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) 통합 시스템 로그 (마스터 데이터 변경)
CREATE TABLE IF NOT EXISTS public.master_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_master_audit_table ON public.master_audit_log(table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_master_audit_at ON public.master_audit_log(changed_at DESC);

ALTER TABLE public.master_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view master_audit"
  ON public.master_audit_log FOR SELECT TO authenticated USING (true);

-- 범용 로깅 함수
CREATE OR REPLACE FUNCTION public.log_master_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_old jsonb;
  v_new jsonb;
  v_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'key');
    INSERT INTO public.master_audit_log (table_name, record_id, action, changed_by, changes)
    VALUES (TG_TABLE_NAME, v_id, 'INSERT', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key IN ('updated_at') THEN CONTINUE; END IF;
      IF (v_old->v_key) IS DISTINCT FROM (v_new->v_key) THEN
        v_changes := v_changes || jsonb_build_object(v_key,
          jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_changes <> '{}'::jsonb THEN
      v_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'key');
      INSERT INTO public.master_audit_log (table_name, record_id, action, changed_by, changes)
      VALUES (TG_TABLE_NAME, v_id, 'UPDATE', auth.uid(), v_changes);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_id := COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'key');
    INSERT INTO public.master_audit_log (table_name, record_id, action, changed_by, changes)
    VALUES (TG_TABLE_NAME, v_id, 'DELETE', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 마스터 테이블에 트리거 부착
DROP TRIGGER IF EXISTS trg_log_field_options ON public.field_options;
CREATE TRIGGER trg_log_field_options
  AFTER INSERT OR UPDATE OR DELETE ON public.field_options
  FOR EACH ROW EXECUTE FUNCTION public.log_master_changes();

DROP TRIGGER IF EXISTS trg_log_product_rate_plans ON public.product_rate_plans;
CREATE TRIGGER trg_log_product_rate_plans
  AFTER INSERT OR UPDATE OR DELETE ON public.product_rate_plans
  FOR EACH ROW EXECUTE FUNCTION public.log_master_changes();

DROP TRIGGER IF EXISTS trg_log_device_models ON public.device_models;
CREATE TRIGGER trg_log_device_models
  AFTER INSERT OR UPDATE OR DELETE ON public.device_models
  FOR EACH ROW EXECUTE FUNCTION public.log_master_changes();

DROP TRIGGER IF EXISTS trg_log_stores ON public.stores;
CREATE TRIGGER trg_log_stores
  AFTER INSERT OR UPDATE OR DELETE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.log_master_changes();

DROP TRIGGER IF EXISTS trg_log_app_settings ON public.app_settings;
CREATE TRIGGER trg_log_app_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_master_changes();

DROP TRIGGER IF EXISTS trg_log_field_definitions ON public.field_definitions;
CREATE TRIGGER trg_log_field_definitions
  AFTER INSERT OR UPDATE OR DELETE ON public.field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.log_master_changes();