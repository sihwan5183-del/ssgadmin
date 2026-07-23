// ============================================================
// 사전예약 관리 — 타입 정의
// ============================================================

export type ReservationStatus =
  | '신규'
  | '문자발송'
  | '부재'
  | '재케어'
  | '가망'
  | '상담성공'
  | '상담실패'
  | '예약완료'
  | '개통완료';

export const RESERVATION_STATUS_LIST: {
  value: ReservationStatus;
  label: string;
  color: string;
}[] = [
  { value: '신규',     label: '신규',     color: 'bg-blue-100 text-blue-700' },
  { value: '문자발송', label: '문자발송', color: 'bg-sky-100 text-sky-700' },
  { value: '부재',     label: '부재',     color: 'bg-orange-100 text-orange-700' },
  { value: '재케어',   label: '재케어',   color: 'bg-purple-100 text-purple-700' },
  { value: '가망',     label: '가망',     color: 'bg-amber-100 text-amber-700' },
  { value: '상담성공', label: '상담성공', color: 'bg-emerald-100 text-emerald-700' },
  { value: '상담실패', label: '상담실패', color: 'bg-red-100 text-red-700' },
  { value: '예약완료', label: '예약완료', color: 'bg-pink-100 text-pink-700' },
  { value: '개통완료', label: '개통완료', color: 'bg-indigo-100 text-indigo-700' },
];

// 가망 등급 (상태='가망'일 때만 사용)
export type ProspectGrade = '상' | '중' | '하';
export const PROSPECT_GRADE_OPTIONS: ProspectGrade[] = ['상', '중', '하'];

export type FailStage = '상담' | '예약';

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
  contact_date: string | null;
  reservation_confirmed_at: string | null;
  activated_at: string | null;
  sms_sent: boolean;
  sms_sent_at: string | null;
  created_at: string;
  updated_at: string;
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
  reservation_confirmed_at?: string | null;
  activated_at?: string | null;
  sms_sent?: boolean;
  sms_sent_at?: string | null;
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

// 기기별 출시 컬러 매핑 (v20260723)
export const DEVICE_COLOR_MAP: Record<string, string[]> = {
  '갤럭시 Z 폴드8 울트라': ['그라파이트', '바이올렛 쉐도우', '크림'],
  '갤럭시 Z 폴드8': ['그라파이트', '라벤더', '크림'],
  '갤럭시 Z 플립8': ['그라파이트', '핑크', '크림'],
};

// 실패 상태 판별
export const isFailStatus = (status: ReservationStatus) =>
  status === '상담실패';

// 완료 상태 판별
export const isCompleteStatus = (status: ReservationStatus) =>
  status === '예약완료' || status === '개통완료';
