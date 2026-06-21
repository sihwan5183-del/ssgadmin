// ============================================================
// staffPerformanceService — 직원 성과 분석 전용 service
// leads(신규접수) / activity_logs(업무량) / sales(개통·정산) 분리
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { maskCustomerName } from './reportFormatService';
import { getMonthRange } from './salesReportService';

// ── 날짜 범위 ────────────────────────────────────────────────
export function buildDateRange(period: string, customFrom?: string, customTo?: string) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (period === '오늘') return { from: fmt(today), to: fmt(today) };
  if (period === '어제') {
    const y = new Date(today); y.setDate(today.getDate() - 1);
    return { from: fmt(y), to: fmt(y) };
  }
  if (period === '이번주') {
    const m = new Date(today); m.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: fmt(m), to: fmt(today) };
  }
  if (period === '이번달') {
    return { from: `${fmt(today).slice(0, 7)}-01`, to: fmt(today) };
  }
  if (period === '직접선택') return { from: customFrom ?? fmt(today), to: customTo ?? fmt(today) };
  return { from: fmt(today), to: fmt(today) };
}

// ── 미처리 신규건 status ────────────────────────────────────
const PENDING_STATUSES = ['신규 접수', '신규접수', '접수', '대기', '상담전', '미처리'];

// ── KPI 요약 ────────────────────────────────────────────────
export interface KpiSummary {
  new_leads: number;
  pending_leads: number;
  call_attempt: number;
  call_connected: number;
  absent: number;
  recare: number;
  failed: number;
  consultation_success: number;
  activation_completed: number;
  settlement_confirmed: number;
}

export async function getKpiSummary(
  from: string, to: string,
  staffId?: string, channel?: string
): Promise<KpiSummary> {
  // 신규접수 (leads)
  let lq = supabase.from('leads').select('id', { count: 'exact', head: true })
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
    .is('deleted_at', null);
  if (staffId) lq = lq.eq('assigned_to', staffId);
  const { count: new_leads } = await lq;

  // 미처리
  let pq = supabase.from('leads').select('id', { count: 'exact', head: true })
    .in('status', PENDING_STATUSES).is('deleted_at', null);
  if (staffId) pq = pq.eq('assigned_to', staffId);
  const { count: pending_leads } = await pq;

  // activity_logs
  let aq = supabase.from('activity_logs').select('action_type')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
    .eq('is_counted', true);
  if (staffId) aq = aq.eq('staff_id', staffId);
  if (channel) aq = aq.eq('channel', channel);
  const { data: logs } = await aq;

  const count = (t: string[]) => (logs ?? []).filter(l => t.includes(l.action_type)).length;

  // sales (개통/정산)
  const { start, end } = getMonthRange(from.slice(0, 7));
  let sq = supabase.from('sales').select('status')
    .gte('open_date', start).lte('open_date', end).is('deleted_at', null);
  const { data: sales } = await sq;
  const activated = (sales ?? []).filter(s =>
    ['개통완료','설치완료','변경완료(업셀용)','택배발송','청약완료'].some(x => (s.status ?? '').includes(x))
  ).length;

  return {
    new_leads: new_leads ?? 0,
    pending_leads: pending_leads ?? 0,
    call_attempt: count(['call_attempt']),
    call_connected: count(['call_connected']),
    absent: count(['absent']),
    recare: count(['recare_registered','recare_completed']),
    failed: count(['failed']),
    consultation_success: count(['consultation_success']),
    activation_completed: activated,
    settlement_confirmed: 0,
  };
}

// ── 직원별 업무 현황 ────────────────────────────────────────
export interface StaffWorkRow {
  staff_id: string;
  staff_name: string;
  new_leads: number;
  pending_leads: number;
  call_attempt: number;
  call_connected: number;
  absent: number;
  recare: number;
  failed: number;
  consultation_success: number;
  activation_completed: number;
  // 전환율
  connect_rate: number;
  success_rate: number;
  conversion_rate: number;
}

export async function getStaffWorkSummary(
  from: string, to: string, channel?: string
): Promise<StaffWorkRow[]> {
  // profiles
  const { data: profiles } = await supabase
    .from('profiles').select('user_id, display_name').is('deleted_at', null);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name]));

  // activity_logs
  let aq = supabase.from('activity_logs')
    .select('staff_id, staff_name, action_type')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
    .eq('is_counted', true);
  if (channel) aq = aq.eq('channel', channel);
  const { data: logs } = await aq;

  // leads (신규/미처리)
  const { data: leads } = await supabase
    .from('leads').select('assigned_to, status')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
    .is('deleted_at', null);

  // sales
  const month = from.slice(0, 7);
  const { start, end } = getMonthRange(month);
  const { data: sales } = await supabase.from('sales')
    .select('manager, status').gte('open_date', start).lte('open_date', end)
    .is('deleted_at', null);

  // 집계
  const map = new Map<string, Omit<StaffWorkRow, 'connect_rate' | 'success_rate' | 'conversion_rate'>>();
  const ensure = (id: string, name: string) => {
    if (!map.has(id)) map.set(id, { staff_id: id, staff_name: profileMap.get(id) ?? name, new_leads: 0, pending_leads: 0, call_attempt: 0, call_connected: 0, absent: 0, recare: 0, failed: 0, consultation_success: 0, activation_completed: 0 });
    return map.get(id)!;
  };

  (logs ?? []).forEach((l: any) => {
    const r = ensure(l.staff_id, l.staff_name);
    if (l.action_type === 'call_attempt') r.call_attempt++;
    if (l.action_type === 'call_connected') r.call_connected++;
    if (l.action_type === 'absent') r.absent++;
    if (['recare_registered','recare_completed'].includes(l.action_type)) r.recare++;
    if (l.action_type === 'failed') r.failed++;
    if (l.action_type === 'consultation_success') r.consultation_success++;
  });

  (leads ?? []).forEach((l: any) => {
    if (!l.assigned_to) return;
    const r = ensure(l.assigned_to, '');
    r.new_leads++;
    if (PENDING_STATUSES.includes(l.status)) r.pending_leads++;
  });

  (sales ?? []).forEach((s: any) => {
    if (!s.manager) return;
    // manager가 이름인 경우 매핑
    const staffId = [...profileMap.entries()].find(([, name]) => name === s.manager)?.[0] ?? s.manager;
    const r = ensure(staffId, s.manager);
    if (['개통완료','설치완료','변경완료(업셀용)','택배발송','청약완료'].some(x => (s.status ?? '').includes(x))) r.activation_completed++;
  });

  return [...map.values()].map(r => ({
    ...r,
    connect_rate: r.call_attempt > 0 ? Math.round(r.call_connected / r.call_attempt * 100) : 0,
    success_rate: r.call_connected > 0 ? Math.round(r.consultation_success / r.call_connected * 100) : 0,
    conversion_rate: r.consultation_success > 0 ? Math.round(r.activation_completed / r.consultation_success * 100) : 0,
  })).sort((a, b) => b.call_attempt - a.call_attempt);
}

// ── 일별 추이 ────────────────────────────────────────────────
export interface DailyTrendRow {
  date: string;
  new_leads: number;
  call_attempt: number;
  call_connected: number;
  absent: number;
  recare: number;
  consultation_success: number;
  activation_completed: number;
}

export async function getStaffDailyTrend(
  from: string, to: string, staffId?: string
): Promise<DailyTrendRow[]> {
  const [{ data: logs }, { data: leads }] = await Promise.all([
    supabase.from('activity_logs').select('created_at, action_type')
      .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
      .eq('is_counted', true)
      .then(q => staffId ? supabase.from('activity_logs').select('created_at, action_type').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`).eq('is_counted', true).eq('staff_id', staffId) : q),
    supabase.from('leads').select('created_at').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`).is('deleted_at', null).then(q => staffId ? supabase.from('leads').select('created_at').gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`).is('deleted_at', null).eq('assigned_to', staffId) : q),
  ]);

  const dayMap = new Map<string, DailyTrendRow>();
  const ensure = (date: string) => {
    if (!dayMap.has(date)) dayMap.set(date, { date, new_leads: 0, call_attempt: 0, call_connected: 0, absent: 0, recare: 0, consultation_success: 0, activation_completed: 0 });
    return dayMap.get(date)!;
  };

  (leads ?? []).forEach((l: any) => { ensure(l.created_at.slice(0, 10)).new_leads++; });
  (logs ?? []).forEach((l: any) => {
    const r = ensure(l.created_at.slice(0, 10));
    if (l.action_type === 'call_attempt') r.call_attempt++;
    if (l.action_type === 'call_connected') r.call_connected++;
    if (l.action_type === 'absent') r.absent++;
    if (['recare_registered','recare_completed'].includes(l.action_type)) r.recare++;
    if (l.action_type === 'consultation_success') r.consultation_success++;
  });

  return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ── 채널별 성과 ─────────────────────────────────────────────
export interface ChannelPerformanceRow {
  channel: string;
  new_leads: number;
  call_attempt: number;
  call_connected: number;
  absent: number;
  recare: number;
  failed: number;
  consultation_success: number;
  connect_rate: number;
  success_rate: number;
}

export async function getChannelPerformance(
  from: string, to: string, staffId?: string
): Promise<ChannelPerformanceRow[]> {
  let aq = supabase.from('activity_logs').select('channel, action_type')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`).eq('is_counted', true);
  if (staffId) aq = aq.eq('staff_id', staffId);
  const { data: logs } = await aq;

  const map = new Map<string, Omit<ChannelPerformanceRow, 'connect_rate' | 'success_rate'>>();
  const ensure = (ch: string) => {
    if (!map.has(ch)) map.set(ch, { channel: ch, new_leads: 0, call_attempt: 0, call_connected: 0, absent: 0, recare: 0, failed: 0, consultation_success: 0 });
    return map.get(ch)!;
  };

  (logs ?? []).forEach((l: any) => {
    const r = ensure(l.channel ?? '기타');
    if (l.action_type === 'call_attempt') r.call_attempt++;
    if (l.action_type === 'call_connected') r.call_connected++;
    if (l.action_type === 'absent') r.absent++;
    if (['recare_registered','recare_completed'].includes(l.action_type)) r.recare++;
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
  type: string;
  label: string;
  count: number;
  severity: 'danger' | 'warning' | 'info';
}

export async function getWarningAlerts(): Promise<WarningAlert[]> {
  const alerts: WarningAlert[] = [];
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const cutoff = yesterday.toISOString();

  // 배정 후 24시간 미시도
  const { count: noAttempt } = await supabase.from('leads')
    .select('id', { count: 'exact', head: true })
    .in('status', PENDING_STATUSES).lte('created_at', cutoff).is('deleted_at', null);
  if ((noAttempt ?? 0) > 0) alerts.push({ type: 'no_attempt', label: '배정 후 24시간 미시도', count: noAttempt ?? 0, severity: 'danger' });

  // 담당자 없는 리드
  const { count: unassigned } = await supabase.from('leads')
    .select('id', { count: 'exact', head: true }).is('assigned_to', null).is('deleted_at', null).in('status', PENDING_STATUSES);
  if ((unassigned ?? 0) > 0) alerts.push({ type: 'unassigned', label: '담당자 없는 신규건', count: unassigned ?? 0, severity: 'warning' });

  // 집계 제외된 로그 (오늘)
  const today = new Date().toISOString().split('T')[0];
  const { count: excluded } = await supabase.from('activity_logs')
    .select('id', { count: 'exact', head: true }).eq('is_counted', false)
    .gte('created_at', `${today}T00:00:00`);
  if ((excluded ?? 0) > 0) alerts.push({ type: 'excluded', label: '오늘 집계 제외된 로그', count: excluded ?? 0, severity: 'info' });

  return alerts;
}

// ── 상세 레코드 조회 (팝업용) ────────────────────────────────
export interface DetailRecord {
  id: string;
  datetime: string;
  staff_name: string;
  customer_name: string;
  channel: string;
  action_label: string;
  prev_status: string;
  next_status: string;
  memo: string;
  fail_reason: string;
  is_counted: boolean;
  not_counted_reason: string;
  source: 'activity_logs' | 'leads' | 'sales';
}

const ACTION_LABELS: Record<string, string> = {
  call_attempt: '통화시도', call_connected: '연결완료', absent: '부재',
  recare_registered: '재케어등록', recare_completed: '재케어완료',
  failed: '실패', consultation_success: '상담성공',
  activation_completed: '개통완료', settlement_confirmed: '정산확정',
};

export async function getActivityDetailRecords(
  from: string, to: string,
  actionTypes: string[], staffId?: string, channel?: string
): Promise<DetailRecord[]> {
  let q = supabase.from('activity_logs')
    .select('id, staff_id, staff_name, channel, action_type, previous_status, next_status, memo, fail_reason, is_counted, not_counted_reason, created_at, leads!left(customer_name)')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
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
  let q = supabase.from('leads')
    .select('id, customer_name, channel, campaign_name, status, assigned_to, created_at')
    .gte('created_at', `${from}T00:00:00`).lte('created_at', `${to}T23:59:59`)
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
