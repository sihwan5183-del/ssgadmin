// ============================================================
// workReportService — 내 업무 대시보드 / 팀 업무 현황 집계
// 권한별 필터 적용 (service 단계에서 필터링)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { getKstDateRangeUtc } from './dateUtils';
import type { ActivityActionType } from '@/types/workReport';

export interface WorkDashboardSummary {
  action_type: ActivityActionType;
  is_counted: boolean;
  channel: string | null;
  created_at: string;
  staff_id: string;
  staff_name: string;
}

// ── 내 업무 대시보드 — 본인 데이터만 ───────────────────────
export async function getMyWorkDashboardData(
  userId: string,
  dateFrom: string,
  dateTo: string
): Promise<WorkDashboardSummary[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('action_type, is_counted, channel, created_at, staff_id, staff_name')
    .eq('staff_id', userId)           // 본인 데이터만
    .gte('created_at', getKstDateRangeUtc(dateFrom, dateTo).start)
    .lte('created_at', getKstDateRangeUtc(dateFrom, dateTo).end)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkDashboardSummary[];
}

// ── 팀 업무 현황 — 관리자: 전체 / 팀장: 팀원 / 직원: 본인 ──
export async function getTeamWorkDashboardData(
  userId: string,
  isAdmin: boolean,
  dateFrom: string,
  dateTo: string,
  filterStaffId?: string
): Promise<WorkDashboardSummary[]> {
  let query = supabase
    .from('activity_logs')
    .select('action_type, is_counted, channel, created_at, staff_id, staff_name')
    .gte('created_at', getKstDateRangeUtc(dateFrom, dateTo).start)
    .lte('created_at', getKstDateRangeUtc(dateFrom, dateTo).end)
    .order('created_at', { ascending: false });

  // 관리자가 아니면 본인 데이터만
  if (!isAdmin) {
    query = query.eq('staff_id', userId);
  }
  // 관리자가 특정 직원 필터 선택 시
  if (isAdmin && filterStaffId) {
    query = query.eq('staff_id', filterStaffId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WorkDashboardSummary[];
}

// ── action_type별 카운트 집계 ────────────────────────────────
export function aggregateByAction(logs: WorkDashboardSummary[]) {
  const counted = logs.filter((l) => l.is_counted);
  const count = (type: ActivityActionType) =>
    counted.filter((l) => l.action_type === type).length;
  const total = (type: ActivityActionType) =>
    logs.filter((l) => l.action_type === type).length;

  return {
    call_attempt:         { counted: count('call_attempt'),         total: total('call_attempt') },
    call_connected:       { counted: count('call_connected'),       total: total('call_connected') },
    absent:               { counted: count('absent'),               total: total('absent') },
    sms_sent:             { counted: count('sms_sent'),             total: total('sms_sent') },
    recare_registered:    { counted: count('recare_registered'),    total: total('recare_registered') },
    recare_completed:     { counted: count('recare_completed'),     total: total('recare_completed') },
    failed:               { counted: count('failed'),               total: total('failed') },
    consultation_success: { counted: count('consultation_success'), total: total('consultation_success') },
    delivery_sent:        { counted: count('delivery_sent'),        total: total('delivery_sent') },
    activation_completed: { counted: count('activation_completed'), total: total('activation_completed') },
    settlement_confirmed: { counted: count('settlement_confirmed'), total: total('settlement_confirmed') },
  };
}

// ── 직원별 집계 (팀 업무 현황용) ────────────────────────────
export function aggregateByStaff(logs: WorkDashboardSummary[]) {
  const staffMap = new Map<string, { name: string; logs: WorkDashboardSummary[] }>();
  logs.forEach((l) => {
    if (!staffMap.has(l.staff_id)) {
      staffMap.set(l.staff_id, { name: l.staff_name, logs: [] });
    }
    staffMap.get(l.staff_id)!.logs.push(l);
  });

  return Array.from(staffMap.entries()).map(([staffId, { name, logs: staffLogs }]) => {
    const agg = aggregateByAction(staffLogs);
    const success = agg.consultation_success.counted;
    const attempt = agg.call_attempt.counted;
    return {
      staff_id: staffId,
      staff_name: name,
      call_attempt:         agg.call_attempt.counted,
      call_connected:       agg.call_connected.counted,
      absent:               agg.absent.counted,
      recare:               agg.recare_registered.counted + agg.recare_completed.counted,
      failed:               agg.failed.counted,
      consultation_success: success,
      activation_completed: agg.activation_completed.counted,
      settlement_confirmed: agg.settlement_confirmed.counted,
      conversion_rate:      attempt > 0 ? Math.round((success / attempt) * 100 * 10) / 10 : 0,
    };
  });
}
