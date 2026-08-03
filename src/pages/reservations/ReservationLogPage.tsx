// ============================================================
// 사전예약 실시간 로그 — 시간대별 접수/신규처리량 + 담당자별 현황
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
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { WorkReportHeader, SectionCard, KpiCard } from '@/pages/work-report/_shared';
import { RESERVATION_STATUS_LIST } from '@/types/reservation';
import {
  fetchIntakeRowsForDate,
  fetchNewOriginTransitionsForDate,
  fetchAllAssigneeRows,
  fetchNewBacklogCount,
  type IntakeLogRow,
  type NewOriginTransition,
} from '@/services/reservationService';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 처리량 표에서 보여줄 상태 목록 (신규 접수는 왼쪽 "접수" 열에서 이미 보여주므로 제외)
const TRACKED_STATUSES = RESERVATION_STATUS_LIST.filter((s) => s.value !== '신규');

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ReservationLogPage() {
  const { staff } = useDashboardStaff();
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [intakeRows, setIntakeRows] = useState<IntakeLogRow[]>([]);
  const [transitionRows, setTransitionRows] = useState<NewOriginTransition[]>([]);
  const [assigneeAllCounts, setAssigneeAllCounts] = useState<Record<string, number>>({});
  const [newBacklog, setNewBacklog] = useState(0);

  const staffMap = useMemo(() => {
    const m: Record<string, string> = {};
    staff.forEach((s) => { m[s.user_id] = s.display_name; });
    return m;
  }, [staff]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [intake, transitions, allAssignees, backlog] = await Promise.all([
        fetchIntakeRowsForDate(date),
        fetchNewOriginTransitionsForDate(date),
        fetchAllAssigneeRows(),
        fetchNewBacklogCount(),
      ]);
      setIntakeRows(intake);
      setTransitionRows(transitions);
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
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // ── 시간대별 접수량 ──
  const hourlyIntake = useMemo(() => {
    const m: Record<number, number> = {};
    intakeRows.forEach((r) => {
      const h = new Date(r.created_at).getHours();
      m[h] = (m[h] ?? 0) + 1;
    });
    return m;
  }, [intakeRows]);

  // ── 시간대별 "신규 → 상태" 처리량 (행=시, 열=넘어간 상태) ──
  const hourlyTransitions = useMemo(() => {
    const m: Record<number, Record<string, number>> = {};
    transitionRows.forEach((r) => {
      const h = new Date(r.changed_at).getHours();
      if (!m[h]) m[h] = {};
      m[h][r.to_status] = (m[h][r.to_status] ?? 0) + 1;
    });
    return m;
  }, [transitionRows]);

  const isToday = date === todayStr();
  const currentHour = isToday ? new Date().getHours() : 23;
  // 데이터가 있는 시간대 + (오늘이면) 지금까지 경과한 시간대는 항상 노출
  const visibleHours = HOURS.filter((h) => h <= currentHour || hourlyIntake[h] || hourlyTransitions[h]);

  const totalIntake = intakeRows.length;
  const elapsedHours = isToday ? currentHour + 1 : 24;
  const avgPerHour = elapsedHours > 0 ? Math.round((totalIntake / elapsedHours) * 10) / 10 : 0;

  const statusTotals = useMemo(() => {
    const t: Record<string, number> = {};
    transitionRows.forEach((r) => { t[r.to_status] = (t[r.to_status] ?? 0) + 1; });
    return t;
  }, [transitionRows]);

  const totalProcessed = transitionRows.length;

  const activeStatuses = useMemo(
    () => TRACKED_STATUSES.filter((s) => (statusTotals[s.value] ?? 0) > 0),
    [statusTotals],
  );

  // ── 담당자별 (오늘 접수 + 전체 배정) ──
  const assigneeRows = useMemo(() => {
    const todayCounts: Record<string, number> = {};
    intakeRows.forEach((r) => {
      const key = r.assigned_to ?? '__unassigned__';
      todayCounts[key] = (todayCounts[key] ?? 0) + 1;
    });
    const keys = new Set([...Object.keys(todayCounts), ...Object.keys(assigneeAllCounts)]);
    return Array.from(keys)
      .map((key) => ({
        key,
        name: key === '__unassigned__' ? '미배정' : (staffMap[key] || '알 수 없음'),
        today: todayCounts[key] ?? 0,
        total: assigneeAllCounts[key] ?? 0,
      }))
      .filter((a) => a.today > 0 || a.total > 0)
      .sort((a, b) => (b.today - a.today) || (b.total - a.total));
  }, [intakeRows, assigneeAllCounts, staffMap]);

  return (
    <div className="p-6 space-y-4">
      <WorkReportHeader
        title="사전예약 실시간 로그"
        description="시간대별 접수량과 '신규 → 다른 상태' 처리 페이스, 담당자별 입력 현황입니다. 처리량은 스펙시트 등 다른 항목 수정이 아니라 상태가 실제로 바뀐 시점만 집계합니다"
        rightSlot={
          <>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
            <Button variant="ghost" size="icon" onClick={load} className="shrink-0">
              <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="오늘 총 접수" value={totalIntake} color="pink" sub={isToday ? '실시간' : date} />
        <KpiCard label="시간당 평균 접수" value={avgPerHour} color="blue" sub={`${elapsedHours}시간 경과`} />
        <KpiCard label="오늘 신규 처리" value={totalProcessed} color="indigo" sub="신규→다른 상태" />
        <KpiCard label="신규 잔량" value={newBacklog} color={newBacklog > 0 ? 'orange' : 'gray'} sub="현재 시점, 미처리" />
        <KpiCard label="확정 처리" value={statusTotals['확정'] ?? 0} color="green" />
        <KpiCard label="취소" value={statusTotals['취소'] ?? 0} color="gray" />
        <KpiCard label="실패" value={statusTotals['실패'] ?? 0} color="red" />
      </div>

      {/* 시간대별 접수 · 신규 처리 현황 */}
      <SectionCard
        title="시간대별 접수 · 신규 처리 현황"
        rightSlot={<span className="text-xs text-gray-400">{date} 기준{loading && ' · 불러오는 중...'}</span>}
      >
        <div className="overflow-auto">
          <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-[640px]">
            <TableHeader className="bg-gray-50">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[64px]">시간</TableHead>
                <TableHead className="text-xs text-center w-[70px] bg-blue-50">접수</TableHead>
                {activeStatuses.map((s) => (
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
                  <TableCell colSpan={activeStatuses.length + 3} className="text-center py-10 text-sm text-gray-400">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                visibleHours.map((h) => {
                  const isNow = isToday && h === currentHour;
                  const rowMap = hourlyTransitions[h] ?? {};
                  const rowTotal = Object.values(rowMap).reduce((a, b) => a + b, 0);
                  return (
                    <TableRow key={h} className={isNow ? 'bg-pink-50/60' : ''}>
                      <TableCell className="text-xs font-medium text-gray-700 whitespace-nowrap">
                        {String(h).padStart(2, '0')}시
                        {isNow && <span className="ml-1 text-[9px] text-pink-500 font-bold">NOW</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold text-blue-700 bg-blue-50/50">
                        {hourlyIntake[h] ?? 0}
                      </TableCell>
                      {activeStatuses.map((s) => (
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
        {activeStatuses.length === 0 && transitionRows.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-2">이 날짜엔 신규 → 다른 상태로 처리된 건이 없습니다</div>
        )}
      </SectionCard>

      {/* 담당자별 현황 */}
      <SectionCard title="담당자별 현황" rightSlot={<span className="text-xs text-gray-400">오늘 접수 순</span>}>
        <div className="overflow-auto">
          <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-[420px]">
            <TableHeader className="bg-gray-50">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[40px]">#</TableHead>
                <TableHead className="text-xs">담당자</TableHead>
                <TableHead className="text-xs text-center w-[100px] bg-pink-50">오늘 접수</TableHead>
                <TableHead className="text-xs text-center w-[110px]">전체 배정건수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assigneeRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-sm text-gray-400">데이터가 없습니다</TableCell>
                </TableRow>
              ) : (
                assigneeRows.map((a, i) => (
                  <TableRow key={a.key} className={a.key === '__unassigned__' ? 'text-gray-400' : ''}>
                    <TableCell className="text-xs text-gray-400">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {i < 3 && a.today > 0 && <span className="mr-1">{MEDALS[i]}</span>}
                      {a.name}
                    </TableCell>
                    <TableCell className="text-center text-sm font-bold text-pink-600 bg-pink-50/40">{a.today}</TableCell>
                    <TableCell className="text-center text-xs text-gray-600">{a.total}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
