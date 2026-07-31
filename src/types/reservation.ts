// ============================================================
// 사전예약 관리 — 타입 정의
// ============================================================
// v20260724: 상태값 개편
//  - 문자발송 → 재케어로 통합
//  - 상담실패 → 실패로 개칭
//  - 개통완료 제거 (activated_at 컬럼은 보존, 더 이상 상태로 쓰지 않음)
//  - 확정(서류작성) 신규 추가 (상담성공과 예약완료 사이 단계)
//  - 취소 신규 추가 (가망/상담성공/확정/예약완료 단계에서 고객 변심으로 취소)
// v20260729: 확정 발주 스펙시트 필드 + 본사 전산 수동 대사(3단계 토글) 추가

export type ReservationStatus =
  | '신규'
  | '확정'
  | '예약완료'
  | '가망'
  | '상담성공'
  | '재케어'
  | '부재'
  | '실패'
  | '취소';

export const RESERVATION_STATUS_LIST: {
  value: ReservationStatus;
  label: string;
  color: string;
}[] = [
  { value: '신규',     label: '신규',                 color: 'bg-blue-100 text-blue-700' },
  { value: '확정',     label: '확정 (서류작성)',       color: 'bg-teal-100 text-teal-700' },
  { value: '예약완료', label: '예약완료 (서류미작성)', color: 'bg-pink-100 text-pink-700' },
  { value: '가망',     label: '가망 (최종해피콜)',     color: 'bg-amber-100 text-amber-700' },
  { value: '상담성공', label: '상담성공',             color: 'bg-emerald-100 text-emerald-700' },
  { value: '재케어',   label: '재케어 (추가케어필요)', color: 'bg-purple-100 text-purple-700' },
  { value: '부재',     label: '부재',                 color: 'bg-orange-100 text-orange-700' },
  { value: '실패',     label: '실패',                 color: 'bg-red-100 text-red-700' },
  { value: '취소',     label: '취소',                 color: 'bg-gray-200 text-gray-600' },
];

// 가망 등급 (상태='가망'일 때만 사용)
export type ProspectGrade = '상' | '중' | '하';
export const PROSPECT_GRADE_OPTIONS: ProspectGrade[] = ['상', '중', '하'];

export type FailStage = '상담' | '예약';

// 취소된 단계 (상태='취소'일 때만 사용)
// 가망/상담성공/확정/예약완료 중 어느 단계에서 고객이 취소 요청했는지 기록
export type CancelStage = '가망' | '상담성공' | '확정' | '예약완료';
export const CANCEL_STAGE_OPTIONS: CancelStage[] = ['가망', '상담성공', '확정', '예약완료'];

// 본사 전산 크로스체크 — 담당자가 눈으로 대조 후 수동으로 남기는 상태 (v20260729)
// 자동 매칭 아님. LG본사 시스템에서 데이터를 뽑을 방법이 없어 화면 보고 눈으로 비교 후 토글.
export type HqCheckStatus = '미확인' | '일치' | '불일치';
export const HQ_CHECK_STATUS_LIST: { value: HqCheckStatus; label: string; color: string }[] = [
  { value: '미확인', label: '미확인', color: 'bg-gray-100 text-gray-500' },
  { value: '일치',   label: '일치',   color: 'bg-green-100 text-green-700' },
  { value: '불일치', label: '불일치', color: 'bg-red-100 text-red-700' },
];

// 2ND 태블릿 가입유형 (v20260729-5) — 신규회선/재가입 중 선택
export type TabletSubType = '신규' | '재가입';
export const TABLET_SUBTYPE_LIST: { value: TabletSubType; label: string; color: string }[] = [
  { value: '신규',   label: '신규',   color: 'bg-blue-100 text-blue-700' },
  { value: '재가입', label: '재가입', color: 'bg-purple-100 text-purple-700' },
];

export interface ReservationFailReason {
  id: string;
  reason: string;
  sort_order: number;
  created_at: string;
}

export interface Reservation {
  id: string;
  name: string;
  phone: string;
  carrier: string | null;
  channel: string | null;
  utm_campaign: string | null;
  device_interest: string | null;
  capacity: string | null;
  product_color: string | null;
  status: ReservationStatus;
  prospect_grade: ProspectGrade | null;
  assigned_to: string | null;
  birth_date: string | null;
  memo: string | null;
  fail_reason_id: string | null;
  fail_stage: FailStage | null;
  fail_memo: string | null;
  cancel_stage: CancelStage | null;
  contact_date: string | null;
  reservation_confirmed_at: string | null;
  activated_at: string | null;
  sms_sent: boolean;
  sms_sent_at: string | null;
  courier_sent: boolean;         // 택배 발송 완료 여부
  courier_sent_at: string | null;
  created_at: string;
  updated_at: string;

  // ── 확정 발주 스펙시트 (v20260729) — 본사 제출용 엑셀 양식 재현 ──
  customer_address: string | null;   // 고객주소
  subscription_type: string | null;  // 가입유형 (MNP(SKT), 재가입 등 — carrier와 별개 개념)
  rate_plan: string | null;          // 요금제정보 > 요금제
  premium_pack: string | null;       // 요금제정보 > 프리미엄팩 (버즈4/티빙/유튜브 등)
  bundle_watch: string | null;       // 2ND > 워치
  bundle_tablet: string | null;      // 2ND > 태블릿
  bundle_tablet_type: TabletSubType | null; // 2ND > 태블릿 가입유형 (신규/재가입)
  home_internet: string | null;      // 홈상품 > 인터넷
  home_internet_tv_bundled: boolean; // 홈상품 > 인터넷 가입시 TV 동시가입 여부 (토글)
  home_tv: string | null;            // 홈상품 > TV프리
  home_tv_bundle_type: TvBundleType | null; // 홈상품 > TV프리 번들형/언번들형 (토글)
  home_smarthome: string | null;     // 홈상품 > 스마트홈

  // ── 본사 전산 크로스체크 (v20260729) — 수동 대사 ──
  hq_check_status: HqCheckStatus;
  hq_check_note: string | null;
  hq_checked_by: string | null;
  hq_checked_at: string | null;

  // join
  fail_reason?: ReservationFailReason;
  assignee?: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export interface ReservationInsert {
  name: string;
  phone: string;
  carrier?: string;
  channel?: string;
  device_interest?: string;
  status?: ReservationStatus;
  prospect_grade?: ProspectGrade | null;
  capacity?: string;
  product_color?: string;
  assigned_to?: string;
  birth_date?: string;
  memo?: string;
  contact_date?: string;
}

export interface ReservationUpdate {
  status?: ReservationStatus;
  prospect_grade?: ProspectGrade | null;
  carrier?: string;
  channel?: string;
  device_interest?: string;
  capacity?: string;
  product_color?: string;
  assigned_to?: string;
  memo?: string;
  fail_reason_id?: string | null;
  fail_stage?: FailStage | null;
  fail_memo?: string | null;
  cancel_stage?: CancelStage | null;
  reservation_confirmed_at?: string | null;
  activated_at?: string | null;
  sms_sent?: boolean;
  sms_sent_at?: string | null;
  courier_sent?: boolean;
  courier_sent_at?: string | null;
  customer_address?: string | null;
  subscription_type?: string | null;
  rate_plan?: string | null;
  premium_pack?: string | null;
  bundle_watch?: string | null;
  bundle_tablet?: string | null;
  bundle_tablet_type?: TabletSubType | null;
  home_internet?: string | null;
  home_internet_tv_bundled?: boolean;
  home_tv?: string | null;
  home_tv_bundle_type?: TvBundleType | null;
  home_smarthome?: string | null;
  hq_check_status?: HqCheckStatus;
  hq_check_note?: string | null;
  hq_checked_by?: string | null;
  hq_checked_at?: string | null;
}

// 메모 히스토리 로그 (reservation_memo_logs 테이블)
export interface ReservationMemoLog {
  id: string;
  reservation_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  // join
  author?: { display_name: string | null } | null;
}

export const CARRIER_OPTIONS = ['LG U+', 'SKT', 'KT', '알뜰폰'];
export const CHANNEL_OPTIONS = ['메타광고', '네이버 검색광고', '기타', '기존고객']; // v20260720
export const DEVICE_OPTIONS = ['갤럭시 Z 플립8', '갤럭시 Z 폴드8', '갤럭시 Z 폴드8 울트라']; // v20260723: 와이드 → 울트라(정식 출시명)

// 2ND 워치 번들 모델 옵션 (v20260729-6) — 자유입력 → 고정 옵션 전환
export const WATCH_MODEL_OPTIONS = [
  '워치 8 40MM',
  '워치 8 44MM',
  '워치 9 40MM',
  '워치 9 44MM',
  '워치 울트라',
  '워치 울트라 2',
];

// 홈상품 > 인터넷 옵션 (v20260729-7) — 자유입력 → 고정 옵션 전환
export const HOME_INTERNET_OPTIONS = [
  '안심보상 500MB',
  '안심보상 1G',
  '안심 500MB',
  '안심 1G',
];

// 홈상품 > TV프리 옵션 (v20260729-7) — 자유입력 → 고정 옵션 전환
export const HOME_TV_OPTIONS = ['프리4', '프리5', '아이패드'];

// TV프리 번들형/언번들형 (v20260729-7)
export type TvBundleType = '번들' | '언번들';
export const TV_BUNDLE_TYPE_LIST: { value: TvBundleType; label: string; color: string }[] = [
  { value: '번들',   label: '번들',   color: 'bg-teal-100 text-teal-700' },
  { value: '언번들', label: '언번들', color: 'bg-orange-100 text-orange-700' },
];

// 기기별 출시 컬러 매핑 (v20260723)
export const DEVICE_COLOR_MAP: Record<string, string[]> = {
  '갤럭시 Z 폴드8 울트라': ['그라파이트', '바이올렛 쉐도우', '크림'],
  '갤럭시 Z 폴드8': ['그라파이트', '라벤더', '크림'],
  '갤럭시 Z 플립8': ['그라파이트', '핑크', '크림'],
};

// 관심기기 원본 텍스트(오타/띄어쓰기/구칭 포함)에서 출시 컬러 목록을 찾아준다.
// 예: "갤럭시 Z 폴드8 와이드"(구칭) / "폴드 8 울트라" / "갤럭시 Z 폴드8 올트라"(오타) → 모두 폴드8 울트라 컬러로 매칭
export function getColorsForDevice(device: string | null | undefined): string[] | undefined {
  if (!device) return undefined;
  const d = device.replace(/\s+/g, '');
  if (d.includes('트라') || d.includes('와이드')) return DEVICE_COLOR_MAP['갤럭시 Z 폴드8 울트라'];
  if (d.includes('플립8') || d.includes('플립')) return DEVICE_COLOR_MAP['갤럭시 Z 플립8'];
  if (d.includes('폴드8') || d.includes('폴드')) return DEVICE_COLOR_MAP['갤럭시 Z 폴드8'];
  return undefined;
}

// 실패 상태 판별
export const isFailStatus = (status: ReservationStatus) =>
  status === '실패';

// 취소 상태 판별
export const isCancelStatus = (status: ReservationStatus) =>
  status === '취소';

// 완료(확정 계열) 상태 판별
export const isCompleteStatus = (status: ReservationStatus) =>
  status === '확정' || status === '예약완료';
