## 아파트 게시판 영업 관리 모듈

기존 동적 필드(`useFieldDefinitions`) / 알림 디스패처 / 영업 데이터 패턴을 그대로 재사용해 두 개의 신규 도메인을 추가합니다.

### 1. 데이터베이스 (마이그레이션)

**`apartment_postings`** (DB 1 - 게시 활동)
- team, apartment_name, location_detail, start_date, end_date
- status: `posted` / `ended` (end_date 기준 계산용 generated column 또는 view)
- custom_fields jsonb (관리자 추가 항목)
- created_by, created_at, updated_at

**`apartment_leads`** (DB 2 - 인입 고객)
- posting_id (apartment_postings FK, nullable), team, apartment_name
- inquiry_date, customer_name, customer_phone (마스킹 가능)
- current_carrier, inquiry_note
- result_status: `상담중` / `개통완료` / `거절` / `보류`
- custom_fields jsonb
- created_by, assigned_to

**RLS**: 본인 + 같은 팀 + admin/planner/ceo (`can_view_user_data` 패턴 재사용). admin 만 delete.

**알림 정리**: `notification_rules` 트리거 타입에 `apartment_posting_ending` 추가 — 게시 종료 1일 전 담당 팀에게 발송.

### 2. 관리자 커스텀 필드

기존 `field_definitions` (entity 기반) 패턴 그대로 활용. 두 개의 신규 entity 키 추가:
- `apartment_posting`
- `apartment_lead`

기존 `DynamicFieldsManager.tsx` / `DynamicFieldRenderer.tsx` 그대로 재사용 (텍스트/숫자/날짜/토글/드롭다운 모두 지원). 관리자 페이지에 새 탭 한 개만 추가.

### 3. UI / 라우팅

신규 페이지 `/apartment` (탭 2개):
- **게시 활동** 탭
  - 리스트(팀, 아파트, 기간, 상태 뱃지, 인입 건수)
  - 등록/편집 다이얼로그 (Calendar 사용)
  - 상태 자동: 오늘 < end_date → 게시중, 이후 → 종료됨
- **인입 고객** 탭
  - 리스트(인입일, 고객명, 통신사, 결과)
  - 등록 시 게시물 선택 → 자동으로 팀/아파트 채움
  - 결과 상태 인라인 변경

추가 위치: 사이드바 / 모바일 내비에 "아파트 게시" 메뉴 항목.

### 4. 대시보드 위젯

`ApartmentLeadsWidget` (대시보드 카드):
- 아파트별 인입 건수 가로 막대
- 개통 성공률 (`개통완료 / 전체 leads`) %
- 진행 중인 게시물 수, 곧 종료 예정 (D-1, D-3) 뱃지

### 5. 알림 연동

`notification-dispatcher` 에지 함수에 분기 추가:
- `apartment_posting_ending` 트리거: 매일 09:00 KST 실행, `end_date = tomorrow` 인 게시물 → 같은 팀 직원들에게 push.
- 기본 규칙 1개 시드 (관리자가 ON/OFF 가능).

### 기술 메모 (개발자용)

- `custom_fields jsonb DEFAULT '{}'` + 기존 `useFieldDefinitions(entity)` 훅으로 동적 렌더링.
- 게시 상태는 클라이언트에서 계산 (DB에 저장하지 않음 → 매일 갱신 불필요).
- 알림은 `pending_unresolved` 와 동일한 트리거 타입 패턴.
- 모든 색상은 디자인 토큰 사용, 새 색 토큰은 추가하지 않음.

### 범위에서 제외

- SMS/카카오 자동 발송 (앱 푸시만)
- 인입 → sales 자동 변환 (수동 “개통완료” 마킹만)
