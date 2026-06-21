// ============================================================
// 영업 활동 리포트 — 타입 정의 (1단계: mock data용)
// ============================================================

export type WorkReportMenuKey =
  | 'my-work-dashboard'
  | 'team-work-dashboard'
  | 'daily-work-report'
  | 'activity-logs'
  | 'progress-delay'
  | 'incentive-dashboard'
  | 'report-settings';

export type ActivityActionType =
  | 'CALL_ATTEMPT'
  | 'CALL_CONNECTED'
  | 'NO_ANSWER'
  | 'SMS_SENT'
  | 'RECARE_REGISTERED'
  | 'RECARE_COMPLETED'
  | 'FAILED'
  | 'CONSULT_SUCCESS'
  | 'DELIVERY_PENDING'
  | 'DELIVERY_SENT'
  | 'CUSTOMER_RECEIVED'
  | 'OPENING_PENDING'
  | 'OPENING_COMPLETE'
  | 'SETTLEMENT_PENDING'
  | 'SETTLEMENT_CONFIRMED'
  | 'SETTLEMENT_EXCLUDED'
  | 'CANCELLED';

export type ActivityResultType =
  | '부재'
  | '연결완료'
  | '문자발송완료'
  | '상담성공'
  | '실패'
  | '재케어등록'
  | '재케어완료'
  | '택배대기'
  | '택배발송'
  | '고객수령'
  | '개통대기'
  | '개통완료'
  | '정산대기'
  | '정산확정'
  | '정산제외'
  | '취소';

export type LeadProgressStatus =
  | '신규접수'
  | '통화시도'
  | '연결완료'
  | '부재'
  | '재케어등록'
  | '재케어완료'
  | '실패처리'
  | '상담성공'
  | '택배대기'
  | '택배발송'
  | '고객수령'
  | '개통대기'
  | '개통완료';

export type SettlementStatus =
  | '정산대기'
  | '정산확정'
  | '정산제외'
  | '철회';

// 활동 로그 (신규 테이블 - 2단계에서 실제 연결)
export interface ActivityLog {
  id: string;
  lead_id: string | null;
  sales_record_id: string | null;
  user_id: string;
  user_name: string;
  branch: string;
  channel: string;
  action_type: ActivityActionType;
  result_type: ActivityResultType | null;
  previous_status: string | null;
  next_status: string | null;
  memo: string | null;
  fail_reason: string | null;
  next_contact_at: string | null;
  is_counted: boolean;
  uncounted_reason: string | null;
  is_corrected: boolean;
  correction_of_log_id: string | null;
  device_info: string | null;
  ip_address: string | null;
  created_at: string;
  // 조인 데이터 (읽기용)
  customer_name?: string;
  customer_phone?: string;
}

// 일일 업무 요약 카드용
export interface DailySummaryCard {
  label: string;
  count: number;
  countedCount?: number;
  totalLogCount?: number;
  color?: string;
}

// 직원별 팀 현황 행
export interface TeamMemberRow {
  user_id: string;
  user_name: string;
  branch: string;
  assigned: number;
  callAttempt: number;
  callConnected: number;
  noAnswer: number;
  recare: number;
  failed: number;
  consultSuccess: number;
  openingComplete: number;
  settlementConfirmed: number;
  conversionRate: number;
}

// 인센 정책
export interface IncentivePolicy {
  id: string;
  apply_month: string;
  product_type: string;
  calc_method: '최종구간일괄' | '구간별누적';
  range_start: number;
  range_end: number | null;
  unit_price: number;
  is_active: boolean;
  created_at: string;
}

// 인센 결과 (직원별)
export interface IncentiveResult {
  id: string;
  apply_month: string;
  user_id: string;
  user_name: string;
  consult_success: number;
  opening_complete: number;
  confirmed_count: number;
  pending_count: number;
  excluded_count: number;
  applied_tier: string;
  applied_unit_price: number;
  estimated_amount: number;
  calculated_at: string;
}

// 진행/지연 건
export interface ProgressDelayRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  user_name: string;
  current_status: LeadProgressStatus | string;
  consult_success_at: string | null;
  delivery_sent_at: string | null;
  expected_opening_at: string | null;
  actual_opening_at: string | null;
  delay_days: number;
  channel: string;
  product_type: string;
}

// 이상 로그 유형
export type AnomalyType =
  | '10분내_중복통화'
  | '부재4회이상'
  | '실패사유_미입력'
  | '진행예정_다음액션없음'
  | '상담성공_택배미발송_2일초과'
  | '택배발송_개통미완료_4일초과'
  | '개통완료_정산미확정_3일초과';

export interface AnomalyLog {
  anomaly_type: AnomalyType;
  log_id: string;
  user_name: string;
  customer_name: string;
  occurred_at: string;
  description: string;
}
