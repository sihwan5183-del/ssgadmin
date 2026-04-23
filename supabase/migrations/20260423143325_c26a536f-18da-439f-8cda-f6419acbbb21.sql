
-- Add 판매원장 menu item under 영업 관리 group
INSERT INTO public.menu_items (group_id, label, path, icon, sort_order, visible_roles, active, is_admin_only)
VALUES ('33e4e639-acc5-42cf-bc31-b9fa06184ce9', '판매원장 관리', '/sales-ledger', 'FileText', 5, ARRAY['admin','manager','user'], true, false);

-- Update 실적 입력 icon to PlusCircle and sort_order to 0 (already correct, but ensure)
UPDATE public.menu_items SET icon = 'PlusCircle', sort_order = 0 WHERE path = '/input';

-- Update sort orders for 영업 관리 group items
UPDATE public.menu_items SET sort_order = 10 WHERE path = '/channel-intake';
UPDATE public.menu_items SET sort_order = 20 WHERE path = '/regulars';
UPDATE public.menu_items SET sort_order = 30 WHERE path = '/activities';
UPDATE public.menu_items SET sort_order = 40 WHERE path = '/recent-activities';
