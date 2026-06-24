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
  createdBy,
}: {
  leadId: string;
  staffId: string;       // 성과 귀속 대상 (리드 담당자)
  staffName: string;
  previousStatus: string | null;
  nextStatus: string;
  channel?: string | null;
  createdBy?: string;    // 실제 조작자 (관리자일 수 있음)
}): Promise<void> {
  // staff_id 없으면 로그 스킵
  if (!staffId) return;

  // profiles에서 실제 display_name 조회 (이메일/unknown 방지)
  let resolvedName = staffName;
  if (!resolvedName || resolvedName.includes('@') || resolvedName === 'unknown') {
    const { data: profile } = await supabase
      .from('profiles').select('display_name').eq('user_id', staffId).single();
    if (profile?.display_name) resolvedName = profile.display_name;
  }

  // 미배정 여부 판단
  const isUnassigned = !staffId;

  // 채널별 상태값 → action_type 정확한 매핑
  const getActionType = (status: string, ch: string | null): { action_type: string; is_counted: boolean; reason: string | null } => {
    const s = status.trim();
    // 채널 정규화: 'udak', '유닥', '유닧', '유닥(UDak)' 등 → 'udak'
    const rawC = (ch ?? '').toLowerCase();
    const c = rawC.includes('dogmaru') || rawC.includes('도그마루') ? 'dogmaru'
      : rawC.includes('udak') || rawC.includes('유닥') || rawC.includes('유닧') ? 'udak'
      : rawC.includes('moyo') || rawC.includes('모요') ? 'moyo'
      : rawC.includes('meta') || rawC.includes('메타') ? 'meta'
      : (ch ?? '');

    // ── 메타광고 ──────────────────────────────────────────────
    if (c === 'meta' || c === '' || (!['dogmaru','udak','moyo'].includes(c))) {
      if (s === '케어중') return { action_type: 'call_attempt', is_counted: true, reason: null };
      // 띄어쓰기 변형 포함: "부재 중", "부재중", "부재"
      if (s === '부재중' || s === '부재 중' || s === '부재') return { action_type: 'absent', is_counted: true, reason: null };
      if (s === '재케어') return { action_type: 'recare_registered', is_counted: true, reason: null };
      if (s === '취소') return { action_type: 'failed', is_counted: true, reason: null };
      // 띄어쓰기 변형 포함: "개통완료", "개통 완료"
      if (s === '개통완료' || s === '개통 완료') return { action_type: 'activation_completed', is_counted: false, reason: 'sales 기준 집계' };
    }

    // ── 도그마루 ──────────────────────────────────────────────
    if (c === 'dogmaru') {
      if (s === '부재케어' || s === '부재케어대상' || s === '부재') return { action_type: 'absent', is_counted: true, reason: null };
      if (s === '재케어' || s === '재케어대상') return { action_type: 'recare_registered', is_counted: true, reason: null };
      if (s === '실패' || s === '개통철회') return { action_type: 'failed', is_counted: true, reason: null };
      if (s === '해피콜O' || s === '해피콜o') return { action_type: 'call_connected', is_counted: true, reason: null };
      if (s === '해피콜X' || s === '해피콜x') return { action_type: 'absent', is_counted: true, reason: null };
      if (s === '영업O' || s === '영업o') return { action_type: 'consultation_success', is_counted: true, reason: null };
      if (s === '영업X' || s === '영업x') return { action_type: 'failed', is_counted: true, reason: null };
      if (s === '개통완료' || s === '완료') return { action_type: 'activation_completed', is_counted: false, reason: 'sales 기준 집계' };
      if (s === '택배발송' || s === '청약대기' || s === '개통대기') return { action_type: 'delivery_sent', is_counted: false, reason: '진행 상태' };
    }

    // ── 유닥 ──────────────────────────────────────────────────
    if (c === 'udak') {
      if (s === '성공') return { action_type: 'consultation_success', is_counted: true, reason: null };
      if (s === '실패') return { action_type: 'failed', is_counted: true, reason: null };
      if (s === '부재' || s === '미재케어') return { action_type: 'absent', is_counted: true, reason: null };
      if (s === '재케어') return { action_type: 'recare_registered', is_counted: true, reason: null };
      if (s === '택배발송') return { action_type: 'delivery_sent', is_counted: false, reason: '진행 상태' };
      if (s === '개통완료') return { action_type: 'activation_completed', is_counted: false, reason: 'sales 기준 집계' };
    }

    // ── 기타인입 ──────────────────────────────────────────────
    if (s === '미케어') return { action_type: 'status_changed', is_counted: false, reason: '미케어' };
    if (s === '부재') return { action_type: 'absent', is_counted: true, reason: null };
    if (s === '재케어') return { action_type: 'recare_registered', is_counted: true, reason: null };
    if (s === '성공') return { action_type: 'consultation_success', is_counted: true, reason: null };
    if (s === '실패') return { action_type: 'failed', is_counted: true, reason: null };

    // ── 공통 ──────────────────────────────────────────────────
    if (s.includes('개통완료')) return { action_type: 'activation_completed', is_counted: false, reason: 'sales 기준 집계' };
    if (s.includes('설치완료')) return { action_type: 'installation_completed', is_counted: false, reason: 'sales 기준 집계' };
    if (s.includes('정산확정')) return { action_type: 'settlement_confirmed', is_counted: false, reason: 'sales 기준 집계' };
    if (s.includes('택배발송')) return { action_type: 'delivery_sent', is_counted: false, reason: '진행 상태' };
    if (s.includes('부재')) return { action_type: 'absent', is_counted: true, reason: null };
    if (s.includes('재케어')) return { action_type: 'recare_registered', is_counted: true, reason: null };
    if (s.includes('실패') || s.includes('해지') || s.includes('취소') || s.includes('개통철회')) return { action_type: 'failed', is_counted: true, reason: null };

    // 신규접수, 기타 단순 상태 변경
    return { action_type: 'status_changed', is_counted: false, reason: '단순 상태 변경' };
  };

  const { action_type, is_counted, reason } = getActionType(nextStatus, channel ?? null);

  // 로그 기록 실패는 절대 메인 플로우(상태 변경)를 막으면 안 됨
  try {
    // 10분 이내 중복 체크
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase.from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('lead_id', leadId).eq('staff_id', staffId)
      .eq('action_type', action_type).gte('created_at', tenMinAgo);
    const isDuplicate = (count ?? 0) > 0;

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
      is_counted: isDuplicate ? false : (isUnassigned ? false : is_counted),
      not_counted_reason: isDuplicate ? '10분 이내 중복' : (isUnassigned ? '미배정 상태 변경' : reason),
      corrected_log_id: null,
      device_info: null,
      ip_address: null,
      created_by: createdBy ?? staffId,
    });
    if (error) {
      console.warn('[logLeadStatusChange] 로그 기록 실패 (무시):', error.message);
    }
  } catch (e) {
    console.warn('[logLeadStatusChange] 예외 (무시):', e);
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
    is_counted: false,
    not_counted_reason: '판매실적 기록 (sales 기준 집계)',
    corrected_log_id: null,
    device_info: null,
    ip_address: null,
    created_by: staffId,
  });
  if (error) {
    console.error('[logSalesActivity] 로그 기록 실패:', error.message);
  }
}
