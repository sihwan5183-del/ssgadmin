-- ============================================================
-- 영업 활동 리포트 — 사이드바 메뉴 추가 SQL (1단계)
-- 실행 위치: Supabase SQL Editor (프로젝트: ebggtghzqtxfylbhqfoh)
-- ============================================================
-- 주의: sort_order는 기존 "영업 관리" 그룹 다음, "단골 관리" 그룹 앞에 위치하도록 설정
-- 기존 메뉴 구조를 확인한 후 sort_order를 조정해야 할 수 있음
-- ============================================================

-- STEP 1: 기존 sort_order 확인 (실행 후 값 확인 필수)
SELECT id, name, sort_order FROM menu_groups ORDER BY sort_order;

-- ============================================================
-- STEP 2: 신규 메뉴 그룹 추가
-- sort_order는 "영업 관리" 그룹보다 1 높고, "단골 관리" 그룹보다 1 낮게 설정
-- 아래 예시는 sort_order=55 (영업 관리=50, 단골 관리=60 기준)
-- STEP 1 확인 후 실제 값으로 조정할 것
-- ============================================================

INSERT INTO menu_groups (id, name, icon, sort_order, visible_roles, active)
VALUES (
  gen_random_uuid(),
  '영업 활동 리포트',
  'BarChart3',         -- lucide-react 아이콘명
  55,                  -- ⚠ STEP 1 확인 후 조정
  ARRAY['admin', 'manager', 'user']::text[],
  true
)
ON CONFLICT DO NOTHING
RETURNING id, name, sort_order;

-- ============================================================
-- STEP 3: 위에서 반환된 group_id로 메뉴 아이템 추가
-- 아래 'REPLACE_WITH_GROUP_ID'를 STEP 2 반환값으로 교체
-- ============================================================

-- 먼저 방금 생성한 그룹 ID 조회
-- SELECT id FROM menu_groups WHERE name = '영업 활동 리포트';

-- 아이템 INSERT (group_id는 위 조회 결과로 교체)
DO $$
DECLARE
  v_group_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM menu_groups WHERE name = '영업 활동 리포트' LIMIT 1;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION '영업 활동 리포트 그룹을 찾을 수 없습니다. STEP 2를 먼저 실행하세요.';
  END IF;

  INSERT INTO menu_items (id, group_id, label, path, icon, sort_order, visible_roles, active, is_admin_only)
  VALUES
    (gen_random_uuid(), v_group_id, '내 업무 대시보드',  '/work-report/my-dashboard',   'LayoutDashboard', 1, ARRAY['admin','manager','user']::text[], true, false),
    (gen_random_uuid(), v_group_id, '팀 업무 현황',      '/work-report/team-dashboard',  'Users',           2, ARRAY['admin','manager','user']::text[], true, false),
    (gen_random_uuid(), v_group_id, '일일 업무보고',     '/work-report/daily-report',    'FileText',        3, ARRAY['admin','manager','user']::text[], true, false),
    (gen_random_uuid(), v_group_id, '활동 로그',         '/work-report/activity-logs',   'ClipboardList',   4, ARRAY['admin','manager','user']::text[], true, false),
    (gen_random_uuid(), v_group_id, '진행/지연 관리',    '/work-report/progress-delay',  'AlertCircle',     5, ARRAY['admin','manager','user']::text[], true, false),
    (gen_random_uuid(), v_group_id, '인센 예상',         '/work-report/incentive',       'Coins',           6, ARRAY['admin','manager','user']::text[], true, false),
    (gen_random_uuid(), v_group_id, '리포트 설정',       '/work-report/settings',        'Settings2',       7, ARRAY['admin','manager']::text[],       true, true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '영업 활동 리포트 메뉴 7개 추가 완료 (group_id: %)', v_group_id;
END $$;

-- ============================================================
-- STEP 4: 결과 확인
-- ============================================================
SELECT
  g.name AS group_name,
  g.sort_order AS group_order,
  i.label,
  i.path,
  i.icon,
  i.sort_order AS item_order,
  i.is_admin_only
FROM menu_items i
JOIN menu_groups g ON g.id = i.group_id
WHERE g.name = '영업 활동 리포트'
ORDER BY i.sort_order;
