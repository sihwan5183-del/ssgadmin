// ============================================================
// salesReportService — sales 테이블 읽기 전용 참조
// 랭킹 페이지와 동일한 기준 (open_date 기준)
// SalesLedgerPage 미수정
// ============================================================
import { supabase } from '@/integrations/supabase/client';

// ── 랭킹 페이지와 동일한 상품 분류 함수 ─────────────────────
export function productBucket(
  p: string | null
): '모바일' | '인터넷' | 'TV프리' | '스마트홈' | '기타' {
  if (!p) return '기타';
  if (/tv\s*프리|프리tv|tv프리/i.test(p) || p.includes('TV프리')) return 'TV프리';
  if (/스마트홈|smart\s*home|홈\s*iot|^iot$|홈안심|허브|구글홈|애플홈/i.test(p)) return '스마트홈';
  if (/인터넷|기가|wifi/i.test(p)) return '인터넷';
  if (/모바일|mobile|usim|mnp|재약정|업셀/i.test(p)) return '모바일';
  return '기타';
}

// UUID인지 판단
function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s);
}

// 완료 상태 판단 (랭킹과 동일: 개통완료/설치완료/변경완료/택배발송/청약완료)
const COMPLETED_STATUSES = ['개통완료','설치완료','변경완료(업셀용)','택배발송','청약완료'];
function isCompleted(status: string | null): boolean {
  if (!status) return false;
  return COMPLETED_STATUSES.some((s) => status.includes(s));
}

// 취소 상태 판단
function isCancelled(status: string | null): boolean {
  if (!status) return false;
  return status.includes('취소') || status.includes('반려');
}

// 월 범위 계산 (랭킹 페이지와 동일)
export function getMonthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export interface SalesSummaryItem {
  id: string;
  manager: string | null;
  product: string | null;
  status: string | null;
  channel: string | null;
  moyo_excluded: boolean | null;
  open_date: string | null;
  created_at: string;
  // 분류
  bucket: '모바일' | '인터넷' | 'TV프리' | '스마트홈' | '기타';
  isCompleted: boolean;
  isCancelled: boolean;
}

export interface StaffIncentiveSummary {
  manager: string;
  total: number;            // 전체 판매건 (랭킹 기준)
  mobile: number;           // 모바일 완료건
  internet: number;         // 인터넷 설치완료건
  tvfree: number;           // TV프리 건수
  smarthome: number;        // 스마트홈 건수
  moyo_count: number;       // 모요 건수
  other: number;            // 기타
  // 인센 계산
  mobile_condition_met: boolean;  // 50건 이상 여부
  base_incentive: number;         // 기본 인센 (모바일 × 20,000)
  payout_rate: number;            // 인터넷 지급률
  final_incentive: number;        // 최종 예상 인센
}

// ── 월별 전체 sales 조회 (랭킹과 동일한 open_date 기준) ────
export async function getSalesByMonth(month: string): Promise<SalesSummaryItem[]> {
  const { start, end } = getMonthRange(month);
  const { data, error } = await supabase
    .from('sales')
    .select('id, manager, product, status, channel, moyo_excluded, open_date, created_at')
    .gte('open_date', start)
    .lte('open_date', end)
    .is('deleted_at', null)
    .order('open_date', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    ...r,
    bucket: productBucket(r.product),
    isCompleted: isCompleted(r.status),
    isCancelled: isCancelled(r.status),
  }));
}

// ── 인센 계산 함수 ────────────────────────────────────────────
export function calcIncentiveFromSales(
  mobileCompleted: number,
  internetCompleted: number
): {
  mobile_condition_met: boolean;
  base_incentive: number;
  payout_rate: number;
  final_incentive: number;
} {
  const mobile_condition_met = mobileCompleted >= 50;
  const base_incentive = mobile_condition_met ? mobileCompleted * 20000 : 0;
  const payout_rate =
    internetCompleted === 0 ? 0 :
    internetCompleted === 1 ? 0.5 : 1;
  const final_incentive = Math.floor(base_incentive * payout_rate);
  return { mobile_condition_met, base_incentive, payout_rate, final_incentive };
}

// ── 직원별 인센 집계 ─────────────────────────────────────────
export async function getStaffIncentiveSummary(
  month: string,
  filterManager?: string
): Promise<StaffIncentiveSummary[]> {
  const allSales = await getSalesByMonth(month);

  // 취소 제외
  const valid = allSales.filter((s) => !s.isCancelled);

  // 담당자별 그룹핑
  const map = new Map<string, {
    total: number; mobile: number; internet: number;
    tvfree: number; smarthome: number; other: number; moyo_count: number;
  }>();

  valid.forEach((s) => {
    const mgr = s.manager ?? '미지정';
    if (!map.has(mgr)) {
      map.set(mgr, { total: 0, mobile: 0, internet: 0, tvfree: 0, smarthome: 0, other: 0, moyo_count: 0 });
    }
    const m = map.get(mgr)!;
    m.total++;
    if (s.bucket === '모바일' && s.isCompleted) m.mobile++;
    if (s.bucket === '인터넷' && s.isCompleted) m.internet++;
    if (s.bucket === 'TV프리') m.tvfree++;
    if (s.bucket === '스마트홈') m.smarthome++;
    if (s.bucket === '기타') m.other++;
    if (s.channel === '모요' && !s.moyo_excluded) m.moyo_count++;
  });

  // UUID manager → display_name 변환
  const uuidManagers = [...map.keys()].filter(isUUID);
  const nameMap = new Map<string, string>();
  if (uuidManagers.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', uuidManagers);
    (profiles ?? []).forEach((p: any) => nameMap.set(p.user_id, p.display_name));
  }

  // UUID → 이름 변환 후 동일 이름 합산
  const mergedMap = new Map<string, typeof map extends Map<string, infer V> ? V : never>();
  for (const [rawManager, counts] of map.entries()) {
    const manager = nameMap.get(rawManager) ?? rawManager;
    if (mergedMap.has(manager)) {
      const existing = mergedMap.get(manager)!;
      mergedMap.set(manager, {
        total: existing.total + counts.total,
        mobile: existing.mobile + counts.mobile,
        internet: existing.internet + counts.internet,
        tvfree: existing.tvfree + counts.tvfree,
        smarthome: existing.smarthome + counts.smarthome,
        other: existing.other + counts.other,
        moyo_count: existing.moyo_count + counts.moyo_count,
      });
    } else {
      mergedMap.set(manager, { ...counts });
    }
  }

  let results: StaffIncentiveSummary[] = [];
  for (const [manager, counts] of mergedMap.entries()) {
    if (filterManager && manager !== filterManager) continue;
    const { mobile_condition_met, base_incentive, payout_rate, final_incentive } =
      calcIncentiveFromSales(counts.mobile, counts.internet);
    results.push({
      manager,
      ...counts,
      mobile_condition_met,
      base_incentive,
      payout_rate,
      final_incentive,
    });
  }

  return results.sort((a, b) => b.total - a.total);
}

// ── 채널별 실적 요약 ─────────────────────────────────────────
export async function getSalesChannelSummary(
  month: string
): Promise<{ channel: string; total: number; completed: number }[]> {
  const allSales = await getSalesByMonth(month);
  const map = new Map<string, { total: number; completed: number }>();
  allSales.forEach((s) => {
    const ch = s.channel ?? '기타';
    if (!map.has(ch)) map.set(ch, { total: 0, completed: 0 });
    const m = map.get(ch)!;
    m.total++;
    if (s.isCompleted) m.completed++;
  });
  return Array.from(map.entries())
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.total - a.total);
}
