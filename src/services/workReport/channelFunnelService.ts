// ============================================================
// channelFunnelService — 채널별 퍼널 분석 전용 서비스
// leads 테이블 현재 스냅샷 기준 집계
// lead_status_logs previous_status 기준 전환 집계 (신규 데이터부터)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { getKstDateRangeUtc } from './dateUtils';

// ── 채널 분류 헬퍼 ────────────────────────────────────────────
export function detectChannel(
  channel: string | null,
  campaignName: string | null,
  source?: string | null
): string {
  if (campaignName === '도그마루_홈캠') return 'dogmaru';
  if (channel === '유닥' || channel === '유닧') return 'udak';
  if (source === 'allinone' || channel === '올인원') return 'allinone';
  if (channel === 'meta' || (campaignName && campaignName !== '도그마루_홈캠')) return 'meta';
  return 'other';
}

export const CHANNEL_LABEL: Record<string, string> = {
  meta: '메타',
  dogmaru: '도그마루',
  udak: '유닥',
  allinone: '올인원',
  other: '기타인입',
  all: '전체',
};

export const CHANNEL_KEYS = ['meta', 'dogmaru', 'udak', 'allinone', 'other'] as const;
export type ChannelKey = typeof CHANNEL_KEYS[number] | 'all';

// 부재케어 3일 경과 = 실패 카운팅 기준 (일)
const ABSENT_FAIL_DAYS = 3;

// ── 채널별 퍼널 Row 타입 ──────────────────────────────────────
export interface ChannelFunnelRow {
  channel: string;
  // 신규
  new_total: number;
  // 부재케어
  absent_count: number;        // 현재 부재케어 상태 건수
  absent_rate: number;         // 부재율 = absent_count / new_total
  absent_expired: number;      // 3일 경과 부재케어 (실패 카운팅)
  // 재케어
  recare_count: number;        // 현재 재케어 상태 건수
  recare_from_absent: number;  // 부재케어→재케어 전환 건수 (previous_status 기준)
  recare_rate: number;         // 재케어율 = recare_count / new_total
  // 성공/실패
  success_count: number;       // 성공 상태 건수
  fail_count: number;          // 실패 상태 건수 (3일경과 부재케어 포함)
  recare_success_count: number; // 재케어→성공 전환 건수
  recare_fail_count: number;    // 재케어→실패 전환 건수
  recare_success_rate: number;  // 재케어 성공률 = recare_success / recare_count
  recare_fail_rate: number;     // 재케어 실패율 = recare_fail / recare_count
}

// ── 담당자별 퍼널 Row 타입 ────────────────────────────────────
export interface StaffFunnelRow {
  staff_name: string;
  staff_id: string | null;
  main_channel: string;        // 가장 많은 채널
  channels: Record<string, number>; // 채널별 건수
  absent_count: number;
  recare_count: number;
  success_count: number;
  fail_count: number;
  recare_success_count: number;
  recare_fail_count: number;
  recare_success_rate: number;
  recare_fail_rate: number;
  // 전일 대비
  yesterday_absent: number;
  yesterday_recare: number;
  absent_diff: number;         // 오늘 - 어제
  recare_diff: number;
}

// ── 드릴다운 리드 Row 타입 ────────────────────────────────────
export interface FunnelLeadRow {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  channel: string;
  status: string;
  created_at: string;
  last_action_at: string | null;
  memo: string | null;
  days_since_last_action: number; // 마지막 액션으로부터 경과 일수
}

// ── 날짜 범위 계산 ────────────────────────────────────────────
export function buildFunnelDateRange(period: string, customFrom?: string, customTo?: string) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = fmt(kst);
  const yesterday = (() => { const d = new Date(kst); d.setDate(kst.getDate() - 1); return fmt(d); })();

  switch (period) {
    case '오늘':    return { from: today, to: today };
    case '전일':    return { from: yesterday, to: yesterday };
    case '이번주': {
      const mon = new Date(kst);
      mon.setDate(kst.getDate() - ((kst.getDay() + 6) % 7));
      return { from: fmt(mon), to: today };
    }
    case '이번달': return { from: `${today.slice(0, 7)}-01`, to: today };
    case '전체':   return { from: '2020-01-01', to: today };
    case '직접선택': return { from: customFrom ?? today, to: customTo ?? today };
    default:       return { from: today, to: today };
  }
}

// ── 채널별 퍼널 집계 ─────────────────────────────────────────
export async function getChannelFunnelData(
  from: string,
  to: string,
  filterChannel?: ChannelKey
): Promise<{ rows: ChannelFunnelRow[]; total: ChannelFunnelRow }> {
  const { start, end } = getKstDateRangeUtc(from, to);
  const today = new Date().toISOString().slice(0, 10);

  // 1. leads 테이블 - 해당 기간 생성된 리드
  const { data: leads } = await supabase
    .from('leads')
    .select('id, channel, campaign_name, source, status, last_action_at, assigned_to')
    .gte('created_at', start)
    .lte('created_at', end)
    .is('deleted_at', null);

  // 2. lead_status_logs - 전환 집계 (previous_status 기준)
  const leadIds = (leads ?? []).map((l: any) => l.id);
  let transitionLogs: any[] = [];
  if (leadIds.length > 0) {
    const { data: logs } = await supabase
      .from('lead_status_logs')
      .select('lead_id, status, previous_status, changed_at')
      .in('lead_id', leadIds)
      .not('previous_status', 'is', null);
    transitionLogs = logs ?? [];
  }

  // 채널별 초기화
  const init = (): Omit<ChannelFunnelRow, 'channel' | 'absent_rate' | 'recare_rate' | 'recare_success_rate' | 'recare_fail_rate'> => ({
    new_total: 0, absent_count: 0, absent_expired: 0,
    recare_count: 0, recare_from_absent: 0,
    success_count: 0, fail_count: 0,
    recare_success_count: 0, recare_fail_count: 0,
  });

  const map = new Map<string, ReturnType<typeof init>>();
  const ensure = (ch: string) => {
    if (!map.has(ch)) map.set(ch, init());
    return map.get(ch)!;
  };

  // 3. leads 집계
  for (const lead of (leads ?? [])) {
    const ch = detectChannel(lead.channel, lead.campaign_name, lead.source);
    if (filterChannel && filterChannel !== 'all' && ch !== filterChannel) continue;

    const r = ensure(ch);
    r.new_total++;

    const st = lead.status ?? '';
    if (st === '부재케어' || st === '부재 중' || st === '부재') {
      r.absent_count++;
      // 3일 경과 체크
      const lastAt = lead.last_action_at;
      if (lastAt) {
        const diffDays = Math.floor((new Date(today).getTime() - new Date(lastAt.slice(0, 10)).getTime()) / 86400000);
        if (diffDays >= ABSENT_FAIL_DAYS) r.absent_expired++;
      }
    }
    if (st === '재케어') r.recare_count++;
    if (st === '성공' || st === '개통 완료' || st === '개통완료') r.success_count++;
    if (st === '실패' || st === '취소') r.fail_count++;
  }

  // 4. 전환 로그 집계
  const leadChMap = new Map<string, string>();
  for (const lead of (leads ?? [])) {
    leadChMap.set(lead.id, detectChannel(lead.channel, lead.campaign_name, lead.source));
  }

  for (const log of transitionLogs) {
    const ch = leadChMap.get(log.lead_id) ?? 'other';
    if (filterChannel && filterChannel !== 'all' && ch !== filterChannel) continue;
    if (!map.has(ch)) continue;
    const r = map.get(ch)!;

    const prev = log.previous_status ?? '';
    const next = log.status ?? '';
    const isAbsent = (s: string) => ['부재케어', '부재 중', '부재'].includes(s);
    const isSuccess = (s: string) => ['성공', '개통 완료', '개통완료'].includes(s);
    const isFail = (s: string) => ['실패', '취소'].includes(s);

    if (isAbsent(prev) && next === '재케어') r.recare_from_absent++;
    if (prev === '재케어' && isSuccess(next)) r.recare_success_count++;
    if (prev === '재케어' && isFail(next)) r.recare_fail_count++;
  }

  // 5. 비율 계산
  const pct = (n: number, d: number) => d > 0 ? Math.round(n / d * 1000) / 10 : 0;

  const finalRows: ChannelFunnelRow[] = [...map.entries()].map(([ch, r]) => ({
    channel: ch,
    ...r,
    fail_count: r.fail_count + r.absent_expired, // 실패 = 실패 + 3일경과부재
    absent_rate: pct(r.absent_count, r.new_total),
    recare_rate: pct(r.recare_count, r.new_total),
    recare_success_rate: pct(r.recare_success_count, r.recare_count),
    recare_fail_rate: pct(r.recare_fail_count, r.recare_count),
  })).sort((a, b) => b.new_total - a.new_total);

  // 전체 합계 row
  const totalBase = [...map.values()].reduce((acc, r) => {
    for (const k of Object.keys(acc) as (keyof typeof acc)[]) {
      (acc[k] as number) += (r[k] as number);
    }
    return acc;
  }, init());
  const total: ChannelFunnelRow = {
    channel: 'all',
    ...totalBase,
    fail_count: totalBase.fail_count + totalBase.absent_expired,
    absent_rate: pct(totalBase.absent_count, totalBase.new_total),
    recare_rate: pct(totalBase.recare_count, totalBase.new_total),
    recare_success_rate: pct(totalBase.recare_success_count, totalBase.recare_count),
    recare_fail_rate: pct(totalBase.recare_fail_count, totalBase.recare_count),
  };

  return { rows: finalRows, total };
}

// ── 담당자별 퍼널 집계 ───────────────────────────────────────
export async function getStaffFunnelData(
  from: string,
  to: string,
  filterChannel?: ChannelKey
): Promise<StaffFunnelRow[]> {
  const { start, end } = getKstDateRangeUtc(from, to);
  const today = new Date().toISOString().slice(0, 10);

  // 어제 범위
  const yDate = new Date(new Date().getTime() + 9*60*60*1000);
  yDate.setDate(yDate.getDate() - 1);
  const yStr = yDate.toISOString().slice(0, 10);
  const { start: yStart, end: yEnd } = getKstDateRangeUtc(yStr, yStr);

  const [{ data: leads }, { data: staff }, { data: yesterdayLeads }] = await Promise.all([
    supabase.from('leads')
      .select('id, channel, campaign_name, source, status, last_action_at, assigned_to')
      .gte('created_at', start).lte('created_at', end).is('deleted_at', null),
    supabase.from('users').select('id, display_name'),
    supabase.from('leads')
      .select('assigned_to, channel, campaign_name, source, status')
      .gte('created_at', yStart).lte('created_at', yEnd).is('deleted_at', null),
  ]);

  const staffNameMap = new Map<string, string>(
    (staff ?? []).map((s: any) => [s.id, s.display_name ?? s.id])
  );

  const map = new Map<string, {
    staff_id: string | null;
    channels: Record<string, number>;
    absent_count: number; recare_count: number;
    success_count: number; fail_count: number;
    recare_success_count: number; recare_fail_count: number;
  }>();

  const ensure = (name: string, id: string | null) => {
    if (!map.has(name)) {
      map.set(name, {
        staff_id: id,
        channels: {},
        absent_count: 0, recare_count: 0,
        success_count: 0, fail_count: 0,
        recare_success_count: 0, recare_fail_count: 0,
      });
    }
    return map.get(name)!;
  };

  for (const lead of (leads ?? [])) {
    const ch = detectChannel(lead.channel, lead.campaign_name, lead.source);
    if (filterChannel && filterChannel !== 'all' && ch !== filterChannel) continue;
    const name = staffNameMap.get(lead.assigned_to) ?? '(미지정)';
    const r = ensure(name, lead.assigned_to);
    r.channels[ch] = (r.channels[ch] ?? 0) + 1;
    const st = lead.status ?? '';
    if (['부재케어', '부재 중', '부재'].includes(st)) r.absent_count++;
    if (st === '재케어') r.recare_count++;
    if (['성공', '개통 완료', '개통완료'].includes(st)) r.success_count++;
    if (['실패', '취소'].includes(st)) r.fail_count++;
  }

  // 전환 로그
  const leadIds = (leads ?? []).map((l: any) => l.id);
  if (leadIds.length > 0) {
    const { data: logs } = await supabase
      .from('lead_status_logs')
      .select('lead_id, status, previous_status')
      .in('lead_id', leadIds)
      .not('previous_status', 'is', null);

    const leadStaffMap = new Map((leads ?? []).map((l: any) => [
      l.id,
      { name: staffNameMap.get(l.assigned_to) ?? '(미지정)', id: l.assigned_to, ch: detectChannel(l.channel, l.campaign_name, l.source) }
    ]));

    for (const log of (logs ?? [])) {
      const info = leadStaffMap.get(log.lead_id);
      if (!info) continue;
      if (filterChannel && filterChannel !== 'all' && info.ch !== filterChannel) continue;
      const r = map.get(info.name);
      if (!r) continue;
      const prev = log.previous_status ?? '';
      const next = log.status ?? '';
      if (['부재케어','부재 중','부재'].includes(prev) && next === '재케어') {}
      if (prev === '재케어' && ['성공','개통 완료','개통완료'].includes(next)) r.recare_success_count++;
      if (prev === '재케어' && ['실패','취소'].includes(next)) r.recare_fail_count++;
    }
  }

  // 어제 데이터
  const yMap = new Map<string, { absent: number; recare: number }>();
  for (const lead of (yesterdayLeads ?? [])) {
    const ch = detectChannel(lead.channel, lead.campaign_name, lead.source);
    if (filterChannel && filterChannel !== 'all' && ch !== filterChannel) continue;
    const name = staffNameMap.get(lead.assigned_to) ?? '(미지정)';
    if (!yMap.has(name)) yMap.set(name, { absent: 0, recare: 0 });
    const y = yMap.get(name)!;
    const st = lead.status ?? '';
    if (['부재케어','부재 중','부재'].includes(st)) y.absent++;
    if (st === '재케어') y.recare++;
  }

  const pct = (n: number, d: number) => d > 0 ? Math.round(n / d * 1000) / 10 : 0;

  return [...map.entries()].map(([name, r]) => {
    const mainCh = Object.entries(r.channels).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
    const y = yMap.get(name) ?? { absent: 0, recare: 0 };
    return {
      staff_name: name,
      staff_id: r.staff_id,
      main_channel: mainCh,
      channels: r.channels,
      absent_count: r.absent_count,
      recare_count: r.recare_count,
      success_count: r.success_count,
      fail_count: r.fail_count,
      recare_success_count: r.recare_success_count,
      recare_fail_count: r.recare_fail_count,
      recare_success_rate: pct(r.recare_success_count, r.recare_count),
      recare_fail_rate: pct(r.recare_fail_count, r.recare_count),
      yesterday_absent: y.absent,
      yesterday_recare: y.recare,
      absent_diff: r.absent_count - y.absent,
      recare_diff: r.recare_count - y.recare,
    };
  }).sort((a, b) => b.absent_count - a.absent_count);
}

// ── 드릴다운 리드 목록 ────────────────────────────────────────
export type DrillType =
  | 'absent'           // 부재케어
  | 'absent_expired'   // 3일경과 부재케어
  | 'recare'           // 재케어
  | 'recare_from_absent' // 부재→재케어 전환
  | 'success'          // 성공
  | 'fail'             // 실패
  | 'recare_success'   // 재케어→성공
  | 'recare_fail';     // 재케어→실패

export async function getFunnelDrillLeads(
  from: string,
  to: string,
  drillType: DrillType,
  channel?: ChannelKey,
  staffId?: string
): Promise<FunnelLeadRow[]> {
  const { start, end } = getKstDateRangeUtc(from, to);
  const today = new Date().toISOString().slice(0, 10);

  // 기본 leads 조회
  let q = supabase.from('leads')
    .select('id, customer_name, customer_phone, assigned_to, channel, campaign_name, source, status, created_at, last_action_at, memo')
    .gte('created_at', start).lte('created_at', end)
    .is('deleted_at', null);

  if (staffId) q = q.eq('assigned_to', staffId);

  const { data: leads } = await q;
  const allLeads = leads ?? [];

  // 채널 필터
  const filtered = allLeads.filter((l: any) => {
    const ch = detectChannel(l.channel, l.campaign_name, l.source);
    if (channel && channel !== 'all' && ch !== channel) return false;
    return true;
  });

  // staff 이름
  const staffIds = [...new Set(filtered.map((l: any) => l.assigned_to).filter(Boolean))];
  let staffNameMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staffData } = await supabase.from('users').select('id, display_name').in('id', staffIds);
    staffNameMap = new Map((staffData ?? []).map((s: any) => [s.id, s.display_name ?? s.id]));
  }

  const isAbsent = (s: string) => ['부재케어', '부재 중', '부재'].includes(s);
  const isSuccess = (s: string) => ['성공', '개통 완료', '개통완료'].includes(s);
  const isFail = (s: string) => ['실패', '취소'].includes(s);

  let targetLeads: any[] = [];

  if (drillType === 'absent') {
    targetLeads = filtered.filter((l: any) => isAbsent(l.status ?? ''));
  } else if (drillType === 'absent_expired') {
    targetLeads = filtered.filter((l: any) => {
      if (!isAbsent(l.status ?? '')) return false;
      const lastAt = l.last_action_at;
      if (!lastAt) return false;
      const diff = Math.floor((new Date(today).getTime() - new Date(lastAt.slice(0,10)).getTime()) / 86400000);
      return diff >= 3;
    });
  } else if (drillType === 'recare') {
    targetLeads = filtered.filter((l: any) => l.status === '재케어');
  } else if (drillType === 'success') {
    targetLeads = filtered.filter((l: any) => isSuccess(l.status ?? ''));
  } else if (drillType === 'fail') {
    targetLeads = filtered.filter((l: any) => isFail(l.status ?? ''));
  } else if (['recare_from_absent', 'recare_success', 'recare_fail'].includes(drillType)) {
    // 전환 로그 기반 조회
    const leadIds = filtered.map((l: any) => l.id);
    if (leadIds.length === 0) return [];
    const { data: logs } = await supabase
      .from('lead_status_logs')
      .select('lead_id, status, previous_status')
      .in('lead_id', leadIds)
      .not('previous_status', 'is', null);

    const matchedIds = new Set<string>();
    for (const log of (logs ?? [])) {
      const prev = log.previous_status ?? '';
      const next = log.status ?? '';
      if (drillType === 'recare_from_absent' && isAbsent(prev) && next === '재케어') matchedIds.add(log.lead_id);
      if (drillType === 'recare_success' && prev === '재케어' && isSuccess(next)) matchedIds.add(log.lead_id);
      if (drillType === 'recare_fail' && prev === '재케어' && isFail(next)) matchedIds.add(log.lead_id);
    }
    targetLeads = filtered.filter((l: any) => matchedIds.has(l.id));
  }

  const todayMs = new Date(today).getTime();
  return targetLeads.map((l: any) => ({
    id: l.id,
    customer_name: l.customer_name,
    customer_phone: l.customer_phone,
    assigned_to: l.assigned_to,
    assigned_name: staffNameMap.get(l.assigned_to) ?? '(미지정)',
    channel: detectChannel(l.channel, l.campaign_name, l.source),
    status: l.status ?? '',
    created_at: l.created_at,
    last_action_at: l.last_action_at,
    memo: l.memo,
    days_since_last_action: l.last_action_at
      ? Math.floor((todayMs - new Date(l.last_action_at.slice(0, 10)).getTime()) / 86400000)
      : 999,
  })).sort((a, b) => b.days_since_last_action - a.days_since_last_action);
}
