// ============================================================
// 사전예약 — 응답시간 분석 서비스
// ============================================================
import { supabase } from '@/integrations/supabase/client';

export interface StatusLog {
  id: string;
  reservation_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  changed_at: string;
  response_minutes: number | null;
}

export interface ResponseTimeStat {
  staff_id: string;
  display_name: string;
  avg_minutes: number;
  min_minutes: number;
  max_minutes: number;
  total_count: number;
  over_1h_count: number;
  workaholic_count: number; // 일요일 대응
  after_hours_count: number; // 근무시간 외
}

// 근무시간 체크 (월~토 09:30~20:00)
export function isWorkingHour(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=일, 1=월 ... 6=토
  if (day === 0) return false; // 일요일
  const h = d.getHours();
  const m = d.getMinutes();
  const totalMin = h * 60 + m;
  return totalMin >= 9 * 60 + 30 && totalMin <= 20 * 60;
}

export function isSunday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 0;
}

export function getDayLabel(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}

export function getHour(dateStr: string): number {
  return new Date(dateStr).getHours();
}

// 상태 변경 로그 저장
export async function saveStatusLog({
  reservationId,
  fromStatus,
  toStatus,
  changedBy,
  contactDate,
}: {
  reservationId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  contactDate: string | null;
}): Promise<void> {
  const now = new Date().toISOString();

  // 첫 대응 여부 (신규 → 다른 상태로 첫 변경)
  let responseMinutes: number | null = null;
  if (fromStatus === '신규' && contactDate) {
    const inboundTime = new Date(contactDate).getTime();
    const responseTime = new Date(now).getTime();
    responseMinutes = Math.round((responseTime - inboundTime) / 60000);
  }

  await supabase.from('reservation_status_logs').insert({
    reservation_id: reservationId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy,
    changed_at: now,
    response_minutes: responseMinutes,
  });
}

// 기간 필터 적용
function applyDateFilter(logs: any[], dateStart?: string, dateEnd?: string) {
  if (!dateStart && !dateEnd) return logs;
  return logs.filter(l => {
    const d = new Date(l.changed_at);
    if (dateStart && d < new Date(dateStart)) return false;
    if (dateEnd && d > new Date(dateEnd + 'T23:59:59')) return false;
    return true;
  });
}

// 응답시간 통계 조회
export async function fetchResponseTimeStats(dateStart?: string, dateEnd?: string): Promise<{
  logs: any[];
  byStaff: ResponseTimeStat[];
  hourlyDist: { hour: number; count: number; avgMin: number }[];
  weekdayDist: { day: string; dayNum: number; count: number; avgMin: number }[];
  dailyTrend: { date: string; count: number; avgMin: number; over1h: number }[];
  summary: {
    teamAvgMin: number;
    over1hCount: number;
    workaholicCount: number;
    totalCount: number;
  };
}> {
  // 로그 + 프로필 + 예약 join
  const { data: rawLogs, error } = await supabase
    .from('reservation_status_logs')
    .select(`
      *,
      profile:profiles!changed_by(user_id, display_name),
      reservation:reservations!reservation_id(contact_date, name)
    `)
    .not('response_minutes', 'is', null)
    .order('changed_at', { ascending: false });

  if (error) throw error;

  const logs = applyDateFilter(rawLogs ?? [], dateStart, dateEnd);

  // 담당자별 집계
  const staffMap: Record<string, any[]> = {};
  logs.forEach((l: any) => {
    const sid = l.changed_by ?? 'unknown';
    if (!staffMap[sid]) staffMap[sid] = [];
    staffMap[sid].push(l);
  });

  const byStaff: ResponseTimeStat[] = Object.entries(staffMap).map(([sid, items]) => {
    const mins = items.map((i: any) => i.response_minutes).filter((m: number) => m >= 0);
    const name = (items[0] as any)?.profile?.display_name ?? '알 수 없음';
    return {
      staff_id: sid,
      display_name: name,
      avg_minutes: mins.length ? Math.round(mins.reduce((a: number, b: number) => a + b, 0) / mins.length) : 0,
      min_minutes: mins.length ? Math.min(...mins) : 0,
      max_minutes: mins.length ? Math.max(...mins) : 0,
      total_count: mins.length,
      over_1h_count: mins.filter((m: number) => m > 60).length,
      workaholic_count: items.filter((i: any) => isSunday(i.changed_at)).length,
      after_hours_count: items.filter((i: any) => !isWorkingHour(i.changed_at) && !isSunday(i.changed_at)).length,
    };
  }).sort((a, b) => a.avg_minutes - b.avg_minutes);

  // 시간대별 분포 (9~20시)
  const hourMap: Record<number, number[]> = {};
  for (let h = 0; h <= 23; h++) hourMap[h] = [];
  logs.forEach((l: any) => {
    const h = getHour(l.changed_at);
    hourMap[h].push(l.response_minutes);
  });
  const hourlyDist = Object.entries(hourMap).map(([h, mins]) => ({
    hour: Number(h),
    count: mins.length,
    avgMin: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
  })).filter(h => h.count > 0);

  // 요일별 분포
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const dayMap: Record<number, number[]> = {};
  for (let d = 0; d <= 6; d++) dayMap[d] = [];
  logs.forEach((l: any) => {
    const d = new Date(l.changed_at).getDay();
    dayMap[d].push(l.response_minutes);
  });
  const weekdayDist = Object.entries(dayMap).map(([d, mins]) => ({
    dayNum: Number(d),
    day: dayLabels[Number(d)],
    count: mins.length,
    avgMin: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
  }));

  // 일별 추이
  const dateMap: Record<string, number[]> = {};
  logs.forEach((l: any) => {
    const dateStr = new Date(l.changed_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
    if (!dateMap[dateStr]) dateMap[dateStr] = [];
    dateMap[dateStr].push(l.response_minutes);
  });
  const dailyTrend = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, mins]) => ({
      date,
      count: mins.length,
      avgMin: Math.round(mins.reduce((a, b) => a + b, 0) / mins.length),
      over1h: mins.filter(m => m > 60).length,
    }));

  // 전체 요약
  const allMins = logs.map((l: any) => l.response_minutes).filter((m: number) => m >= 0);
  return {
    logs,
    byStaff,
    hourlyDist,
    weekdayDist,
    dailyTrend,
    summary: {
      teamAvgMin: allMins.length ? Math.round(allMins.reduce((a: number, b: number) => a + b, 0) / allMins.length) : 0,
      over1hCount: allMins.filter((m: number) => m > 60).length,
      workaholicCount: logs.filter((l: any) => isSunday(l.changed_at)).length,
      totalCount: allMins.length,
    },
  };
}
