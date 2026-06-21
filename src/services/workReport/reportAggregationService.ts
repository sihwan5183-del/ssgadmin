// ============================================================
// reportAggregationService — 일일 업무보고 데이터 집계
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { resolveStaffDisplayNames } from './staffDisplayService';

export interface DailyReportLog {
  id: string;
  staff_id: string;
  staff_name: string;
  channel: string | null;
  action_type: string;
  result_type: string | null;
  previous_status: string | null;
  next_status: string | null;
  memo: string | null;
  fail_reason: string | null;
  is_counted: boolean;
  lead_id: string | null;
  created_at: string;
  // leads join
  customer_name?: string | null;
}

export interface DailyReportSummary {
  call_attempt: number;
  call_connected: number;
  absent: number;
  recare: number;
  failed: number;
  consultation_success: number;
  delivery_sent: number;
  activation_completed: number;
  not_counted: number;
}

export interface StaffDailySummary {
  staff_id: string;
  staff_name: string;
  display_name: string;
  call_attempt: number;
  call_connected: number;
  absent: number;
  recare: number;
  failed: number;
  consultation_success: number;
  activation_completed: number;
}

export interface FailReasonCount {
  reason: string;
  count: number;
}

export interface DailyReportData {
  date: string;
  logs: DailyReportLog[];
  summary: DailyReportSummary;
  activationLogs: DailyReportLog[];
  progressLogs: DailyReportLog[];
  failReasons: FailReasonCount[];
  staffSummaries: StaffDailySummary[];
}

// ── 일일 업무보고 데이터 조회 ─────────────────────────────
export async function getDailyWorkReportData({
  date,
  userId,
  isAdmin,
  channel,
  filterStaffId,
}: {
  date: string;
  userId: string;
  isAdmin: boolean;
  channel?: string;
  filterStaffId?: string;
}): Promise<DailyReportData> {
  let query = supabase
    .from('activity_logs')
    .select(`*, leads!left(customer_name)`)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)
    .order('created_at', { ascending: true });

  // 권한 필터
  if (!isAdmin) query = query.eq('staff_id', userId);
  if (isAdmin && filterStaffId) query = query.eq('staff_id', filterStaffId);
  // 채널 필터
  if (channel && channel !== '전체') query = query.eq('channel', channel);

  const { data, error } = await query;
  if (error) throw error;

  const logs: DailyReportLog[] = (data ?? []).map((r: any) => ({
    ...r,
    customer_name: r.leads?.customer_name ?? null,
    leads: undefined,
  }));

  // 담당자 표시명 일괄 조회
  const staffIds = [...new Set(logs.map((l) => l.staff_id))];
  const nameMap = staffIds.length > 0 ? await resolveStaffDisplayNames(staffIds) : new Map();

  const counted = logs.filter((l) => l.is_counted);

  const cnt = (type: string) => counted.filter((l) => l.action_type === type).length;

  const summary: DailyReportSummary = {
    call_attempt:         cnt('call_attempt'),
    call_connected:       cnt('call_connected'),
    absent:               cnt('absent'),
    recare:               cnt('recare_registered') + cnt('recare_completed'),
    failed:               cnt('failed'),
    consultation_success: cnt('consultation_success'),
    delivery_sent:        cnt('delivery_sent'),
    activation_completed: cnt('activation_completed'),
    not_counted:          logs.filter((l) => !l.is_counted).length,
  };

  // 개통 완료건
  const activationLogs = counted.filter((l) => l.action_type === 'activation_completed');

  // 진행 예정건 (상담성공 + 택배대기/발송)
  const progressLogs = counted.filter((l) =>
    ['consultation_success', 'delivery_ready', 'delivery_sent'].includes(l.action_type)
  );

  // 실패 사유 집계
  const failLogs = counted.filter((l) => l.action_type === 'failed');
  const reasonMap = new Map<string, number>();
  failLogs.forEach((l) => {
    const r = l.fail_reason ?? '사유 미입력';
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  });
  const failReasons: FailReasonCount[] = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // 전 직원 목록 가져오기 (활동 없어도 0건으로 표시)
  // show_in_dashboard = true인 직원만 (실제 영업 활동 직원)
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .eq('show_in_dashboard', true)
    .is('deleted_at', null);

  // 담당자별 집계 — 전 직원 기본값으로 초기화
  const staffMap = new Map<string, StaffDailySummary>();
  (allProfiles ?? []).forEach((p: any) => {
    staffMap.set(p.user_id, {
      staff_id: p.user_id,
      staff_name: p.display_name,
      display_name: p.display_name,
      call_attempt: 0, call_connected: 0, absent: 0,
      recare: 0, failed: 0, consultation_success: 0, activation_completed: 0,
    });
  });
  // 로그 있는 직원은 nameMap으로 덮어쓰기
  counted.forEach((l) => {
    if (!staffMap.has(l.staff_id)) {
      staffMap.set(l.staff_id, {
        staff_id: l.staff_id,
        staff_name: l.staff_name,
        display_name: nameMap.get(l.staff_id) ?? l.staff_name,
        call_attempt: 0, call_connected: 0, absent: 0,
        recare: 0, failed: 0, consultation_success: 0, activation_completed: 0,
      });
    }
    const s = staffMap.get(l.staff_id)!;
    if (l.action_type === 'call_attempt')         s.call_attempt++;
    if (l.action_type === 'call_connected')        s.call_connected++;
    if (l.action_type === 'absent')               s.absent++;
    if (l.action_type === 'recare_registered' || l.action_type === 'recare_completed') s.recare++;
    if (l.action_type === 'failed')               s.failed++;
    if (l.action_type === 'consultation_success') s.consultation_success++;
    if (l.action_type === 'activation_completed') s.activation_completed++;
  });

  return {
    date,
    logs,
    summary,
    activationLogs,
    progressLogs,
    failReasons,
    staffSummaries: Array.from(staffMap.values()),
  };
}
