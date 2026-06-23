// ============================================================
// absentRepeatService — 반복 부재케어 감지 (2번 이상)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import { getKstDateRangeUtc } from './dateUtils';

export interface AbsentRepeatCase {
  lead_id: string;
  customer_name: string | null;
  staff_id: string;
  staff_name: string;
  channel: string | null;
  absent_count: number;       // 해당 기간 내 부재 횟수
  last_absent_at: string;     // 마지막 부재 시간
}

/**
 * 지정 기간 내 같은 lead_id로 absent가 2번 이상 찍힌 케이스 반환
 */
export async function getAbsentRepeatCases(
  dateFrom: string,
  dateTo: string,
  staffId?: string
): Promise<AbsentRepeatCase[]> {
  const { start, end } = getKstDateRangeUtc(dateFrom, dateTo);

  let query = supabase
    .from('activity_logs')
    .select('lead_id, staff_id, staff_name, channel, created_at, leads!left(customer_name)')
    .eq('action_type', 'absent')
    .eq('is_counted', true)
    .gte('created_at', start)
    .lte('created_at', end)
    .not('lead_id', 'is', null);

  if (staffId) query = query.eq('staff_id', staffId);

  const { data, error } = await query;
  if (error) throw error;

  // lead_id 기준으로 그룹핑
  const map = new Map<string, AbsentRepeatCase>();
  (data ?? []).forEach((row: any) => {
    const lid = row.lead_id;
    if (!lid) return;
    if (!map.has(lid)) {
      map.set(lid, {
        lead_id: lid,
        customer_name: row.leads?.customer_name ?? null,
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        channel: row.channel,
        absent_count: 0,
        last_absent_at: row.created_at,
      });
    }
    const entry = map.get(lid)!;
    entry.absent_count++;
    if (row.created_at > entry.last_absent_at) {
      entry.last_absent_at = row.created_at;
    }
  });

  // 2번 이상인 것만 필터, 횟수 내림차순 정렬
  return Array.from(map.values())
    .filter((c) => c.absent_count >= 2)
    .sort((a, b) => b.absent_count - a.absent_count);
}
