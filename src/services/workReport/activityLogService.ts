// ============================================================
// activityLogService — activity_logs CRUD
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { getKstDateRangeUtc } from './dateUtils';
import {
  type ActivityLogInsert,
  type ActivityLogFilter,
  type ActivityLogWithLead,
} from '@/types/workReport';

export async function fetchActivityLogs(
  filter: ActivityLogFilter = {}
): Promise<ActivityLogWithLead[]> {
  let query = supabase
    .from('activity_logs')
    .select(`
      *,
      leads!left (
        customer_name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter.dateFrom && filter.dateTo) {
    const { start, end } = getKstDateRangeUtc(filter.dateFrom, filter.dateTo);
    query = query.gte('created_at', start).lte('created_at', end);
  } else if (filter.dateFrom) {
    const { start } = getKstDateRangeUtc(filter.dateFrom, filter.dateFrom);
    query = query.gte('created_at', start);
  } else if (filter.dateTo) {
    const { end } = getKstDateRangeUtc(filter.dateTo, filter.dateTo);
    query = query.lte('created_at', end);
  }

  if (filter.staffId) {
    query = query.eq('staff_id', filter.staffId);
  }
  if (filter.actionType) {
    query = query.eq('action_type', filter.actionType);
  }
  // isCounted: null = 전체, true = 인정만, false = 미인정만
  if (filter.isCounted === true || filter.isCounted === false) {
    query = query.eq('is_counted', filter.isCounted);
  }

  const { data, error } = await query;
  if (error) throw error;

  // leads join 결과 flatten
  return (data ?? []).map((row: any) => ({
    ...row,
    customer_name: row.leads?.customer_name ?? null,
  }));
}

// ── 로그 삽입 ────────────────────────────────────────────────
export async function insertActivityLog(
  payload: ActivityLogInsert
): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert(payload);
  if (error) throw error;
}

// ── 통계 집계 (오늘 날짜 기준) ──────────────────────────────
export async function getTodayLogStats(staffId?: string): Promise<{
  total: number;
  counted: number;
  notCounted: number;
}> {
  const today = new Date();
  const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().slice(0, 10);
  const { start, end } = getKstDateRangeUtc(todayStr, todayStr);

  let q = supabase
    .from('activity_logs')
    .select('action_type, is_counted')
    .gte('created_at', start)
    .lte('created_at', end);
  if (staffId) q = q.eq('staff_id', staffId);

  const { data } = await q;
  const rows = data ?? [];
  return {
    total: rows.length,
    counted: rows.filter((r: any) => r.is_counted).length,
    notCounted: rows.filter((r: any) => !r.is_counted).length,
  };
}

// ── 정정 로그 삽입 ──────────────────────────────────────────
export async function insertCorrectionLog(
  original: ActivityLogWithLead,
  correctedBy: string
): Promise<void> {
  const { error } = await supabase.from('activity_logs').insert({
    lead_id: original.lead_id,
    sales_record_id: original.sales_record_id,
    staff_id: original.staff_id,
    staff_name: original.staff_name,
    store_id: original.store_id,
    channel: original.channel,
    action_type: original.action_type,
    result_type: original.result_type,
    previous_status: original.previous_status,
    next_status: original.next_status,
    memo: `[정정] ${original.memo ?? ''}`,
    fail_reason: original.fail_reason,
    next_action_at: original.next_action_at,
    is_counted: false, // 정정 로그는 카운트 제외
    not_counted_reason: '정정',
    corrected_log_id: original.id,
    device_info: null,
    ip_address: null,
    created_by: correctedBy,
  });
  if (error) throw error;
}

// ── 로그 취소 (is_counted = false, 집계 제외) ────────────
export async function cancelActivityLog({
  logId,
  reason,
  cancelledBy,
}: {
  logId: string;
  reason: '실수' | '중복';
  cancelledBy: string;
}): Promise<void> {
  const { error } = await supabase
    .from('activity_logs')
    .update({
      is_counted: false,
      not_counted_reason: reason,
    })
    .eq('id', logId)
    .select('id, is_counted');
  if (error) {
    console.error('[cancelActivityLog] RLS 에러 상세:', JSON.stringify(error));
    throw new Error(`집계 제외 실패: ${error.message} (code: ${error.code})`);
  }
}

// ── 리드 상태 변경 로그 (LeadsPage / DogmaruPage 전용) ───────
// LeadsPage, DogmaruPage에서 updateStatus 호출 시 자동 기록
export async function logLeadStatusChange({
  leadId,
  staffId,
  staffName,
  previousStatus,
  nextStatus,
  channel,
}: {
  leadId: string;
  staffId: string;
  staffName: string;
  previousStatus: string | null;
  nextStatus: string;
  channel?: string | null;
}): Promise<void> {
  // profiles에서 실제 display_name 조회 (이메일/unknown 방지)
  let resolvedName = staffName;
  if (!resolvedName || resolvedName.includes('@') || resolvedName === 'unknown') {
    const { data: profile } = await supabase
      .from('profiles').select('display_name').eq('user_id', staffId).single();
    if (profile?.display_name) resolvedName = profile.display_name;
  }

  // 상태 변경을 action_type으로 매핑
  const action_type = (() => {
    if (nextStatus.includes('부재')) return 'absent';
    if (nextStatus.includes('재케어')) return 'recare_registered';
    if (nextStatus.includes('실패') || nextStatus.includes('해지') || nextStatus.includes('미진행')) return 'failed';
    if (nextStatus.includes('상담')) return 'consultation_success';
    if (nextStatus.includes('개통완료')) return 'activation_completed';
    return 'call_attempt';
  })();

  const { error } = await supabase.from('activity_logs').insert({
    lead_id: leadId,
    sales_record_id: null,
    staff_id: staffId,
    staff_name: resolvedName,
    store_id: null,
    channel: channel ?? null,
    action_type,
    result_type: null,
    previous_status: previousStatus,
    next_status: nextStatus,
    memo: null,
    fail_reason: null,
    next_action_at: null,
    is_counted: true,
    not_counted_reason: null,
    corrected_log_id: null,
    device_info: null,
    ip_address: null,
    created_by: staffId,
  });
  if (error) {
    // 에러 상세 로깅 (디버깅용)
    console.error('[logLeadStatusChange] INSERT 실패:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      staffId,
      staffName,
      action_type,
    });
  }
}

// ── 판매실적 입력/수정 시 로그 기록 (SaleEditForm 전용) ─────
export async function logSalesActivity({
  salesId,
  staffId,
  actionType,
  nextStatus,
  channel,
  product,
}: {
  salesId: string;
  staffId: string;
  actionType: string;
  nextStatus: string;
  channel?: string | null;
  product?: string | null;
}): Promise<void> {
  if (!staffId) return;

  // profiles에서 실제 display_name 조회
  let resolvedName = '';
  const { data: profile } = await supabase
    .from('profiles').select('display_name').eq('user_id', staffId).single();
  resolvedName = profile?.display_name ?? staffId;

  const { error } = await supabase.from('activity_logs').insert({
    lead_id: null,
    sales_record_id: salesId || null,
    staff_id: staffId,
    staff_name: resolvedName,
    store_id: null,
    channel: channel ?? null,
    action_type: actionType,
    result_type: null,
    previous_status: null,
    next_status: nextStatus,
    memo: product ? `상품: ${product}` : null,
    fail_reason: null,
    next_action_at: null,
    is_counted: true,
    not_counted_reason: null,
    corrected_log_id: null,
    device_info: null,
    ip_address: null,
    created_by: staffId,
  });
  if (error) {
    console.error('[logSalesActivity] 로그 기록 실패:', error.message);
  }
}
