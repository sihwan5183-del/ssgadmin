// ============================================================
// incentiveService — 인센 정책 관리 + 예상 인센 계산
// 관리자: 전체 조회/수정 / 직원: 본인 예상 인센만
// ============================================================
import { supabase } from '@/integrations/supabase/client';

export interface IncentivePolicy {
  id: string;
  apply_month: string;
  product_type: string;
  calc_method: string;
  range_start: number;
  range_end: number | null;
  unit_price: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type IncentivePolicyInsert = Omit<IncentivePolicy, 'id' | 'created_at' | 'updated_at'>;

export interface IncentiveResult {
  staff_id: string;
  staff_name: string;
  display_name: string;
  consult_success: number;
  activation_completed: number;
  settlement_confirmed: number;
  pending_count: number;
  excluded_count: number;
  applied_tier: string;
  applied_unit_price: number;
  estimated_amount: number;
}

// ── 정책 조회 ─────────────────────────────────────────────
export async function fetchIncentivePolicies(month: string): Promise<IncentivePolicy[]> {
  const { data, error } = await supabase
    .from('incentive_policies')
    .select('*')
    .eq('apply_month', month)
    .eq('is_active', true)
    .order('range_start');
  if (error) throw error;
  return (data ?? []) as IncentivePolicy[];
}

export async function fetchAllMonthPolicies(): Promise<IncentivePolicy[]> {
  const { data, error } = await supabase
    .from('incentive_policies')
    .select('*')
    .order('apply_month', { ascending: false })
    .order('range_start');
  if (error) throw error;
  return (data ?? []) as IncentivePolicy[];
}

// ── 정책 저장 ─────────────────────────────────────────────
export async function upsertIncentivePolicy(
  policy: Partial<IncentivePolicy> & { apply_month: string; created_by: string }
): Promise<void> {
  if (policy.id) {
    const { error } = await supabase
      .from('incentive_policies')
      .update({
        range_start: policy.range_start,
        range_end: policy.range_end,
        unit_price: policy.unit_price,
        product_type: policy.product_type,
        calc_method: policy.calc_method,
        is_active: policy.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', policy.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('incentive_policies')
      .insert({
        apply_month: policy.apply_month,
        product_type: policy.product_type ?? '전체',
        calc_method: policy.calc_method ?? '최종구간일괄',
        range_start: policy.range_start ?? 1,
        range_end: policy.range_end ?? null,
        unit_price: policy.unit_price ?? 0,
        is_active: policy.is_active ?? true,
        created_by: policy.created_by,
      });
    if (error) throw error;
  }
}

export async function deleteIncentivePolicy(id: string): Promise<void> {
  const { error } = await supabase
    .from('incentive_policies')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── 인센 계산 (최종구간일괄) ─────────────────────────────
export function calcIncentive(
  confirmedCount: number,
  policies: IncentivePolicy[]
): { tier: string; unitPrice: number; amount: number } {
  const active = policies.filter((p) => p.is_active).sort((a, b) => a.range_start - b.range_start);
  // 해당 구간 찾기 (최종 구간 일괄 적용)
  let matched = active[0];
  for (const p of active) {
    const end = p.range_end ?? Infinity;
    if (confirmedCount >= p.range_start && confirmedCount <= end) {
      matched = p;
      break;
    }
  }
  if (!matched) return { tier: '미적용', unitPrice: 0, amount: 0 };
  const tier = matched.range_end
    ? `${matched.range_start}~${matched.range_end}건`
    : `${matched.range_start}건 이상`;
  return {
    tier,
    unitPrice: matched.unit_price,
    amount: confirmedCount * matched.unit_price,
  };
}

// ── 직원별 인센 예상 계산 ────────────────────────────────
export async function getIncentiveResults(
  month: string,
  userId: string,
  isAdmin: boolean
): Promise<IncentiveResult[]> {
  const [policies, logsResult] = await Promise.all([
    fetchIncentivePolicies(month),
    (() => {
      const from = `${month}-01T00:00:00`;
      // 월말 계산
      const [y, m] = month.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${month}-${String(lastDay).padStart(2, '0')}T23:59:59`;
      let q = supabase
        .from('activity_logs')
        .select('staff_id, staff_name, action_type, is_counted')
        .gte('created_at', from)
        .lte('created_at', to)
        .eq('is_counted', true);
      if (!isAdmin) q = q.eq('staff_id', userId);
      return q;
    })(),
  ]);

  const { data: logs } = logsResult;
  const allLogs = logs ?? [];

  // 직원별 집계
  const staffMap = new Map<string, { name: string; consult: number; activation: number; settlement: number }>();
  allLogs.forEach((l: any) => {
    if (!staffMap.has(l.staff_id)) {
      staffMap.set(l.staff_id, { name: l.staff_name, consult: 0, activation: 0, settlement: 0 });
    }
    const s = staffMap.get(l.staff_id)!;
    if (l.action_type === 'consultation_success') s.consult++;
    if (l.action_type === 'activation_completed') s.activation++;
    if (l.action_type === 'settlement_confirmed') s.settlement++;
  });

  // 인센 계산
  const results: IncentiveResult[] = [];
  for (const [staffId, data] of staffMap.entries()) {
    const { tier, unitPrice, amount } = calcIncentive(data.settlement, policies);
    results.push({
      staff_id: staffId,
      staff_name: data.name,
      display_name: data.name,
      consult_success: data.consult,
      activation_completed: data.activation,
      settlement_confirmed: data.settlement,
      pending_count: data.activation - data.settlement,
      excluded_count: 0,
      applied_tier: tier,
      applied_unit_price: unitPrice,
      estimated_amount: amount,
    });
  }

  return results.sort((a, b) => b.estimated_amount - a.estimated_amount);
}
