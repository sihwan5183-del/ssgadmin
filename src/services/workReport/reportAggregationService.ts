// ============================================================
// reportAggregationService — 일일 업무보고 데이터 집계 (채널별 분리)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { resolveStaffDisplayNames } from './staffDisplayService';
import { getKstDateRangeUtc } from './dateUtils';

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
  customer_name?: string | null;
}

// 채널별 집계 항목 — 채널마다 의미있는 항목이 다름
export interface ChannelSummary {
  channel: string;         // meta | dogmaru | udak | other
  label: string;           // 메타광고 | 도그마루 | 유닥 | 기타인입
  call_attempt: number;    // 메타:케어중, 도그마루:해피콜시도
  call_connected: number;  // 도그마루:해피콜O
  absent: number;          // 부재/부재케어/미재케어
  recare: number;          // 재케어
  failed: number;          // 취소/실패/개통철회/영업X
  consultation_success: number; // 유닥:성공, 도그마루:영업O
  delivery_sent: number;   // 택배발송
  activation_completed: number; // 개통완료 (sales 기준)
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
  channelSummaries: ChannelSummary[];  // 채널별 분리 집계
  activationLogs: DailyReportLog[];
  progressLogs: DailyReportLog[];
  failReasons: FailReasonCount[];
  staffSummaries: StaffDailySummary[];
}

// 채널 구분
function detectChannelBucket(channel: string | null): string {
  if (!channel) return 'other';
  if (channel === 'meta' || channel === '메타') return 'meta';
  if (channel === 'dogmaru' || channel === '도그마루') return 'dogmaru';
  if (channel === 'udak' || channel === '유닥') return 'udak';
  return 'other';
}

const CHANNEL_LABELS: Record<string, string> = {
  meta: '메타광고',
  dogmaru: '도그마루',
  udak: '유닥',
  other: '기타인입',
};

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
  const { start, end } = getKstDateRangeUtc(date, date);

  let query = supabase
    .from('activity_logs')
    .select(`*, leads!left(customer_name)`)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: true });

  if (!isAdmin) query = query.eq('staff_id', userId);
  if (isAdmin && filterStaffId) query = query.eq('staff_id', filterStaffId);
  if (channel && channel !== '전체') query = query.eq('channel', channel);

  const { data, error } = await query;
  if (error) throw error;

  const logs: DailyReportLog[] = (data ?? []).map((r: any) => ({
    ...r,
    customer_name: r.leads?.customer_name ?? null,
    leads: undefined,
  }));

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

  // ── 채널별 분리 집계 ──────────────────────────────────────
  const channelMap = new Map<string, ChannelSummary>();
  const ensureChannel = (ch: string) => {
    if (!channelMap.has(ch)) {
      channelMap.set(ch, {
        channel: ch,
        label: CHANNEL_LABELS[ch] ?? ch,
        call_attempt: 0, call_connected: 0, absent: 0, recare: 0,
        failed: 0, consultation_success: 0, delivery_sent: 0, activation_completed: 0,
      });
    }
    return channelMap.get(ch)!;
  };

  counted.forEach((l) => {
    const ch = detectChannelBucket(l.channel);
    const r = ensureChannel(ch);
    if (l.action_type === 'call_attempt')         r.call_attempt++;
    if (l.action_type === 'call_connected')        r.call_connected++;
    if (l.action_type === 'absent')               r.absent++;
    if (l.action_type === 'recare_registered' || l.action_type === 'recare_completed') r.recare++;
    if (l.action_type === 'failed')               r.failed++;
    if (l.action_type === 'consultation_success') r.consultation_success++;
    if (l.action_type === 'delivery_sent')        r.delivery_sent++;
    if (l.action_type === 'activation_completed') r.activation_completed++;
  });

  // sales 기준 개통완료 (오늘 open_date)
  const { data: salesData } = await supabase.from('sales')
    .select('id, channel, manager, status')
    .eq('open_date', date)
    .eq('status', '개통완료')
    .is('deleted_at', null);

  const { data: profiles } = await supabase.from('profiles').select('user_id, display_name');
  const nameToId = new Map((profiles ?? []).map((p: any) => [p.display_name, p.user_id]));

  const seenSales = new Set<string>();
  (salesData ?? []).forEach((s: any) => {
    if (seenSales.has(s.id)) return;
    seenSales.add(s.id);
    if (filterStaffId) {
      const sid = /^[0-9a-f]{8}-/i.test(s.manager ?? '') ? s.manager : nameToId.get(s.manager ?? '');
      if (sid !== filterStaffId) return;
    }
    const ch = detectChannelBucket(s.channel);
    ensureChannel(ch).activation_completed++;
  });

  // 채널 순서 고정
  const channelOrder = ['meta', 'dogmaru', 'udak', 'other'];
  const channelSummaries = channelOrder
    .map(ch => channelMap.get(ch))
    .filter(Boolean) as ChannelSummary[];

  const activationLogs = counted.filter((l) => l.action_type === 'activation_completed');
  const progressLogs = counted.filter((l) =>
    ['consultation_success', 'delivery_sent'].includes(l.action_type)
  );

  const failLogs = counted.filter((l) => l.action_type === 'failed');
  const reasonMap = new Map<string, number>();
  failLogs.forEach((l) => {
    const r = l.fail_reason ?? '사유 미입력';
    reasonMap.set(r, (reasonMap.get(r) ?? 0) + 1);
  });
  const failReasons: FailReasonCount[] = Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const { data: allProfiles } = await supabase.from('profiles')
    .select('user_id, display_name').is('deleted_at', null);

  const staffMap = new Map<string, StaffDailySummary>();
  (allProfiles ?? []).forEach((p: any) => {
    staffMap.set(p.user_id, {
      staff_id: p.user_id, staff_name: p.display_name, display_name: p.display_name,
      call_attempt: 0, call_connected: 0, absent: 0,
      recare: 0, failed: 0, consultation_success: 0, activation_completed: 0,
    });
  });

  counted.forEach((l) => {
    if (!staffMap.has(l.staff_id)) {
      staffMap.set(l.staff_id, {
        staff_id: l.staff_id, staff_name: l.staff_name,
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

  // sales 기준 담당자별 개통 반영
  seenSales.clear();
  (salesData ?? []).forEach((s: any) => {
    if (seenSales.has(s.id)) return;
    seenSales.add(s.id);
    const sid = /^[0-9a-f]{8}-/i.test(s.manager ?? '') ? s.manager : nameToId.get(s.manager ?? '');
    if (sid && staffMap.has(sid)) staffMap.get(sid)!.activation_completed++;
  });

  return {
    date, logs, summary, channelSummaries,
    activationLogs, progressLogs, failReasons,
    staffSummaries: Array.from(staffMap.values()),
  };
}
