// ============================================================
// staffPerformanceService — 직원 성과 분석 전용 service
// leads(신규접수) / activity_logs(업무량) / sales(개통·정산) 분리
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { maskCustomerName } from './reportFormatService';
import { getKstDateRangeUtc } from './dateUtils';

// ── 날짜 범위 ────────────────────────────────────────────────
export function buildDateRange(period: string, customFrom?: string, customTo?: string) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const todayKst = fmt(kst);

  if (period === '오늘') return { from: todayKst, to: todayKst };
  if (period === '어제') {
    const y = new Date(kst); y.setDate(kst.getDate() - 1);
    const yStr = fmt(y);
    return { from: yStr, to: yStr };
  }
  if (period === '이번주') {
    const m = new Date(kst); m.setDate(kst.getDate() - ((kst.getDay() + 6) % 7));
    return { from: fmt(m), to: todayKst };
  }
  if (period === '이번달') {
    return { from: `${todayKst.slice(0, 7)}-01`, to: todayKst };
  }
  if (period === '전체기간') return { from: '2020-01-01', to: todayKst };
  if (period === '직접선택') return { from: customFrom ?? todayKst, to: customTo ?? todayKst };
  return { from: todayKst, to: todayKst };
}

export interface PerfFilters {
  staffId?: string;
  channel?: string;
  product?: string;
  isCounted?: boolean;
}

const PENDING_STATUSES = ['신규 접수', '신규접수', '접수', '대기', '상담전', '미처리'];
const COMPLETED_STATUSES = ['개통완료', '설치완료', '변경완료(업셀용)', '택배발송', '청약완료'];

// UUID 판단
function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s);
}

// ── KPI 요약 ────────────────────────────────────────────────
export interface KpiSummary {
  new_leads: number; pending_leads: number;
  call_attempt: number; call_connected: number; absent: number;
  recare: number; failed: number; consultation_success: number;
  activation_completed: number; settlement_confirmed: number;
}

export async function getKpiSummary(
  from: string, to: string, filters: PerfFilters = {}
): Promise<KpiSummary> {
  const { staffId, channel } = filters;
  const { start: lStart, end: lEnd } = getKstDateRangeUtc(from, to);

  // 신규접수
  let lq = supabase.from('leads').select('id', { count: 'exact', head: true })
    .gte('created_at', lStart).lte('created_at', lEnd)
    .is('deleted_at', null);
  if (staffId) lq = lq.eq('assigned_to', staffId);
  const { count: new_leads } = await lq;

  // 미처리 (전체기간)
  let pq = supabase.from('leads').select('id', { count: 'exact', head: true })
    .in('status', PENDING_STATUSES).is('deleted_at', null);
  if (staffId) pq = pq.eq('assigned_to', staffId);
  const { count: pending_leads } = await pq;

  // activity_logs
  const { start: aStart, end: aEnd } = getKstDateRangeUtc(from, to);
  let aq = supabase.from('activity_logs').select('action_type')
    .gte('created_at', aStart).lte('created_at', aEnd)
    .eq('is_counted', true);
  if (staffId) aq = aq.eq('staff_id', staffId);
  if (channel) aq = aq.eq('channel', channel);
  const { data: logs } = await aq;
  const cnt = (t: string[]) => (logs ?? []).filter((l: any) => t.includes(l.action_type)).length;

  // sales — 기간 필터 기준 open_date 조회 (직원 성과 분석용)
  let sq = supabase.from('sales').select('status')
    .gte('open_date', from).lte('open_date', to)
    .is('deleted_at', null);
  const { data: sales } = await sq;
  const activated = (sales ?? []).filter((s: any) =>
    COMPLETED_STATUSES.includes(s.status ?? '')
  ).length;

  return {
    new_leads: new_leads ?? 0, pending_leads: pending_leads ?? 0,
    call_attempt: cnt(['call_attempt']), call_connected: cnt(['call_connected']),
    absent: cnt(['absent']), recare: cnt(['recare_registered', 'recare_completed']),
    failed: cnt(['failed']), consultation_success: cnt(['consultation_success']),
    activation_completed: activated, settlement_confirmed: 0,
  };
}

// ── 직원별 업무 현황 ────────────────────────────────────────
export interface StaffWorkRow {
  staff_id: string; staff_name: string;
  new_leads: number; pending_leads: number;
  call_attempt: number; call_connected: number; absent: number;
  recare: number; failed: number; consultation_success: number;
  activation_completed: number;
  connect_rate: number; success_rate: number; conversion_rate: number;
}

export async function getStaffWorkSummary(
  from: string, to: string, filters: PerfFilters = {}
): Promise<StaffWorkRow[]> {
  const { channel } = filters;
  const { data: profiles } = await supabase
    .from('profiles').select('user_id, display_name').is('deleted_at', null);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));
  const nameToId = new Map((profiles ?? []).map((p: any) => [p.display_name, p.user_id]));

  const { start: aStart, end: aEnd } = getKstDateRangeUtc(from, to);
  let aq = supabase.from('activity_logs')
    .select('staff_id, staff_name, action_type')
    .gte('created_at', aStart).lte('created_at', aEnd)
    .eq('is_counted', true);
  if (channel) aq = aq.eq('channel', channel);
  const { data: logs } = await aq;

  const { start: lStart, end: lEnd } = getKstDateRangeUtc(from, to);
  const { data: leads } = await supabase.from('leads')
    .select('assigned_to, status')
    .gte('created_at', lStart).lte('created_at', lEnd)
    .is('deleted_at', null);

  // ── sales: 기간 필터 기준 open_date 조회, sales.id 기준 dedupe ──
  const { data: salesRaw } = await supabase.from('sales')
    .select('id, manager, status')
    .gte('open_date', from).lte('open_date', to)
    .is('deleted_at', null);

  // sales.id 기준 dedupe 후 UUID→이름 정규화
  const seenSalesIds = new Set<string>();
  const salesDeduped: { staffId: string; }[] = [];
  for (const s of (salesRaw ?? [])) {
    if (!s.manager) continue;
    if (!COMPLETED_STATUSES.includes(s.status ?? '')) continue;
    if (seenSalesIds.has(s.id)) continue;
    seenSalesIds.add(s.id);

    let resolvedId: string | null = null;
    if (isUUID(s.manager)) {
      resolvedId = profileMap.has(s.manager) ? s.manager : null;
    } else {
      resolvedId = nameToId.get(s.manager) ?? null;
    }
    if (!resolvedId) continue;
    salesDeduped.push({ staffId: resolvedId });
  }

  type Row = Omit<StaffWorkRow, 'connect_rate' | 'success_rate' | 'conversion_rate'>;
  const map = new Map<string, Row>();
  const ensure = (id: string, name: string): Row => {
    if (!map.has(id)) map.set(id, {
      staff_id: id,
      staff_name: profileMap.get(id) ?? name,
      new_leads: 0, pending_leads: 0,
      call_attempt: 0, call_connected: 0, absent: 0,
      recare: 0, failed: 0, consultation_success: 0,
      activation_completed: 0,
    });
    return map.get(id)!;
  };

  (logs ?? []).forEach((l: any) => {
    const r = ensure(l.staff_id, l.staff_name);
    if (l.action_type === 'call_attempt') r.call_attempt++;
    if (l.action_type === 'call_connected') r.call_connected++;
    if (l.action_type === 'absent') r.absent++;
    if (['recare_registered', 'recare_completed'].includes(l.action_type)) r.recare++;
    if (l.action_type === 'failed') r.failed++;
    if (l.action_type === 'consultation_success') r.consultation_success++;
  });

  (leads ?? []).forEach((l: any) => {
    if (!l.assigned_to) return;
    const r = ensure(l.assigned_to, '');
    r.new_leads++;
    if (PENDING_STATUSES.includes(l.status)) r.pending_leads++;
  });

  salesDeduped.forEach(({ staffId }) => {
    const r = ensure(staffId, profileMap.get(staffId) ?? staffId);
    r.activation_completed++;
  });

  return [...map.values()].map(r => ({
    ...r,
    connect_rate: r.call_attempt > 0 ? Math.round(r.call_connected / r.call_attempt * 100) : 0,
    success_rate: r.call_connected > 0 ? Math.round(r.consultation_success / r.call_connected * 100) : 0,
    conversion_rate: r.consultation_success > 0 ? Math.round(r.activation_completed / r.consultation_success * 100) : 0,
  })).filter(r => r.call_attempt + r.new_leads + r.activation_completed > 0)
    .sort((a, b) => b.call_attempt - a.call_attempt);
}

// ── 일별 추이 ────────────────────────────────────────────────
export interface DailyTrendRow {
  date: string; new_leads: number;
  call_attempt: number; call_connected: number; absent: number;
  recare: number; consultation_success: number; activation_completed: number;
}

export async function getStaffDailyTrend(
  from: string, to: string, filters: PerfFilters = {}
): Promise<DailyTrendRow[]> {
  const { staffId } = filters;
  const { start: aStart, end: aEnd } = getKstDateRangeUtc(from, to);

  let aq = supabase.from('activity_logs').select('created_at, action_type')
    .gte('created_at', aStart).lte('created_at', aEnd).eq('is_counted', true);
  if (staffId) aq = aq.eq('staff_id', staffId);
  const { data: logs } = await aq;

  const { start: lStart, end: lEnd } = getKstDateRangeUtc(from, to);
  let lq = supabase.from('leads').select('created_at')
    .gte('created_at', lStart).lte('created_at', lEnd).is('deleted_at', null);
  if (staffId) lq = lq.eq('assigned_to', staffId);
  const { data: leads } = await lq;

  const map = new Map<string, DailyTrendRow>();
  const ensure = (date: string) => {
    if (!map.has(date)) map.set(date, {
      date, new_leads: 0, call_attempt: 0, call_connected: 0,
      absent: 0, recare: 0, consultation_success: 0, activation_completed: 0,
    });
    return map.get(date)!;
  };

  // created_at(UTC)을 KST 날짜로 변환
  const toKstDate = (utcStr: string) => {
    const d = new Date(utcStr);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10);
  };

  (leads ?? []).forEach((l: any) => { ensure(toKstDate(l.created_at)).new_leads++; });
  (logs ?? []).forEach((l: any) => {
    const r = ensure(toKstDate(l.created_at));
    if (l.action_type === 'call_attempt') r.call_attempt++;
    if (l.action_type === 'call_connected') r.call_connected++;
    if (l.action_type === 'absent') r.absent++;
    if (['recare_registered', 'recare_completed'].includes(l.action_type)) r.recare++;
    if (l.action_type === 'consultation_success') r.consultation_success++;
  });

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── 채널별 성과 ─────────────────────────────────────────────
export interface ChannelPerformanceRow {
  channel: string; new_leads: number;
  call_attempt: number; call_connected: number; absent: number;
  recare: number; failed: number; consultation_success: number;
  connect_rate: number; success_rate: number;
}

export async function getChannelPerformance(
  from: string, to: string, filters: PerfFilters = {}
): Promise<ChannelPerformanceRow[]> {
  const { staffId, channel } = filters;
  const { start: aStart, end: aEnd } = getKstDateRangeUtc(from, to);

  let aq = supabase.from('activity_logs').select('channel, action_type')
    .gte('created_at', aStart).lte('created_at', aEnd).eq('is_counted', true);
  if (staffId) aq = aq.eq('staff_id', staffId);
  if (channel) aq = aq.eq('channel', channel);
  const { data: logs } = await aq;

  type Raw = Omit<ChannelPerformanceRow, 'connect_rate' | 'success_rate'>;
  const map = new Map<string, Raw>();
  const ensure = (ch: string): Raw => {
    if (!map.has(ch)) map.set(ch, {
      channel: ch, new_leads: 0, call_attempt: 0, call_connected: 0,
      absent: 0, recare: 0, failed: 0, consultation_success: 0,
    });
    return map.get(ch)!;
  };

  (logs ?? []).forEach((l: any) => {
    const r = ensure(l.channel ?? '기타');
    if (l.action_type === 'call_attempt') r.call_attempt++;
    if (l.action_type === 'call_connected') r.call_connected++;
    if (l.action_type === 'absent') r.absent++;
    if (['recare_registered', 'recare_completed'].includes(l.action_type)) r.recare++;
    if (l.action_type === 'failed') r.failed++;
    if (l.action_type === 'consultation_success') r.consultation_success++;
  });

  return [...map.values()].map(r => ({
    ...r,
    connect_rate: r.call_attempt > 0 ? Math.round(r.call_connected / r.call_attempt * 100) : 0,
    success_rate: r.call_connected > 0 ? Math.round(r.consultation_success / r.call_connected * 100) : 0,
  })).sort((a, b) => b.call_attempt - a.call_attempt);
}

// ── 이상/주의 알림 ──────────────────────────────────────────
export interface WarningAlert {
  type: string; label: string; count: number; severity: 'danger' | 'warning' | 'info';
}

export async function getWarningAlerts(): Promise<WarningAlert[]> {
  const alerts: WarningAlert[] = [];
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayKst = kst.toISOString().slice(0, 10);
  const { start: todayStart, end: todayEnd } = getKstDateRangeUtc(todayKst, todayKst);

  const yesterday = new Date(kst); yesterday.setDate(kst.getDate() - 1);
  const cutoffUtc = new Date(`${yesterday.toISOString().slice(0, 10)}T23:59:59.999+09:00`).toISOString();

  const checks = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .in('status', PENDING_STATUSES).lte('created_at', cutoffUtc).is('deleted_at', null),
    supabase.from('leads').select('id', { count: 'exact', head: true })
      .is('assigned_to', null).is('deleted_at', null).in('status', PENDING_STATUSES),
    supabase.from('activity_logs').select('id', { count: 'exact', head: true })
      .eq('is_counted', false).gte('created_at', todayStart).lte('created_at', todayEnd),
    supabase.from('activity_logs').select('id', { count: 'exact', head: true })
      .is('channel', null).gte('created_at', todayStart).lte('created_at', todayEnd),
  ]);

  const [noAttempt, unassigned, excluded, noChannel] = checks.map(r => r.count ?? 0);

  if (noAttempt > 0) alerts.push({ type: 'no_attempt', label: '배정 후 24시간 미시도', count: noAttempt, severity: 'danger' });
  if (unassigned > 0) alerts.push({ type: 'unassigned', label: '담당자 없는 신규건', count: unassigned, severity: 'warning' });
  if (excluded > 0) alerts.push({ type: 'excluded', label: '오늘 집계 제외 로그', count: excluded, severity: 'info' });
  if (noChannel > 0) alerts.push({ type: 'no_channel', label: '채널 없는 로그', count: noChannel, severity: 'info' });

  return alerts;
}

// ── 상세 레코드 조회 ─────────────────────────────────────────
export interface DetailRecord {
  id: string; datetime: string; staff_name: string;
  customer_name: string; channel: string; action_label: string;
  prev_status: string; next_status: string;
  memo: string; fail_reason: string;
  is_counted: boolean; not_counted_reason: string;
  source: 'activity_logs' | 'leads' | 'sales';
}

const ACTION_LABELS: Record<string, string> = {
  call_attempt: '통화시도', call_connected: '연결완료', absent: '부재',
  recare_registered: '재케어등록', recare_completed: '재케어완료',
  failed: '실패', consultation_success: '상담성공',
  activation_completed: '개통완료', settlement_confirmed: '정산확정',
};

export async function getActivityDetailRecords(
  from: string, to: string, actionTypes: string[], staffId?: string, channel?: string
): Promise<DetailRecord[]> {
  const { start, end } = getKstDateRangeUtc(from, to);
  let q = supabase.from('activity_logs')
    .select('id, staff_id, staff_name, channel, action_type, previous_status, next_status, memo, fail_reason, is_counted, not_counted_reason, created_at, leads!left(customer_name)')
    .gte('created_at', start).lte('created_at', end)
    .in('action_type', actionTypes).order('created_at', { ascending: false }).limit(100);
  if (staffId) q = q.eq('staff_id', staffId);
  if (channel) q = q.eq('channel', channel);
  const { data } = await q;
  return (data ?? []).map((r: any) => ({
    id: r.id, datetime: r.created_at, staff_name: r.staff_name,
    customer_name: maskCustomerName(r.leads?.customer_name ?? null),
    channel: r.channel ?? '-',
    action_label: ACTION_LABELS[r.action_type] ?? r.action_type,
    prev_status: r.previous_status ?? '-', next_status: r.next_status ?? '-',
    memo: r.memo ?? '-', fail_reason: r.fail_reason ?? '-',
    is_counted: r.is_counted, not_counted_reason: r.not_counted_reason ?? '',
    source: 'activity_logs' as const,
  }));
}

export async function getLeadDetailRecords(
  from: string, to: string, staffId?: string, statusFilter?: string[]
): Promise<DetailRecord[]> {
  const { start, end } = getKstDateRangeUtc(from, to);
  let q = supabase.from('leads')
    .select('id, customer_name, channel, campaign_name, status, assigned_to, created_at')
    .gte('created_at', start).lte('created_at', end)
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(100);
  if (staffId) q = q.eq('assigned_to', staffId);
  if (statusFilter?.length) q = q.in('status', statusFilter);
  const { data } = await q;
  return (data ?? []).map((r: any) => ({
    id: r.id, datetime: r.created_at, staff_name: '-',
    customer_name: maskCustomerName(r.customer_name),
    channel: r.campaign_name === '도그마루_홈캠' ? 'dogmaru' : r.channel === '유닥' ? 'udak' : 'meta',
    action_label: '신규접수', prev_status: '-', next_status: r.status ?? '-',
    memo: '-', fail_reason: '-', is_counted: true, not_counted_reason: '',
    source: 'leads' as const,
  }));
}
