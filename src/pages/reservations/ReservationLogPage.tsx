// ============================================================
// 사전예약 실시간 로그 — 기간별 접수/신규처리량 + 담당자별 현황
// ============================================================
// v20260803-1: 최초 작성
// v20260803-2: 처리량 집계 방식 교체 — "신규 → 다른 상태" 전이만 정확히 카운트.
//   기존엔 reservations.updated_at(마지막으로 아무 값이나 바뀐 시각)을 썼는데,
//   확정 스펙시트에서 주소·요금제 등 아무 필드나 인라인 수정만 해도 그 시각이
//   "처리"로 잡혀서 숫자가 부풀려졌음 (예: 택배발송 25건처럼 튀는 값).
//   이제는 ReservationDetailModal에서 실제로 상태를 바꿀 때만 쌓이는
//   reservation_status_logs 테이블(from_status='신규' 인 건만)을 사용해서
//   "신규 건이 언제 몇 건씩 빠지고 있는지" = 처리 페이스를 정확히 보여줌.
//   + "신규 잔량"(아직 손 안 댄 전체 건수) KPI 추가.
// v20260803-3: 담당자별 현황에 "몇 건 처리(해결)했는지" + "시간당 처리 페이스" 추가.
//   reservation_status_logs.changed_by(실제로 상태를 바꾼 사람)를 기준으로 집계.
// v20260803-4: 페이스(시간당) 계산의 경과시간 기준을 00시가 아니라
//   영업 시작 시각(BUSINESS_START_HOUR, 기본 11시)부터로 변경.
// v20260803-5: 단일 날짜 선택 → 기간(시작일~종료일) 선택으로 확장.
//   예: 8/2~8/3 인입건을 함께 봐야 할 때. 시간대별 표는 날짜와 무관하게
//   "시(0~23시)" 단위로 합산되고, 페이스 계산은 기간에 포함된 각 날짜별로
//   영업시간 경과분을 더해서 계산합니다 (지난 날은 하루 풀로 영업한 것으로 간주).
// v20260803-6: 팀 전체 "시간당 처리 페이스" KPI 추가 + 신규 잔량 카드에
//   "이 페이스면 약 N시간 소요" 추정치 표시.
// v20260803-7: 시간대별 표의 상태 컬럼을 "그 기간에 값이 있는 상태만" 동적으로
//   보여주던 걸 없앰 — 예: 신규→확정 건이 0이면 컬럼 자체가 통째로 사라져서
//   빠진 것처럼 보이는 문제가 있었음. 이제 확정/택배발송/예약완료/가망/상담성공/
//   재케어/부재/실패/취소 9개 상태 컬럼을 항상 전부 표시(0이어도 0으로 노출).
// v20260907-1: 영업시간 상수 수정 — 실제 영업시간은 09:30~20:00인데 시작만 11시로
//   하드코딩돼 있고 종료 시각 개념이 아예 없었음(지난 날짜를 24시까지 풀영업으로 계산해서
//   페이스가 실제보다 낮게 나옴). 또한 일요일(고정휴무)이 조회 기간에 끼어도 영업일로 계산돼
//   페이스를 더 낮추는 문제가 있었음 — 이제 09:30~20:00, 일요일 0시간으로 정확히 계산.
// v20260907-2: 담당자별 현황에 성공률/가망률 추가.
//   성공률 = (확정+택배발송)/분모, 가망률 = (예약완료+가망)/분모.
//   분모는 "전체(부재포함) / 부재제외" 두 버전을 한 셀에 함께 표시.
//     - 전체: 신규처리합계(그 담당자의 처리건수) 그대로
//     - 부재제외: 신규처리합계 - 부재  (취소·유심MNP는 "진짜 상담이 아니다"로 콕 집어
//       확인된 게 아니라서 두 버전 모두 분모에 포함 — V2_EXCLUDED_STATUSES에 추가하면 바로 뺄 수 있음)
//   + 표 맨 위에 "전체(팀 합계)" 행 추가.
// ============================================================
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { RotateCw, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { WorkReportHeader, SectionCard, KpiCard } from '@/pages/work-report/_shared';
import { RESERVATION_STATUS_LIST } from '@/types/reservation';
import {
  fetchIntakeRowsForRange,
  fetchNewOriginTransitionsForRange,
  fetchAllTransitionsForRange,
  fetchAllAssigneeRows,
  fetchNewBacklogCount,
  fetchAllReservationCreations,
  fetchAllTransitionsEver,
  type IntakeLogRow,
  type NewOriginTransition,
  type StatusTransition,
  type ReservationCreationRow,
} from '@/services/reservationService';
import { useReservationCategory } from '@/hooks/useReservationCategory';
import { ReservationCategoryToggle } from './ReservationCategoryToggle';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// dateStart~dateEnd 사이 날짜(YYYY-MM-DD)를 하루씩 나열
function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(endD.getTime()) || cur > endD) return out;
  while (cur <= endD) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 일요일(고정휴무) 여부
function isSunday(dateStr: string): boolean {
  return new Date(`${dateStr}T00:00:00`).getDay() === 0;
}

// 스냅샷 추이용 10분 버킷 — 영업시간(09:30~20:00) 내에서만 생성.
// 오늘 날짜면 현재 시각을 넘는 미래 버킷은 만들지 않는다(아직 안 지난 시간이라 의미 없음).
const SNAPSHOT_BUCKET_MINUTES = 10;
function generateSnapshotBuckets(dateStr: string): Date[] {
  const start = new Date(`${dateStr}T09:30:00`);
  const end = new Date(`${dateStr}T20:00:00`);
  const now = new Date();
  const isToday = dateStr === todayStr();
  const buckets: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += SNAPSHOT_BUCKET_MINUTES * 60 * 1000) {
    if (isToday && t > now.getTime()) break;
    buckets.push(new Date(t));
  }
  return buckets;
}

// 처리량 표에서 항상 보여줄 상태 목록 (신규 접수는 왼쪽 "접수" 열에서 이미 보여주므로 제외).
// 건수가 0이어도 컬럼은 항상 노출 — 특정 상태(예: 확정)로 아직 아무도 안 넘어갔다는 것도
// 중요한 정보라서, 0이라고 컬럼째 숨기면 "빠진 것처럼" 보여서 혼동을 줌.
const TRACKED_STATUSES = RESERVATION_STATUS_LIST.filter((s) => s.value !== '신규');

const MEDALS = ['🥇', '🥈', '🥉'];

// 성공률/가망률 "부재제외" 버전 계산 시 분모에서 뺄 상태들. 부재만 명시적으로
// "진짜 상담이 아니다"로 확인됐고, 취소·유심MNP는 두 버전 모두 분모에 그대로 포함.
const V2_EXCLUDED_STATUSES: string[] = ['부재'];

// count/denom을 "72.3%" 형태 문자열로. denom이 0이면 집계할 처리 건수 자체가 없다는 뜻이라 "—".
function formatRate(count: number, denom: number): string {
  if (denom <= 0) return '—';
  return `${Math.round((count / denom) * 1000) / 10}%`;
}

// 상태별 카운트(statusCounts)와 신규처리합계(denomAll)로 성공률/가망률을
// "전체 / 부재제외" 두 버전을 합친 문자열로 계산.
function computeRates(statusCounts: Record<string, number>, denomAll: number) {
  const successCount = (statusCounts['확정'] ?? 0) + (statusCounts['택배발송'] ?? 0);
  const prospectCount = (statusCounts['예약완료'] ?? 0) + (statusCounts['가망'] ?? 0);
  const excluded = V2_EXCLUDED_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0);
  const denomExAbsent = denomAll - excluded;
  return {
    successLabel: `${formatRate(successCount, denomAll)} / ${formatRate(successCount, denomExAbsent)}`,
    prospectLabel: `${formatRate(prospectCount, denomAll)} / ${formatRate(prospectCount, denomExAbsent)}`,
  };
}

// 시간당 페이스 계산의 기준 — 실제 영업시간(09:30~20:00, 일요일 고정휴무).
// 시작이 30분 단위라 소수(9.5)로 두고, 표의 "시(0~23시)" 행 표시에는 정수 시(9)를 기준으로 씀.
const BUSINESS_START_HOUR = 9.5;
const BUSINESS_END_HOUR = 20;
const BUSINESS_START_HOUR_ROW = Math.floor(BUSINESS_START_HOUR); // 9 — "영업시작" 행 표시 기준
const BUSINESS_HOURS_LABEL = '09:30~20:00';

// 기본 조회 기간 — 필요에 따라 날짜 선택기로 바꿀 수 있음
const DEFAULT_DATE_START = '2026-08-02';

export default function ReservationLogPage() {
  const { staff } = useDashboardStaff();
  const { tables } = useReservationCategory();
  const [dateStart, setDateStart] = useState(DEFAULT_DATE_START);
  const [dateEnd, setDateEnd] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [intakeRows, setIntakeRows] = useState<IntakeLogRow[]>([]);
  const [transitionRows, setTransitionRows] = useState<NewOriginTransition[]>([]);
  const [allTransitionRows, setAllTransitionRows] = useState<StatusTransition[]>([]);
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [assigneeAllCounts, setAssigneeAllCounts] = useState<Record<string, number>>({});
  const [newBacklog, setNewBacklog] = useState(0);

  // ── 상태별 스냅샷 추이 (10분 단위) — 전체 이력이 필요해서 위 dateStart~dateEnd 필터와 별개로 관리 ──
  const [snapshotDate, setSnapshotDate] = useState(todayStr());
  const [creationRows, setCreationRows] = useState<ReservationCreationRow[]>([]);
  const [everTransitions, setEverTransitions] = useState<StatusTransition[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [expandedBucket, setExpandedBucket] = useState<number | null>(null);

  const loadSnapshotHistory = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const [creations, everTx] = await Promise.all([
        fetchAllReservationCreations(tables),
        fetchAllTransitionsEver(tables),
      ]);
      setCreationRows(creations);
      setEverTransitions(everTx);
    } catch (e: any) {
      toast.error('스냅샷 이력 로드 실패: ' + e.message);
    } finally {
      setSnapshotLoading(false);
    }
  }, [tables]);

  useEffect(() => { loadSnapshotHistory(); }, [loadSnapshotHistory]);

  const staffMap = useMemo(() => {
    const m: Record<string, string> = {};
    staff.forEach((s) => { m[s.user_id] = s.display_name; });
    return m;
  }, [staff]);

  const load = useCallback(async () => {
    if (!dateStart || !dateEnd || dateStart > dateEnd) {
      toast.error('시작일이 종료일보다 늦을 수 없습니다');
      return;
    }
    setLoading(true);
    try {
      const [intake, transitions, allTransitions, allAssignees, backlog] = await Promise.all([
        fetchIntakeRowsForRange(dateStart, dateEnd, tables),
        fetchNewOriginTransitionsForRange(dateStart, dateEnd, tables),
        fetchAllTransitionsForRange(dateStart, dateEnd, tables),
        fetchAllAssigneeRows(tables),
        fetchNewBacklogCount(tables),
      ]);
      setIntakeRows(intake);
      setTransitionRows(transitions);
      setAllTransitionRows(allTransitions);
      setNewBacklog(backlog);
      const counts: Record<string, number> = {};
      allAssignees.forEach((r) => {
        const key = r.assigned_to ?? '__unassigned__';
        counts[key] = (counts[key] ?? 0) + 1;
      });
      setAssigneeAllCounts(counts);
    } catch (e: any) {
      toast.error('데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd, tables]);

  useEffect(() => { load(); }, [load]);

  // ── 시간대별 접수량 (날짜 무관, 시 단위로 합산) ──
  const hourlyIntake = useMemo(() => {
    const m: Record<number, number> = {};
    intakeRows.forEach((r) => {
      const h = new Date(r.created_at).getHours();
      m[h] = (m[h] ?? 0) + 1;
    });
    return m;
  }, [intakeRows]);

  // ── 시간대별 "신규 → 상태" 처리량 (행=시, 열=넘어간 상태, 날짜 무관 합산) ──
  const hourlyTransitions = useMemo(() => {
    const m: Record<number, Record<string, number>> = {};
    transitionRows.forEach((r) => {
      const h = new Date(r.changed_at).getHours();
      if (!m[h]) m[h] = {};
      m[h][r.to_status] = (m[h][r.to_status] ?? 0) + 1;
    });
    return m;
  }, [transitionRows]);

  const endIsToday = dateEnd === todayStr();
  const currentHour = endIsToday ? new Date().getHours() : 23;
  // 데이터가 있는 시간대 + (종료일이 오늘이면) 지금까지 경과한 시간대는 항상 노출
  const visibleHours = HOURS.filter((h) => h <= currentHour || hourlyIntake[h] || hourlyTransitions[h]);

  const totalIntake = intakeRows.length;

  // 페이스(시간당) 계산 — 기간에 포함된 "영업일(일요일 제외)"마다 실제 영업시간(09:30~20:00) 내에서
  // 경과한 시간만 더함. 지난 날짜는 하루 풀로 영업(20:00-09:30=10.5시간), 오늘은 지금까지만(20:00 이후면 10.5시간에서 멈춤).
  const elapsedHours = useMemo(() => {
    const today = todayStr();
    const nowDecimal = new Date().getHours() + new Date().getMinutes() / 60;
    return enumerateDates(dateStart, dateEnd).reduce((sum, d) => {
      if (isSunday(d)) return sum; // 일요일 고정휴무 — 영업시간 0
      if (d < today) return sum + (BUSINESS_END_HOUR - BUSINESS_START_HOUR);
      if (d === today) {
        const clamped = Math.min(Math.max(nowDecimal, BUSINESS_START_HOUR), BUSINESS_END_HOUR);
        return sum + Math.max(0, clamped - BUSINESS_START_HOUR);
      }
      return sum; // 미래 날짜는 0
    }, 0);
  }, [dateStart, dateEnd]);

  const avgPerHour = elapsedHours > 0 ? Math.round((totalIntake / elapsedHours) * 10) / 10 : 0;

  const statusTotals = useMemo(() => {
    const t: Record<string, number> = {};
    transitionRows.forEach((r) => { t[r.to_status] = (t[r.to_status] ?? 0) + 1; });
    return t;
  }, [transitionRows]);

  const totalProcessed = transitionRows.length;
  // 팀 전체 시간당 처리 페이스 — "우리가 시간당 대략 몇 건 치고 있는지"
  const processPace = elapsedHours > 0 ? Math.round((totalProcessed / elapsedHours) * 10) / 10 : 0;
  // 지금 페이스로 신규 잔량을 다 처리하는 데 대략 몇 시간 걸릴지 (참고용 추정치)
  const etaHours = processPace > 0 && newBacklog > 0 ? Math.round((newBacklog / processPace) * 10) / 10 : null;

  // ── 담당자별: 기간 접수(배정) + 기간 처리(해결, changed_by 기준) + 시간당 페이스 + 전체 배정 ──
  const assigneeRows = useMemo(() => {
    const intakeCounts: Record<string, number> = {};
    intakeRows.forEach((r) => {
      const key = r.assigned_to ?? '__unassigned__';
      intakeCounts[key] = (intakeCounts[key] ?? 0) + 1;
    });
    const processedCounts: Record<string, number> = {};
    // 담당자별 · 상태별 카운트 (성공률/가망률 계산용) — key -> to_status -> count
    const statusCountsByAssignee: Record<string, Record<string, number>> = {};
    transitionRows.forEach((r) => {
      const key = r.changed_by ?? '__unknown__';
      processedCounts[key] = (processedCounts[key] ?? 0) + 1;
      if (!statusCountsByAssignee[key]) statusCountsByAssignee[key] = {};
      statusCountsByAssignee[key][r.to_status] = (statusCountsByAssignee[key][r.to_status] ?? 0) + 1;
    });
    const keys = new Set([
      ...Object.keys(intakeCounts),
      ...Object.keys(assigneeAllCounts),
      ...Object.keys(processedCounts),
    ]);
    return Array.from(keys)
      .map((key) => {
        const processed = processedCounts[key] ?? 0;
        const { successLabel, prospectLabel } = computeRates(statusCountsByAssignee[key] ?? {}, processed);
        return {
          key,
          name: key === '__unassigned__' ? '미배정' : key === '__unknown__' ? '알 수 없음' : (staffMap[key] || '알 수 없음'),
          processed,
          successLabel,
          prospectLabel,
          pace: elapsedHours > 0 ? Math.round((processed / elapsedHours) * 10) / 10 : 0,
          intake: intakeCounts[key] ?? 0,
          total: assigneeAllCounts[key] ?? 0,
        };
      })
      .filter((a) => a.processed > 0 || a.intake > 0 || a.total > 0)
      .sort((a, b) => (b.processed - a.processed) || (b.intake - a.intake));
  }, [intakeRows, transitionRows, assigneeAllCounts, staffMap, elapsedHours]);

  // "담당자별 현황" 표 맨 위 "전체(팀 합계)" 행 — 이미 계산돼 있는 statusTotals/totalProcessed 재사용
  const teamRates = useMemo(() => computeRates(statusTotals, totalProcessed), [statusTotals, totalProcessed]);
  const teamTotalAssigned = useMemo(
    () => Object.values(assigneeAllCounts).reduce((a, b) => a + b, 0),
    [assigneeAllCounts],
  );

  // ── 담당자별 전체 상태 전환 상세 (출발 상태 무관 — 가망→부재, 재케어→가망 등 전부 포함) ──
  const staffTransitionDetail = useMemo(() => {
    const byStaff: Record<string, { pairs: Record<string, number>; total: number }> = {};
    allTransitionRows.forEach((r) => {
      const key = r.changed_by ?? '__unknown__';
      if (!byStaff[key]) byStaff[key] = { pairs: {}, total: 0 };
      const pairKey = `${r.from_status}→${r.to_status}`;
      byStaff[key].pairs[pairKey] = (byStaff[key].pairs[pairKey] ?? 0) + 1;
      byStaff[key].total += 1;
    });
    return Object.entries(byStaff)
      .map(([key, v]) => ({
        key,
        name: key === '__unknown__' ? '알 수 없음' : (staffMap[key] || '알 수 없음'),
        total: v.total,
        pairs: Object.entries(v.pairs).sort((a, b) => b[1] - a[1]) as [string, number][],
      }))
      .sort((a, b) => b.total - a.total);
  }, [allTransitionRows, staffMap]);

  const toggleExpand = (key: string) => {
    setExpandedStaff((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── 상태별 스냅샷 추이 계산 ──────────────────────────────────
  // "9시 가망 200건 → 9시10분 가망 198건"처럼 특정 시각에 각 상태에 몇 건이 있었는지는
  // 이벤트 개수만으론 알 수 없고, 그 시각까지의 모든 생성/전환을 순서대로 누적 재생해야
  // 함. 전체 생성 이력(모든 건은 생성 시각에 '신규'로 시작)과 전체 전환 이력을 하나의
  // 시간순 이벤트 스트림으로 합친 뒤, 10분 버킷을 지날 때마다 누적 집계(tally)를
  // 스냅샷으로 남기고, 그 버킷 구간 안에서 일어난 전환들은 별도로 모아서
  // "어디로 갔는지" 펼쳐보기용 상세로 함께 저장한다.
  const snapshotSeries = useMemo(() => {
    type Ev = { time: number; from: string | null; to: string };
    const events: Ev[] = [];
    creationRows.forEach((r) => {
      events.push({ time: new Date(r.created_at).getTime(), from: null, to: '신규' });
    });
    everTransitions.forEach((t) => {
      events.push({ time: new Date(t.changed_at).getTime(), from: t.from_status, to: t.to_status });
    });
    events.sort((a, b) => a.time - b.time);

    const buckets = generateSnapshotBuckets(snapshotDate);
    const tally: Record<string, number> = {};
    RESERVATION_STATUS_LIST.forEach((s) => { tally[s.value] = 0; });

    let idx = 0;
    return buckets.map((bucketTime) => {
      const bucketMs = bucketTime.getTime();
      const deltas: Record<string, number> = {};
      while (idx < events.length && events[idx].time <= bucketMs) {
        const ev = events[idx];
        if (ev.from) {
          tally[ev.from] = (tally[ev.from] ?? 0) - 1;
          const key = `${ev.from}→${ev.to}`;
          deltas[key] = (deltas[key] ?? 0) + 1;
        } else {
          deltas['신규 접수'] = (deltas['신규 접수'] ?? 0) + 1;
        }
        tally[ev.to] = (tally[ev.to] ?? 0) + 1;
        idx += 1;
      }
      return { time: bucketTime, tally: { ...tally }, deltas };
    });
  }, [snapshotDate, creationRows, everTransitions]);

  return (
    <div className="p-6 space-y-4">
      <WorkReportHeader
        title="사전예약 실시간 로그"
        description={`선택 기간의 접수량과 '신규 → 다른 상태' 처리 페이스, 담당자별 해결 현황입니다. 페이스(시간당)는 실제 영업시간(${BUSINESS_HOURS_LABEL}, 일요일 휴무 제외) 경과시간을 기준으로 계산합니다`}
        rightSlot={
          <>
            <ReservationCategoryToggle />
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
            <Button variant="ghost" size="icon" onClick={load} className="shrink-0">
              <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="기간 총 접수" value={totalIntake} color="pink" sub={`${dateStart} ~ ${dateEnd}`} />
        <KpiCard label="시간당 평균 접수" value={avgPerHour} color="blue" sub={`${BUSINESS_HOURS_LABEL} 기준 ${Math.round(elapsedHours * 10) / 10}시간 경과`} />
        <KpiCard label="기간 신규 처리" value={totalProcessed} color="indigo" sub="신규→다른 상태" />
        <KpiCard label="시간당 처리 페이스" value={processPace} color="indigo" sub="팀 전체, 건/시간" />
        <KpiCard
          label="신규 잔량"
          value={newBacklog}
          color={newBacklog > 0 ? 'orange' : 'gray'}
          sub={etaHours !== null ? `이 페이스면 약 ${etaHours}시간 소요` : '현재 시점, 미처리'}
        />
        <KpiCard label="확정 처리" value={statusTotals['확정'] ?? 0} color="green" />
        <KpiCard label="취소" value={statusTotals['취소'] ?? 0} color="gray" />
        <KpiCard label="실패" value={statusTotals['실패'] ?? 0} color="red" />
      </div>

      {/* 시간대별 접수 · 신규 처리 현황 */}
      <SectionCard
        title="시간대별 접수 · 신규 처리 현황"
        rightSlot={<span className="text-xs text-gray-400">{dateStart} ~ {dateEnd} 합산{loading && ' · 불러오는 중...'}</span>}
      >
        <div className="overflow-auto">
          <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-[1180px]">
            <TableHeader className="bg-gray-50">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[64px]">시간</TableHead>
                <TableHead className="text-xs text-center w-[70px] bg-blue-50">접수</TableHead>
                {TRACKED_STATUSES.map((s) => (
                  <TableHead key={s.value} className="text-xs text-center whitespace-nowrap">
                    신규→{s.value}
                  </TableHead>
                ))}
                <TableHead className="text-xs text-center w-[86px] bg-gray-100">신규처리합계</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleHours.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={TRACKED_STATUSES.length + 3} className="text-center py-10 text-sm text-gray-400">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                visibleHours.map((h) => {
                  const isNow = endIsToday && h === currentHour;
                  const isBeforeBusiness = h < BUSINESS_START_HOUR_ROW;
                  const isAfterBusiness = h >= BUSINESS_END_HOUR;
                  const isOffHours = isBeforeBusiness || isAfterBusiness;
                  const rowMap = hourlyTransitions[h] ?? {};
                  const rowTotal = Object.values(rowMap).reduce((a, b) => a + b, 0);
                  return (
                    <TableRow key={h} className={isNow ? 'bg-pink-50/60' : isOffHours ? 'opacity-40' : ''}>
                      <TableCell className="text-xs font-medium text-gray-700 whitespace-nowrap">
                        {String(h).padStart(2, '0')}시
                        {isNow && <span className="ml-1 text-[9px] text-pink-500 font-bold">NOW</span>}
                        {h === BUSINESS_START_HOUR_ROW && <span className="ml-1 text-[9px] text-indigo-500 font-bold">영업시작(9:30)</span>}
                        {h === BUSINESS_END_HOUR && <span className="ml-1 text-[9px] text-gray-400 font-bold">영업종료(20:00)</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-blue-700 bg-blue-50/50">
                        {hourlyIntake[h] ?? 0}
                      </TableCell>
                      {TRACKED_STATUSES.map((s) => (
                        <TableCell key={s.value} className="text-center text-xs text-gray-700">
                          {rowMap[s.value] ?? 0}
                        </TableCell>
                      ))}
                      <TableCell className="text-center text-xs font-bold text-gray-800 bg-gray-50">
                        {rowTotal}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {transitionRows.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-2">이 기간엔 신규 → 다른 상태로 처리된 건이 없습니다</div>
        )}
      </SectionCard>

      {/* 담당자별 현황 */}
      <SectionCard
        title="담당자별 현황"
        rightSlot={<span className="text-xs text-gray-400">기간 처리(해결) 순 · 페이스 = 영업시간({BUSINESS_HOURS_LABEL}, 일요일 제외) 기준 시간당 처리건수</span>}
      >
        <div className="overflow-auto">
          <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-[780px]">
            <TableHeader className="bg-gray-50">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[40px]">#</TableHead>
                <TableHead className="text-xs">담당자</TableHead>
                <TableHead className="text-xs text-center w-[100px] bg-indigo-50">기간 처리</TableHead>
                <TableHead className="text-xs text-center w-[130px] whitespace-nowrap">성공률(전체/부재제외)</TableHead>
                <TableHead className="text-xs text-center w-[130px] whitespace-nowrap">가망률(전체/부재제외)</TableHead>
                <TableHead className="text-xs text-center w-[100px]">시간당 페이스</TableHead>
                <TableHead className="text-xs text-center w-[90px]">기간 접수</TableHead>
                <TableHead className="text-xs text-center w-[110px]">전체 배정건수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-indigo-50/60 font-bold">
                <TableCell className="text-xs text-gray-400">—</TableCell>
                <TableCell className="text-sm">전체 (팀 합계)</TableCell>
                <TableCell className="text-center text-sm text-indigo-700">{totalProcessed}</TableCell>
                <TableCell className="text-center text-xs text-gray-700">{teamRates.successLabel}</TableCell>
                <TableCell className="text-center text-xs text-gray-700">{teamRates.prospectLabel}</TableCell>
                <TableCell className="text-center text-xs text-gray-700">{processPace}건/시간</TableCell>
                <TableCell className="text-center text-xs text-pink-600">{totalIntake}</TableCell>
                <TableCell className="text-center text-xs text-gray-600">{teamTotalAssigned}</TableCell>
              </TableRow>
              {assigneeRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-sm text-gray-400">담당자별 처리 데이터가 없습니다</TableCell>
                </TableRow>
              ) : (
                assigneeRows.map((a, i) => (
                  <TableRow key={a.key} className={a.key === '__unassigned__' || a.key === '__unknown__' ? 'text-gray-400' : ''}>
                    <TableCell className="text-xs text-gray-400">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {i < 3 && a.processed > 0 && <span className="mr-1">{MEDALS[i]}</span>}
                      {a.name}
                    </TableCell>
                    <TableCell className="text-center text-sm font-bold text-indigo-600 bg-indigo-50/40">{a.processed}</TableCell>
                    <TableCell className="text-center text-xs text-gray-700">{a.successLabel}</TableCell>
                    <TableCell className="text-center text-xs text-gray-700">{a.prospectLabel}</TableCell>
                    <TableCell className="text-center text-xs text-gray-700">{a.pace}건/시간</TableCell>
                    <TableCell className="text-center text-xs font-semibold text-pink-600">{a.intake}</TableCell>
                    <TableCell className="text-center text-xs text-gray-600">{a.total}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* 담당자별 전체 상태 전환 상세 — 신규 기준이 아닌 모든 전환(가망→부재, 재케어→가망 등) */}
      <SectionCard
        title="담당자별 전체 상태 전환 상세"
        rightSlot={<span className="text-xs text-gray-400">신규 처리뿐 아니라 이후 단계 전환까지 전부 포함 · 행을 눌러 펼쳐보기</span>}
      >
        <div className="overflow-auto">
          <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-[600px]">
            <TableHeader className="bg-gray-50">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[28px]"></TableHead>
                <TableHead className="text-xs">담당자</TableHead>
                <TableHead className="text-xs text-center w-[100px] bg-indigo-50">전체 전환건수</TableHead>
                <TableHead className="text-xs">전환 유형 미리보기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffTransitionDetail.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-sm text-gray-400">이 기간엔 상태 전환 이력이 없습니다</TableCell>
                </TableRow>
              ) : (
                staffTransitionDetail.map((s) => {
                  const expanded = expandedStaff.has(s.key);
                  const preview = s.pairs.slice(0, 4).map(([p, c]) => `${p} ${c}`).join(' · ');
                  const restCount = s.pairs.length - 4;
                  return (
                    <Fragment key={s.key}>
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleExpand(s.key)}
                      >
                        <TableCell className="text-gray-400">
                          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{s.name}</TableCell>
                        <TableCell className="text-center text-sm font-bold text-indigo-600 bg-indigo-50/40">{s.total}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {preview}{restCount > 0 && ` 외 ${restCount}종`}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                          <TableCell colSpan={4} className="py-3">
                            <div className="flex flex-wrap gap-2 pl-6">
                              {s.pairs.map(([p, c]) => (
                                <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs">
                                  <span className="text-gray-600">{p}</span>
                                  <span className="font-bold text-indigo-600">{c}</span>
                                </span>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* 상태별 스냅샷 추이 (10분 단위) — 특정 시각에 각 상태에 몇 건이 있었는지 + 그 구간에 뭐가 바뀌었는지 */}
      <SectionCard
        title="상태별 스냅샷 추이 (10분 단위)"
        rightSlot={
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">영업시간(09:30~20:00) 기준 · 행을 눌러 그 10분간 전환 내역 펼쳐보기</span>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => { setSnapshotDate(e.target.value); setExpandedBucket(null); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
            <Button variant="ghost" size="icon" onClick={loadSnapshotHistory} className="shrink-0">
              <RotateCw className={`size-4 ${snapshotLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      >
        <div className="overflow-auto max-h-[520px]">
          <Table className="[&_td]:py-1 [&_th]:py-1.5 min-w-[900px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[24px]"></TableHead>
                <TableHead className="text-xs w-[64px]">시각</TableHead>
                {RESERVATION_STATUS_LIST.map((s) => (
                  <TableHead key={s.value} className="text-xs text-center whitespace-nowrap">{s.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshotSeries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={RESERVATION_STATUS_LIST.length + 2} className="text-center py-10 text-sm text-gray-400">
                    {snapshotLoading ? '불러오는 중...' : '이 날짜는 아직 영업시간이 시작 전이거나 데이터가 없습니다'}
                  </TableCell>
                </TableRow>
              ) : (
                snapshotSeries.map((row, i) => {
                  const prev = i > 0 ? snapshotSeries[i - 1].tally : null;
                  const expanded = expandedBucket === i;
                  const deltaEntries = Object.entries(row.deltas).sort((a, b) => b[1] - a[1]);
                  const isLast = i === snapshotSeries.length - 1;
                  return (
                    <Fragment key={row.time.getTime()}>
                      <TableRow
                        className={`cursor-pointer hover:bg-gray-50 ${isLast ? 'bg-pink-50/50' : ''}`}
                        onClick={() => setExpandedBucket(expanded ? null : i)}
                      >
                        <TableCell className="text-gray-400">
                          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-gray-700 whitespace-nowrap">
                          {row.time.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          {isLast && <span className="ml-1 text-[9px] text-pink-500 font-bold">NOW</span>}
                        </TableCell>
                        {RESERVATION_STATUS_LIST.map((s) => {
                          const val = row.tally[s.value] ?? 0;
                          const diff = prev ? val - (prev[s.value] ?? 0) : 0;
                          return (
                            <TableCell key={s.value} className="text-center text-xs">
                              <span className="font-semibold text-gray-800">{val}</span>
                              {diff !== 0 && (
                                <span className={`ml-1 text-[10px] font-bold ${diff > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                  {diff > 0 ? `+${diff}` : diff}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-gray-50/60 hover:bg-gray-50/60">
                          <TableCell colSpan={RESERVATION_STATUS_LIST.length + 2} className="py-3">
                            {deltaEntries.length === 0 ? (
                              <div className="text-xs text-gray-400 pl-6">이 10분 동안은 변동이 없었습니다</div>
                            ) : (
                              <div className="flex flex-wrap gap-2 pl-6">
                                {deltaEntries.map(([p, c]) => (
                                  <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs">
                                    <span className="text-gray-600">{p}</span>
                                    <span className="font-bold text-indigo-600">{c}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
