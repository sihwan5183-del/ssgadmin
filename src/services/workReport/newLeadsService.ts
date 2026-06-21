// ============================================================
// newLeadsService — 신규 접수건 / 미처리 신규건 집계
// leads 테이블 읽기 전용 참조
// activity_logs와 혼용하지 않음
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { resolveStaffDisplayNames } from './staffDisplayService';
import { maskCustomerName } from './reportFormatService';

const DOGMARU_CAMPAIGN = '도그마루_홈캠';

// 미처리 신규건 기준 상태
const PENDING_STATUS = '신규 접수';

// 이미 처리된 상태 (미처리에서 제외)
const PROCESSED_STATUSES = [
  '부재케어', '부재 중', '재케어', '상담중', '케어중', '실패',
  '상담성공', '택배대기', '택배발송', '개통대기', '개통완료',
  '개통 완료', '정산확정', '취소', '개통철회', '기타', '성공',
];

function getLeadChannel(lead: { campaign_name: string | null; channel: string | null }): string {
  if (lead.campaign_name === DOGMARU_CAMPAIGN) return 'dogmaru';
  if (lead.channel === '유닥') return 'udak';
  if (lead.campaign_name?.includes('모요')) return 'moyo';
  if (lead.campaign_name) return 'meta';
  return 'meta';
}

function elapsedLabel(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}일 전`;
  if (hours >= 1) return `${hours}시간 전`;
  return `${minutes}분 전`;
}

export interface NewLeadItem {
  id: string;
  customer_name_masked: string;
  channel: string;
  status: string;
  assigned_to: string | null;
  assigned_name: string;
  created_at: string;
  elapsed: string;
}

export interface NewLeadsSummary {
  today_new: number;       // 오늘 신규 접수 전체
  pending_new: number;     // 미처리 신규건 (신규 접수 상태)
  today_assigned: number;  // 오늘 배정된 건
  by_channel: {
    meta: number;
    dogmaru: number;
    udak: number;
    moyo: number;
    other: number;
  };
}

// ── 내 업무 대시보드용 신규건 요약 ───────────────────────
export async function getMyNewLeadsSummary(
  userId: string,
  date: string
): Promise<NewLeadsSummary> {
  // 오늘 신규 접수 전체 + 채널별
  const { data: todayLeads } = await supabase
    .from('leads')
    .select('id, channel, campaign_name')
    .eq('assigned_to', userId)
    .gte('created_at', `${date}T00:00:00`)
    .lte('created_at', `${date}T23:59:59`)
    .is('deleted_at', null);

  const [{ count: pending_new }, { count: today_assigned }] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', PENDING_STATUS)
      .is('deleted_at', null),
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .gte('updated_at', `${date}T00:00:00`)
      .lte('updated_at', `${date}T23:59:59`)
      .is('deleted_at', null),
  ]);

  const leads = todayLeads ?? [];
  const by_channel = { meta: 0, dogmaru: 0, udak: 0, moyo: 0, other: 0 };
  leads.forEach((l) => {
    const ch = getLeadChannel(l);
    if (ch === 'dogmaru') by_channel.dogmaru++;
    else if (ch === 'udak') by_channel.udak++;
    else if (ch === 'moyo') by_channel.moyo++;
    else by_channel.meta++;
  });

  return {
    today_new: leads.length,
    pending_new: pending_new ?? 0,
    today_assigned: today_assigned ?? 0,
    by_channel,
  };
}

// ── 내 미처리 신규건 리스트 ──────────────────────────────
export async function getMyPendingNewLeads(userId: string): Promise<NewLeadItem[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, customer_name, channel, campaign_name, status, assigned_to, created_at')
    .eq('assigned_to', userId)
    .eq('status', PENDING_STATUS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  const leads = data ?? [];

  const staffIds = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))] as string[];
  const nameMap = staffIds.length > 0 ? await resolveStaffDisplayNames(staffIds) : new Map();

  return leads.map((l) => ({
    id: l.id,
    customer_name_masked: maskCustomerName(l.customer_name),
    channel: getLeadChannel(l),
    status: l.status,
    assigned_to: l.assigned_to,
    assigned_name: l.assigned_to ? (nameMap.get(l.assigned_to) ?? l.assigned_to) : '미배정',
    created_at: l.created_at,
    elapsed: elapsedLabel(l.created_at),
  }));
}

// ── 팀 업무 현황용 신규건 요약 (관리자: 전체) ────────────
export async function getTeamNewLeadsSummary(
  date: string,
  isAdmin: boolean,
  userId: string
): Promise<{ today_new: number; pending_new: number; by_channel: Record<string, number> }> {
  let baseQuery = supabase.from('leads').select('id, channel, campaign_name, status, created_at', { count: 'exact' }).is('deleted_at', null);
  if (!isAdmin) baseQuery = baseQuery.eq('assigned_to', userId);

  const { data: allLeads } = await baseQuery;
  const leads = allLeads ?? [];

  const todayLeads = leads.filter((l) =>
    l.created_at >= `${date}T00:00:00` && l.created_at <= `${date}T23:59:59`
  );
  const pendingLeads = leads.filter((l) => l.status === PENDING_STATUS);

  const by_channel: Record<string, number> = { meta: 0, dogmaru: 0, udak: 0 };
  todayLeads.forEach((l) => {
    const ch = getLeadChannel(l);
    by_channel[ch] = (by_channel[ch] ?? 0) + 1;
  });

  return {
    today_new: todayLeads.length,
    pending_new: pendingLeads.length,
    by_channel,
  };
}
