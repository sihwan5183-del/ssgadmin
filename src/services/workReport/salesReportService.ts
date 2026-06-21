// ============================================================
// salesReportService — sales 테이블 읽기 전용 참조
// SalesLedgerPage 미수정 / activity_logs 미사용
// 실적/인센 계산 전용
// ============================================================
import { supabase } from '@/integrations/supabase/client';

export interface SalesPerformanceItem {
  id: string;
  seq: number | null;
  open_date: string | null;
  open_month: string | null;
  channel: string | null;
  manager: string | null;
  customer_name: string | null;
  product: string | null;
  sale_type: string | null;
  device_model: string | null;
  rate_plan: string | null;
  status: string | null;
  approval_status: string;
  moyo_excluded: boolean | null;
  unit_price: number | null;
  created_at: string;
}

export interface SalesChannelSummary {
  channel: string;
  total: number;
  completed: number;   // 개통완료/설치완료
  cancelled: number;   // 취소/반려
}

export interface StaffSalesSummary {
  manager: string;
  mobile_completed: number;
  mobile_cancelled: number;
  internet_installed: number;
  moyo_count: number;
}

// 완료 상태 판단
function isCompleted(status: string | null): boolean {
  if (!status) return false;
  return status.includes('개통완료') || status.includes('설치완료') || status.includes('변경완료');
}

// 취소 상태 판단
function isCancelled(status: string | null): boolean {
  if (!status) return false;
  return status.includes('취소') || status.includes('반려');
}

// 모바일/인터넷 구분
function isMobile(product: string | null): boolean {
  if (!product) return true; // 기본값 모바일
  return !product.includes('인터넷') && !product.includes('TV') && !product.includes('홈');
}

// 월 시작/종료 날짜 계산 (판매실적장표와 동일 기준)
function getMonthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

// ── 월별 실적 조회 (open_date 기준 — 판매실적장표와 동일) ──
export async function getSalesPerformanceByMonth(
  month: string, // 'YYYY-MM'
  manager?: string
): Promise<SalesPerformanceItem[]> {
  const { start, end } = getMonthRange(month);
  let q = supabase
    .from('sales')
    .select('id, seq, open_date, open_month, channel, manager, customer_name, product, sale_type, device_model, rate_plan, status, approval_status, moyo_excluded, unit_price, created_at')
    .or(`and(open_date.gte.${start},open_date.lte.${end}),and(open_date.is.null,created_at.gte.${start}T00:00:00,created_at.lte.${end}T23:59:59)`)
    .is('deleted_at', null)
    .order('open_date', { ascending: false });

  if (manager) q = q.eq('manager', manager);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SalesPerformanceItem[];
}

// ── 모바일 정산확정 건수 ────────────────────────────────────
export async function getMobileCompletedCount(
  month: string,
  manager?: string
): Promise<number> {
  const { start, end } = getMonthRange(month);
  let q = supabase
    .from('sales')
    .select('id, product, status')
    .or(`and(open_date.gte.${start},open_date.lte.${end}),and(open_date.is.null,created_at.gte.${start}T00:00:00,created_at.lte.${end}T23:59:59)`)
    .is('deleted_at', null)
    .or('status.ilike.%개통완료%,status.ilike.%변경완료%');

  if (manager) q = q.eq('manager', manager);

  const { data } = await q;
  const mobileOnly = (data ?? []).filter((r: any) => isMobile(r.product));
  return mobileOnly.length;
}

// ── 인터넷 설치 건수 ────────────────────────────────────────
export async function getInternetInstalledCount(
  month: string,
  manager?: string
): Promise<number> {
  const { start, end } = getMonthRange(month);
  let q = supabase
    .from('sales')
    .select('id, product, status')
    .or(`and(open_date.gte.${start},open_date.lte.${end}),and(open_date.is.null,created_at.gte.${start}T00:00:00,created_at.lte.${end}T23:59:59)`)
    .is('deleted_at', null)
    .or('status.ilike.%설치완료%,status.ilike.%개통완료%');

  if (manager) q = q.eq('manager', manager);

  const { data } = await q;
  const internetOnly = (data ?? []).filter((r: any) => !isMobile(r.product));
  return internetOnly.length;
}

// ── 인센 계산 (정책 기준) ───────────────────────────────────
export function calcIncentiveFromSales(
  mobileConfirmed: number,
  internetInstalled: number
): {
  baseIncentive: number;
  payoutRate: number;
  finalIncentive: number;
  mobileConditionMet: boolean;
} {
  // 모바일: 50건 이상 시 건당 20,000원
  const mobileConditionMet = mobileConfirmed >= 50;
  const baseIncentive = mobileConditionMet ? mobileConfirmed * 20000 : 0;

  // 인터넷: 설치 건수에 따른 지급률
  const payoutRate =
    internetInstalled === 0 ? 0 :
    internetInstalled === 1 ? 0.5 : 1;

  const finalIncentive = Math.floor(baseIncentive * payoutRate);

  return { baseIncentive, payoutRate, finalIncentive, mobileConditionMet };
}

// ── 직원별 실적 요약 ────────────────────────────────────────
export async function getSalesDetailsByStaff(
  month: string
): Promise<StaffSalesSummary[]> {
  const { start, end } = getMonthRange(month);
  const { data, error } = await supabase
    .from('sales')
    .select('manager, product, status, moyo_excluded, channel')
    .or(`and(open_date.gte.${start},open_date.lte.${end}),and(open_date.is.null,created_at.gte.${start}T00:00:00,created_at.lte.${end}T23:59:59)`)
    .is('deleted_at', null)
    .neq('status', '취소');

  if (error) throw error;

  const staffMap = new Map<string, StaffSalesSummary>();

  (data ?? []).forEach((r: any) => {
    const mgr = r.manager ?? '미지정';
    if (!staffMap.has(mgr)) {
      staffMap.set(mgr, { manager: mgr, mobile_completed: 0, mobile_cancelled: 0, internet_installed: 0, moyo_count: 0 });
    }
    const s = staffMap.get(mgr)!;
    if (isMobile(r.product) && isCompleted(r.status)) s.mobile_completed++;
    if (isMobile(r.product) && isCancelled(r.status)) s.mobile_cancelled++;
    if (!isMobile(r.product) && isCompleted(r.status)) s.internet_installed++;
    if (r.channel === '모요' && !r.moyo_excluded) s.moyo_count++;
  });

  return Array.from(staffMap.values()).sort((a, b) => b.mobile_completed - a.mobile_completed);
}

// ── 채널별 요약 ─────────────────────────────────────────────
export async function getSalesChannelSummary(month: string): Promise<SalesChannelSummary[]> {
  const { start, end } = getMonthRange(month);
  const { data, error } = await supabase
    .from('sales')
    .select('channel, status')
    .or(`and(open_date.gte.${start},open_date.lte.${end}),and(open_date.is.null,created_at.gte.${start}T00:00:00,created_at.lte.${end}T23:59:59)`)
    .is('deleted_at', null);

  if (error) throw error;

  const channelMap = new Map<string, SalesChannelSummary>();
  (data ?? []).forEach((r: any) => {
    const ch = r.channel ?? '기타';
    if (!channelMap.has(ch)) channelMap.set(ch, { channel: ch, total: 0, completed: 0, cancelled: 0 });
    const s = channelMap.get(ch)!;
    s.total++;
    if (isCompleted(r.status)) s.completed++;
    if (isCancelled(r.status)) s.cancelled++;
  });

  return Array.from(channelMap.values()).sort((a, b) => b.total - a.total);
}
