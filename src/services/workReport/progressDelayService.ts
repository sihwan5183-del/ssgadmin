// ============================================================
// progressDelayService — 진행/지연 관리 실제 데이터
// leads 테이블 읽기 전용 참조
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { resolveStaffDisplayNames } from './staffDisplayService';
import { maskCustomerName } from './reportFormatService';

// 진행/지연 대상 상태
const PROGRESS_STATUSES = [
  '상담성공', '상담중', '택배대기', '택배발송', '개통대기', '개통완료',
];

export interface ProgressDelayItem {
  id: string;
  customer_name_masked: string;
  assigned_name: string;
  status: string;
  channel: string;
  consult_date: string | null;   // created_at 또는 상담성공 추정일
  delivery_date: string | null;
  expected_opening: string | null;
  actual_opening: string | null;
  delay_days: number;
  delay_level: 'normal' | 'warning' | 'danger';
  memo: string | null;
}

export interface ProgressDelaySummary {
  consult_waiting_delivery: number;  // 상담성공 후 택배대기
  delivery_waiting_opening: number;  // 택배발송 후 개통대기
  opening_waiting_settlement: number;// 개통완료 후 정산대기
  overdue_opening: number;           // 예상개통일 초과
  need_confirm: number;              // 철회확인 필요
}

function calcDelayDays(fromDate: string | null): number {
  if (!fromDate) return 0;
  const from = new Date(fromDate);
  const now = new Date();
  return Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function getDelayLevel(status: string, days: number): 'normal' | 'warning' | 'danger' {
  if (status === '상담성공' || status === '상담중') {
    if (days >= 3) return 'danger';
    if (days >= 2) return 'warning';
  }
  if (status === '택배발송') {
    if (days >= 4) return 'danger';
    if (days >= 2) return 'warning';
  }
  if (status === '개통완료') {
    if (days >= 3) return 'danger';
    if (days >= 2) return 'warning';
  }
  return 'normal';
}

export async function getProgressDelayData({
  userId,
  isAdmin,
  channel,
  filterStaffId,
}: {
  userId: string;
  isAdmin: boolean;
  channel?: string;
  filterStaffId?: string;
}): Promise<{ items: ProgressDelayItem[]; summary: ProgressDelaySummary }> {

  let query = supabase
    .from('leads')
    .select('id, customer_name, assigned_to, status, channel, campaign_name, created_at, updated_at, memo, activation_status')
    .in('status', PROGRESS_STATUSES)
    .is('deleted_at', null)
    .order('updated_at', { ascending: true });

  // 채널 필터
  if (channel && channel !== '전체') {
    if (channel === 'dogmaru') {
      query = query.eq('campaign_name', '도그마루_홈캠');
    } else if (channel === 'udak') {
      query = query.eq('channel', '유닥');
    }
  }

  // 직원 필터
  if (!isAdmin && userId) {
    query = query.eq('assigned_to', userId);
  }
  if (isAdmin && filterStaffId) {
    query = query.eq('assigned_to', filterStaffId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const leads = data ?? [];

  // 담당자 표시명 조회
  const staffIds = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))] as string[];
  const nameMap = staffIds.length > 0 ? await resolveStaffDisplayNames(staffIds) : new Map();

  const items: ProgressDelayItem[] = leads.map((lead) => {
    const days = calcDelayDays(lead.updated_at);
    const assignedName = lead.assigned_to
      ? (nameMap.get(lead.assigned_to) ?? lead.assigned_to)
      : '미배정';

    const ch = lead.campaign_name === '도그마루_홈캠' ? 'dogmaru'
      : lead.channel === '유닥' ? 'udak'
      : 'meta';

    return {
      id: lead.id,
      customer_name_masked: maskCustomerName(lead.customer_name ?? lead.id.slice(0, 4)),
      assigned_name: assignedName,
      status: lead.status,
      channel: ch,
      consult_date: lead.updated_at?.split('T')[0] ?? null,
      delivery_date: null,
      expected_opening: null,
      actual_opening: null,
      delay_days: days,
      delay_level: getDelayLevel(lead.status, days),
      memo: lead.memo,
    };
  });

  const summary: ProgressDelaySummary = {
    consult_waiting_delivery:   items.filter((i) => ['상담성공','상담중'].includes(i.status)).length,
    delivery_waiting_opening:   items.filter((i) => i.status === '택배발송').length,
    opening_waiting_settlement: items.filter((i) => i.status === '개통완료').length,
    overdue_opening:            items.filter((i) => i.delay_level === 'danger').length,
    need_confirm:               items.filter((i) => i.status === '택배대기').length,
  };

  return { items, summary };
}
