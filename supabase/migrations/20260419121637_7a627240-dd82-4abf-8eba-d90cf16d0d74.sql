-- 메뉴 그룹(대분류) 테이블
CREATE TABLE public.menu_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Folder',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','manager','user']::text[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 메뉴 항목(소분류) 테이블
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.menu_groups(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Circle',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','manager','user']::text[],
  active BOOLEAN NOT NULL DEFAULT true,
  is_admin_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_group ON public.menu_items(group_id);
CREATE INDEX idx_menu_items_sort ON public.menu_items(sort_order);
CREATE INDEX idx_menu_groups_sort ON public.menu_groups(sort_order);

ALTER TABLE public.menu_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view menu_groups" ON public.menu_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert menu_groups" ON public.menu_groups
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update menu_groups" ON public.menu_groups
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins delete menu_groups" ON public.menu_groups
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated can view menu_items" ON public.menu_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert menu_items" ON public.menu_items
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update menu_items" ON public.menu_items
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins delete menu_items" ON public.menu_items
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_menu_groups_updated BEFORE UPDATE ON public.menu_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 기본 메뉴 시드 (현재 사이드바 구조 그대로)
INSERT INTO public.menu_groups (name, icon, sort_order, visible_roles) VALUES
  ('대시보드', 'LayoutDashboard', 10, ARRAY['admin','manager','user']),
  ('영업 관리', 'PlusCircle', 20, ARRAY['admin','manager','user']),
  ('마케팅', 'Megaphone', 30, ARRAY['admin','manager','user']),
  ('현황 / 랭킹', 'Trophy', 40, ARRAY['admin','manager','user']),
  ('재고 / 마스터', 'Smartphone', 50, ARRAY['admin','manager','user']),
  ('시스템', 'ShieldCheck', 60, ARRAY['admin']);

WITH g AS (SELECT id, name FROM public.menu_groups)
INSERT INTO public.menu_items (group_id, label, path, icon, sort_order, visible_roles, is_admin_only)
SELECT g.id, x.label, x.path, x.icon, x.sort_order, x.visible_roles, x.is_admin_only
FROM (VALUES
  ('대시보드', '대시보드', '/', 'LayoutDashboard', 10, ARRAY['admin','manager','user'], false),
  ('영업 관리', '실적 입력', '/input', 'PlusCircle', 10, ARRAY['admin','manager','user'], false),
  ('영업 관리', '단골 관리', '/regulars', 'HeartHandshake', 20, ARRAY['admin','manager','user'], false),
  ('영업 관리', '활동 관리', '/activities', 'Activity', 30, ARRAY['admin','manager','user'], false),
  ('영업 관리', '최근 영업활동', '/recent-activities', 'History', 40, ARRAY['admin','manager','user'], false),
  ('마케팅', '지출 / ROI', '/expenses', 'Wallet', 10, ARRAY['admin','manager','user'], false),
  ('마케팅', '지출 비용 입력', '/expense-input', 'Megaphone', 20, ARRAY['admin','manager','user'], false),
  ('마케팅', '광고 캘린더', '/ad-calendar', 'CalendarRange', 30, ARRAY['admin','manager','user'], false),
  ('현황 / 랭킹', '랭킹', '/ranking', 'Trophy', 10, ARRAY['admin','manager','user'], false),
  ('현황 / 랭킹', '직원별 현황', '/staff-status', 'UserCog', 20, ARRAY['admin','manager','user'], false),
  ('재고 / 마스터', '단말기 재고', '/device-inventory', 'Smartphone', 10, ARRAY['admin','manager','user'], false),
  ('재고 / 마스터', '입력 항목 관리', '/field-options', 'Settings2', 20, ARRAY['admin','manager','user'], false),
  ('재고 / 마스터', '권한 / 뷰', '/team', 'Users', 30, ARRAY['admin','manager','user'], false),
  ('시스템', '매장 관리', '/stores', 'Store', 10, ARRAY['admin'], true),
  ('시스템', '상품-요금제 매핑', '/product-rate-plans', 'Link2', 20, ARRAY['admin'], true),
  ('시스템', '시스템 설정', '/admin', 'ShieldCheck', 30, ARRAY['admin'], true),
  ('시스템', '메뉴 설정', '/admin/menu', 'ListTree', 40, ARRAY['admin'], true)
) AS x(group_name, label, path, icon, sort_order, visible_roles, is_admin_only)
JOIN g ON g.name = x.group_name;