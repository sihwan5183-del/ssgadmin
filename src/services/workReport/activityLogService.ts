// ============================================================
// activityLogService — activity_logs CRUD
// work-report 모듈 전용. 기존 페이지 로직 미사용.
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type {
  ActivityLog,
  ActivityLogInsert,
  ActivityLogWithLead,
  ActivityLogFilter,
} from '@/types/workReport';

// ── 조회 ──────────────────────────────────────────────────
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

  if (filter.dateFrom) {
    query = query.gte('created_at', `${filter.dateFrom}T00:00:00`);
  }
  if (filter.dateTo) {
    query = query.lte('created_at', `${filter.dateTo}T23:59:59`);
  }
  if (filter.staffId) {
    query = query.eq('staff_id', filter.staffId);
  }
  if (filter.actionType) {
    query = query.eq('action_type', filter.actionType);
  }
  if (filter.isCounted !== null && filter.isCounted !== undefined) {
    query = query.eq('is_counted', filter.isCounted);
  }
  if (filter.anomalyOnly) {
    query = query.eq('is_counted', false);
  }

  const { data, error } = await query;
  if (error) throw error;

  // leads join 결과 flatten
  return (data ?? []).map((row: any) => ({
    ...row,
    customer_name: row.leads?.customer_name ?? null,
    leads: undefined,
  })) as ActivityLogWithLead[];
}

// ── 단건 조회 ─────────────────────────────────────────────
export async function fetchActivityLogById(id: string): Promise<ActivityLog | null> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as ActivityLog;
}

// ── 저장 ──────────────────────────────────────────────────
export async function insertActivityLog(
  payload: ActivityLogInsert
): Promise<ActivityLog> {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ActivityLog;
}

// ── 수정 (정정 로그 방식 — 삭제 금지) ───────────────────
export async function correctActivityLog(
  originalId: string,
  correction: Partial<ActivityLogInsert>,
  correctedBy: string
): Promise<ActivityLog> {
  // 원본 조회
  const original = await fetchActivityLogById(originalId);
  if (!original) throw new Error('원본 로그를 찾을 수 없습니다.');

  // 정정 로그 생성 (원본 ID 참조)
  const correctionLog: ActivityLogInsert = {
    ...original,
    ...correction,
    corrected_log_id: originalId,
    is_counted: false, // 정정 로그는 카운트 제외
    not_counted_reason: '정정 로그',
    created_by: correctedBy,
  };

  return insertActivityLog(correctionLog);
}

// ── 집계: 오늘 직원별 요약 ────────────────────────────────
export async function fetchTodaySummaryByStaff(staffId: string) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('activity_logs')
    .select('action_type, is_counted')
    .eq('staff_id', staffId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);

  if (error) throw error;
  return data ?? [];
}
