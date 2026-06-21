// ============================================================
// 영업 활동 리포트 — mock data (1단계 레이아웃 전용)
// 2단계에서 실제 DB 연결로 교체 예정
// ============================================================

import type {
  ActivityLog,
  DailySummaryCard,
  TeamMemberRow,
  IncentivePolicy,
  IncentiveResult,
  ProgressDelayRow,
  AnomalyLog,
} from '@/types/workReport';

// ── 내 업무 대시보드 ──────────────────────────────────────
export const mockMyDailySummary: DailySummaryCard[] = [
  { label: '배정', count: 12, color: 'gray' },
  { label: '통화시도', count: 27, countedCount: 25, totalLogCount: 28, color: 'blue' },
  { label: '연결완료', count: 11, color: 'indigo' },
  { label: '부재', count: 9, countedCount: 8, totalLogCount: 11, color: 'orange' },
  { label: '재케어', count: 5, color: 'yellow' },
  { label: '실패', count: 4, color: 'red' },
  { label: '상담성공', count: 3, color: 'green' },
  { label: '개통완료', count: 2, color: 'pink' },
];

export const mockMyConversionFlow = [
  { label: '배정', count: 12 },
  { label: '통화시도', count: 27 },
  { label: '연결완료', count: 11 },
  { label: '상담성공', count: 3 },
  { label: '택배발송', count: 2 },
  { label: '개통완료', count: 2 },
  { label: '정산확정', count: 1 },
];

export const mockMyProgressCards = [
  { label: '상담성공 후 택배대기', count: 1, color: 'yellow' },
  { label: '택배발송 후 개통대기', count: 1, color: 'orange' },
  { label: '개통완료 후 정산대기', count: 2, color: 'blue' },
  { label: '예상개통일 초과', count: 0, color: 'red' },
  { label: '철회/취소 확인 필요', count: 0, color: 'gray' },
];

export const mockMySuccessList = [
  { customer_name: '박**', channel: '모요', product: 'MNP', device: 'S948', plan: '115', manager: '최윤정' },
  { customer_name: '이**', channel: '대표번호', product: '재가입', device: 'S942', plan: '85', manager: '최윤정' },
  { customer_name: '김**', channel: '모요', product: '홈신규', device: '프리미엄안심G+VOD', plan: '-', manager: '김경환' },
];

export const mockMyIncentiveSummary = {
  apply_month: '2026-06',
  confirmed_count: 23,
  pending_count: 5,
  excluded_count: 1,
  applied_tier: '11~30건',
  unit_price: 3000,
  estimated_amount: 69000,
};

// ── 팀 업무 현황 ──────────────────────────────────────────
export const mockTeamSummary: DailySummaryCard[] = [
  { label: '배정', count: 42 },
  { label: '통화시도', count: 74 },
  { label: '연결완료', count: 29 },
  { label: '부재', count: 22 },
  { label: '재케어', count: 11 },
  { label: '실패', count: 9 },
  { label: '상담성공', count: 8 },
  { label: '개통완료', count: 6 },
  { label: '정산확정', count: 4 },
];

export const mockTeamCompare = {
  today: { callAttempt: 74, connected: 29, absence: 22, success: 8, opening: 6 },
  yesterday: { callAttempt: 61, connected: 24, absence: 18, success: 6, opening: 4 },
  thisWeek: { callAttempt: 312, connected: 118, absence: 89, success: 31, opening: 22 },
  lastWeek: { callAttempt: 287, connected: 109, absence: 80, success: 28, opening: 20 },
};

export const mockTeamMembers: TeamMemberRow[] = [
  {
    user_id: 'c67a5b4e', user_name: '최윤정', branch: '본점',
    assigned: 20, callAttempt: 32, callConnected: 14, noAnswer: 10,
    recare: 5, failed: 6, consultSuccess: 3, openingComplete: 2,
    settlementConfirmed: 1, conversionRate: 9.4,
  },
  {
    user_id: 'b9bac256', user_name: '김경환', branch: '본점',
    assigned: 15, callAttempt: 21, callConnected: 9, noAnswer: 7,
    recare: 3, failed: 4, consultSuccess: 2, openingComplete: 2,
    settlementConfirmed: 1, conversionRate: 9.5,
  },
  {
    user_id: 'omina001', user_name: '오미나', branch: '본점',
    assigned: 7, callAttempt: 21, callConnected: 6, noAnswer: 5,
    recare: 3, failed: 2, consultSuccess: 3, openingComplete: 2,
    settlementConfirmed: 2, conversionRate: 14.3,
  },
];

export const mockAnomalyLogs: AnomalyLog[] = [
  {
    anomaly_type: '10분내_중복통화',
    log_id: 'log-001',
    user_name: '최윤정',
    customer_name: '김**',
    occurred_at: '2026-06-21 14:03',
    description: '14:01 통화시도 후 2분 만에 동일 고객 재시도',
  },
  {
    anomaly_type: '상담성공_택배미발송_2일초과',
    log_id: 'log-002',
    user_name: '김경환',
    customer_name: '이**',
    occurred_at: '2026-06-19 10:30',
    description: '상담성공 3일 경과, 택배 미발송 상태',
  },
];

// ── 활동 로그 ─────────────────────────────────────────────
export const mockActivityLogs: ActivityLog[] = [
  {
    id: 'act-001', lead_id: 'lead-100', sales_record_id: null,
    user_id: 'c67a5b4e', user_name: '최윤정', branch: '본점', channel: '모요',
    action_type: 'CALL_ATTEMPT', result_type: '부재',
    previous_status: '신규접수', next_status: '부재',
    memo: '1차 부재', fail_reason: null, next_contact_at: null,
    is_counted: true, uncounted_reason: null, is_corrected: false,
    correction_of_log_id: null, device_info: null, ip_address: null,
    created_at: '2026-06-21 14:01', customer_name: '김**',
  },
  {
    id: 'act-002', lead_id: 'lead-100', sales_record_id: null,
    user_id: 'c67a5b4e', user_name: '최윤정', branch: '본점', channel: '모요',
    action_type: 'CALL_ATTEMPT', result_type: '부재',
    previous_status: '부재', next_status: '부재',
    memo: null, fail_reason: null, next_contact_at: null,
    is_counted: false, uncounted_reason: '10분 내 중복', is_corrected: false,
    correction_of_log_id: null, device_info: null, ip_address: null,
    created_at: '2026-06-21 14:03', customer_name: '김**',
  },
  {
    id: 'act-003', lead_id: 'lead-100', sales_record_id: null,
    user_id: 'c67a5b4e', user_name: '최윤정', branch: '본점', channel: '모요',
    action_type: 'SMS_SENT', result_type: '문자발송완료',
    previous_status: '부재', next_status: '재케어등록',
    memo: '문자 발송', fail_reason: null, next_contact_at: '2026-06-22 10:00',
    is_counted: true, uncounted_reason: null, is_corrected: false,
    correction_of_log_id: null, device_info: null, ip_address: null,
    created_at: '2026-06-21 14:15', customer_name: '김**',
  },
  {
    id: 'act-004', lead_id: 'lead-101', sales_record_id: null,
    user_id: 'b9bac256', user_name: '김경환', branch: '본점', channel: '대표번호',
    action_type: 'CONSULT_SUCCESS', result_type: '상담성공',
    previous_status: '연결완료', next_status: '상담성공',
    memo: '홈신규 확정 / 프리미엄안심G+VOD', fail_reason: null, next_contact_at: null,
    is_counted: true, uncounted_reason: null, is_corrected: false,
    correction_of_log_id: null, device_info: null, ip_address: null,
    created_at: '2026-06-21 11:22', customer_name: '이**',
  },
  {
    id: 'act-005', lead_id: 'lead-102', sales_record_id: null,
    user_id: 'c67a5b4e', user_name: '최윤정', branch: '본점', channel: '모요',
    action_type: 'FAILED', result_type: '실패',
    previous_status: '연결완료', next_status: '실패처리',
    memo: null, fail_reason: '타사 이미 가입', next_contact_at: null,
    is_counted: true, uncounted_reason: null, is_corrected: false,
    correction_of_log_id: null, device_info: null, ip_address: null,
    created_at: '2026-06-21 09:47', customer_name: '박**',
  },
];

// ── 진행/지연 관리 ────────────────────────────────────────
export const mockProgressCards = [
  { label: '상담성공 후 택배대기', count: 3, color: 'yellow' },
  { label: '택배발송 후 개통대기', count: 5, color: 'orange' },
  { label: '개통완료 후 정산대기', count: 8, color: 'blue' },
  { label: '예상개통일 초과', count: 2, color: 'red' },
  { label: '철회확인 필요', count: 1, color: 'gray' },
];

export const mockProgressDelayRows: ProgressDelayRow[] = [
  {
    id: 'pd-001', customer_name: '권**', customer_phone: '010-****-1234',
    user_name: '최윤정', current_status: '택배발송',
    consult_success_at: '2026-06-19', delivery_sent_at: '2026-06-20',
    expected_opening_at: '2026-06-21', actual_opening_at: null,
    delay_days: 1, channel: '모요', product_type: 'MNP',
  },
  {
    id: 'pd-002', customer_name: '이**', customer_phone: '010-****-5678',
    user_name: '김경환', current_status: '상담성공',
    consult_success_at: '2026-06-18', delivery_sent_at: null,
    expected_opening_at: '2026-06-21', actual_opening_at: null,
    delay_days: 3, channel: '대표번호', product_type: '재가입',
  },
  {
    id: 'pd-003', customer_name: '박**', customer_phone: '010-****-9012',
    user_name: '오미나', current_status: '개통완료',
    consult_success_at: '2026-06-15', delivery_sent_at: '2026-06-16',
    expected_opening_at: '2026-06-18', actual_opening_at: '2026-06-18',
    delay_days: 0, channel: '모요', product_type: 'MNP',
  },
];

// ── 인센 예상 ─────────────────────────────────────────────
export const mockIncentivePolicies: IncentivePolicy[] = [
  {
    id: 'pol-001', apply_month: '2026-06', product_type: '전체',
    calc_method: '최종구간일괄',
    range_start: 1, range_end: 10, unit_price: 1000,
    is_active: true, created_at: '2026-06-01',
  },
  {
    id: 'pol-002', apply_month: '2026-06', product_type: '전체',
    calc_method: '최종구간일괄',
    range_start: 11, range_end: 30, unit_price: 3000,
    is_active: true, created_at: '2026-06-01',
  },
  {
    id: 'pol-003', apply_month: '2026-06', product_type: '전체',
    calc_method: '최종구간일괄',
    range_start: 31, range_end: null, unit_price: 7000,
    is_active: true, created_at: '2026-06-01',
  },
];

export const mockIncentiveResults: IncentiveResult[] = [
  {
    id: 'ir-001', apply_month: '2026-06',
    user_id: 'c67a5b4e', user_name: '최윤정',
    consult_success: 18, opening_complete: 15,
    confirmed_count: 23, pending_count: 5, excluded_count: 1,
    applied_tier: '11~30건', applied_unit_price: 3000,
    estimated_amount: 69000, calculated_at: '2026-06-21 00:00',
  },
  {
    id: 'ir-002', apply_month: '2026-06',
    user_id: 'b9bac256', user_name: '김경환',
    consult_success: 14, opening_complete: 12,
    confirmed_count: 18, pending_count: 3, excluded_count: 0,
    applied_tier: '11~30건', applied_unit_price: 3000,
    estimated_amount: 54000, calculated_at: '2026-06-21 00:00',
  },
  {
    id: 'ir-003', apply_month: '2026-06',
    user_id: 'omina001', user_name: '오미나',
    consult_success: 8, opening_complete: 7,
    confirmed_count: 7, pending_count: 2, excluded_count: 0,
    applied_tier: '1~10건', applied_unit_price: 1000,
    estimated_amount: 7000, calculated_at: '2026-06-21 00:00',
  },
];

// ── 일일 업무보고 ─────────────────────────────────────────
export const mockDailyReport = {
  report_date: '2026-06-21',
  team: '온라인 마케팅팀',
  channel: '전체',
  summary: {
    callAttempt: 74, connected: 29, absence: 22,
    recare: 11, failed: 9, consultSuccess: 8,
    deliverySent: 5, openingComplete: 6,
  },
  successList: [
    { manager: '최윤정', channel: '모요', customer: '박**', type: 'MNP', device: 'S948-255', plan: '115' },
    { manager: '최윤정', channel: '모요', customer: '위**', type: 'MNP', device: 'S942-256', plan: '85' },
    { manager: '김경환', channel: '대표번호', customer: '김**', type: '홈신규', device: '프리미엄안심G+VOD', plan: '-' },
  ],
  progressList: [
    { manager: '최윤정', channel: '모요', customer: '권**', type: 'MNP', device: 'S942-256', plan: '85', note: '방문수령' },
    { manager: '김경환', channel: '모요', customer: '이**', type: '재가입', device: 'S942-256', plan: '85', note: '선개통 후 택배출고' },
  ],
  failSummary: [
    { reason: '통화거절', count: 2 },
    { reason: '조건불만', count: 2 },
    { reason: '기존 사용처 있음', count: 1 },
    { reason: '번호이동 불가', count: 1 },
    { reason: '부재누적', count: 3 },
  ],
  memberSummary: [
    { name: '최윤정', attempt: 32, connected: 14, absence: 10, recare: 5, failed: 6, success: 3 },
    { name: '김경환', attempt: 21, connected: 9, absence: 7, recare: 3, failed: 4, success: 2 },
    { name: '오미나', attempt: 21, connected: 6, absence: 5, recare: 3, failed: 2, success: 3 },
  ],
};
