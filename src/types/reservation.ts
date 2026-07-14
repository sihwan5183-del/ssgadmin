// ============================================================
// 사전예약 관리 — 타입 정의
// ============================================================

export type ReservationStatus =
  | '신규'
  | '문자발송'
  | '부재'
  | '재케어'
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
  { value: '상담성공', label: '상담성공', color: 'bg-emerald-100 text-emerald-700' },
  { value: '상담실패', label: '상담실패', color: 'bg-red-100 text-red-700' },
  { value: '예약완료', label: '예약완료', color: 'bg-pink-100 text-pink-700' },
  { value: '개통완료', label: '개통완료', color: 'bg-indigo-100 text-indigo-700' },
];

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
  device_interest: string | null;
  capacity: string | null;
  product_color: string | null;
  status: ReservationStatus;
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
  capacity?: string;
  product_color?: string;
  assigned_to?: string;
  birth_date?: string;
  memo?: string;
  contact_date?: string;
}

export interface ReservationUpdate {
  status?: ReservationStatus;
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

export const CARRIER_OPTIONS = ['LG U+', 'SKT', 'KT', '알뜰폰'];
export const CHANNEL_OPTIONS = ['메타광고', '네이버 검색광고', '기타'];
export const DEVICE_OPTIONS = ['갤럭시 Z 폴더블8'];

// 실패 상태 판별
export const isFailStatus = (status: ReservationStatus) =>
  status === '상담실패';

// 완료 상태 판별
export const isCompleteStatus = (status: ReservationStatus) =>
  status === '예약완료' || status === '개통완료';


