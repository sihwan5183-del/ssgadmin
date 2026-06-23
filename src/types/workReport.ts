// ============================================================
// 영업 활동 리포트 — 타입 정의
// ============================================================

export type ActivityActionType =
  | 'call_attempt'         // 통화시도
  | 'call_connected'       // 연결완료
  | 'absent'               // 부재
  | 'sms_sent'             // 문자발송
  | 'recare_registered'    // 재케어등록
  | 'recare_completed'     // 재케어완료
  | 'failed'               // 실패처리
  | 'consultation_success' // 상담성공
  | 'delivery_ready'       // 택배대기
  | 'delivery_sent'        // 택배발송
  | 'activation_completed' // 개통완료
  | 'installation_completed' // 설치완료
  | 'settlement_confirmed' // 정산확정
  | 'status_changed'       // 단순 상태 변경 (미인정)
  | 'sales_record_created' // 판매실적 등록
  | 'sales_record_updated'; // 판매실적 수정

export const ACTION_TYPE_LABEL: Record<ActivityActionType, string> = {
  call_attempt:           '통화시도',
  call_connected:         '연결완료',
  absent:                 '부재',
  sms_sent:               '문자발송',
  recare_registered:      '재케어등록',
  recare_completed:       '재케어완료',
  failed:                 '실패처리',
  consultation_success:   '상담성공',
  delivery_ready:         '택배대기',
  delivery_sent:          '택배발송',
  activation_completed:   '개통완료',
  installation_completed: '설치완료',
  settlement_confirmed:   '정산확정',
  status_changed:         '상태변경',
  sales_record_created:   '판매실적등록',
  sales_record_updated:   '판매실적수정',
};

// Supabase activity_logs 테이블 Row 타입
export interface ActivityLog {
  id: string;
  lead_id: string | null;
  sales_record_id: string | null;
  staff_id: string;
  staff_name: string;
  store_id: string | null;
  channel: string | null;
  action_type: ActivityActionType;
  result_type: string | null;
  previous_status: string | null;
  next_status: string | null;
  memo: string | null;
  fail_reason: string | null;
  next_action_at: string | null;
  is_counted: boolean;
  not_counted_reason: string | null;
  corrected_log_id: string | null;
  device_info: string | null;
  ip_address: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
}

// INSERT용 타입 (id, created_at, updated_at 제외)
export type ActivityLogInsert = Omit<ActivityLog, 'id' | 'created_at' | 'updated_at'>;

// 활동 로그 + leads join 결과 (화면 표시용)
export interface ActivityLogWithLead extends ActivityLog {
  customer_name?: string | null;  // leads 테이블에서 join
}

// 필터 타입
export interface ActivityLogFilter {
  dateFrom?: string;
  dateTo?: string;
  staffId?: string;
  actionType?: ActivityActionType | '';
  isCounted?: boolean | null;
  anomalyOnly?: boolean;
}
