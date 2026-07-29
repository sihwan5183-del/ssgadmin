// ============================================================
// 확정(서류작성) 발주 대시보드 — 기기별 완전분리
// ============================================================
// 좌(폴드8) / 가운데(폴드8 울트라) / 우(플립8) 3단 고정 레이아웃.
// 폴드8 그라파이트와 울트라 그라파이트는 다른 제품이라, 기기를 섞은
// 전체 통합 컬러/용량 분포는 보여주지 않는다. 반드시 기기 단위로만 집계.
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCw, X, Download, ListChecks, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { WorkReportHeader, SectionCard, KpiCard } from '@/pages/work-report/_shared';
import { CHANNEL_OPTIONS } from '@/types/reservation';
import {
  fetchConfirmedReservations,
  buildConfirmedSummary,
  downloadCsv,
  UNSET,
  type ConfirmedRow,
  type DevicePivot,
} from '@/services/confirmedOrderService';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function DeviceMatrix({ p }: { p: DevicePivot }) {
  return (
    <SectionCard
      title={p.device}
      rightSlot={<span className="text-xs font-semibold text-pink-600">{p.total}건</span>}
    >
      <div className="overflow-auto">
        <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-full">
          <TableHeader className="bg-gray-50">
            <TableRow className="bg-gray-50">
              <TableHead className="text-xs w-[64px]">용량\컬러</TableHead>
              {p.colors.map((c) => (
                <TableHead key={c} className={`text-xs text-center whitespace-nowrap ${c === UNSET ? 'text-gray-400 italic' : ''}`}>
                  {c}
                </TableHead>
              ))}
              <TableHead className="text-xs text-center w-[50px] bg-gray-100">합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.capacities.map((cap) => (
              <TableRow key={cap}>
                <TableCell className={`text-xs font-medium ${cap === UNSET ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                  {cap}
                </TableCell>
                {p.colors.map((col) => {
                  const n = p.cells[`${cap}|${col}`] ?? 0;
                  return (
                    <TableCell key={col} className="text-center">
                      {n > 0 ? (
                        <span className={`inline-flex items-center justify-center min-w-[26px] h-6 px-1.5 rounded-full text-xs font-bold ${
                          cap === UNSET || col === UNSET ? 'bg-gray-100 text-gray-500' : 'bg-pink-100 text-pink-700'
                        }`}>
                          {n}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-200">·</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center text-xs font-bold text-gray-800 bg-gray-50">
                  {p.rowTotals[cap] ?? 0}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-gray-50">
              <TableCell className="text-xs font-bold text-gray-700">합계</TableCell>
              {p.colors.map((col) => (
                <TableCell key={col} className="text-center text-xs font-bold text-gray-800">
                  {p.colTotals[col] ?? 0}
                </TableCell>
              ))}
              <TableCell className="text-center text-xs font-bold text-pink-600 bg-gray-100">{p.total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

export default function ConfirmedDashboardPage() {
  const { staff } = useDashboardStaff();
  const navigate = useNavigate();

  const [rows, setRows] = useState<ConfirmedRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [channel, setChannel] = useState('');
  const [assignee, setAssignee] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchConfirmedReservations({
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        channel: channel || undefined,
        assignedTo: assignee || undefined,
      });
      setRows(data);
    } catch (e: any) {
      toast.error('데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd, channel, assignee]);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => buildConfirmedSummary(rows), [rows]);

  const handleReset = () => {
    setDateStart(''); setDateEnd(''); setChannel(''); setAssignee('');
  };

  const handleComboCsv = () => {
    if (summary.combos.length === 0) return toast.error('내보낼 데이터가 없습니다');
    downloadCsv(
      `확정_발주표_${todayStr()}.csv`,
      ['기기', '용량', '컬러', '수량', '비중(%)', '발주가능'],
      summary.combos.map((c) => [c.device, c.capacity, c.color, c.count, c.ratio, c.ready ? 'O' : 'X']),
    );
    toast.success('발주표 CSV 다운로드');
  };

  const unsetCount = rows.filter((r) => !r.order_ready).length;

  return (
    <div className="p-6 space-y-4">
      <WorkReportHeader
        title="확정 발주 대시보드"
        description="확정(서류작성) 건의 기기별 용량 · 컬러 분포입니다. 기기가 다르면 같은 컬러명이라도 다른 제품이라 항상 기기 단위로 나눠 봅니다"
        rightSlot={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleComboCsv}>
              <Download className="size-3.5" /> 발주표 CSV
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-pink-500 hover:bg-pink-600"
              onClick={() => navigate('/reservations/confirmed/list')}
            >
              <ListChecks className="size-3.5" /> 확정 스펙시트
            </Button>
          </>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="확정 총건수" value={summary.total} color="pink" sub="status = 확정(서류작성)" />
        <KpiCard label="발주 가능" value={summary.orderReady} color="green" sub="기기·용량·컬러 모두 확정" />
        <KpiCard label="기기 미정" value={summary.deviceUnset} color={summary.deviceUnset > 0 ? 'orange' : 'gray'} />
        <KpiCard label="용량 미정" value={summary.capacityUnset} color={summary.capacityUnset > 0 ? 'orange' : 'gray'} />
        <KpiCard label="컬러 미정" value={summary.colorUnset} color={summary.colorUnset > 0 ? 'red' : 'gray'} />
      </div>

      {/* 미정 경고 */}
      {unsetCount > 0 && summary.total > 0 && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-800">
            확정 {summary.total}건 중 <b>{unsetCount}건</b>
            ({Math.round((unsetCount / summary.total) * 100)}%)이 기기·용량·컬러 중 하나 이상 미정 상태라 발주 수량에 반영할 수 없습니다.
          </span>
          <Button
            variant="ghost" size="sm"
            className="ml-auto h-7 text-xs text-amber-700 hover:bg-amber-100 shrink-0"
            onClick={() => navigate('/reservations/confirmed/list')}
          >
            확정 스펙시트에서 확인 →
          </Button>
        </div>
      )}

      {/* 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0">접수일</span>
          <input
            type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
          />

          <Select value={channel || '_all_'} onValueChange={(v) => setChannel(v === '_all_' ? '' : v)}>
            <SelectTrigger className="w-[150px] text-sm"><SelectValue placeholder="전체 채널" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 채널</SelectItem>
              {CHANNEL_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={assignee || '_all_'} onValueChange={(v) => setAssignee(v === '_all_' ? '' : v)}>
            <SelectTrigger className="w-[130px] text-sm"><SelectValue placeholder="전체 담당자" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 담당자</SelectItem>
              {staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.display_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-gray-400">
            <X className="size-3.5" /> 초기화
          </Button>
          <Button variant="ghost" size="icon" onClick={load} className="shrink-0">
            <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <span className="ml-auto text-xs text-gray-400">총 {summary.total}건</span>
        </div>
      </SectionCard>

      {/* 좌: 폴드8 / 가운데: 폴드8 울트라 / 우: 플립8 — 완전 분리 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {summary.pivots.map((p) => (
          <DeviceMatrix key={p.device} p={p} />
        ))}
      </div>

      {/* 전체 조합 발주표 */}
      <SectionCard title="발주표 (기기 · 용량 · 컬러 조합별 수량)">
        <div className="overflow-auto max-h-[420px]">
          <Table className="[&_td]:py-2 [&_th]:py-2 min-w-[620px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[40px]">#</TableHead>
                <TableHead className="text-xs">기기</TableHead>
                <TableHead className="text-xs w-[90px]">용량</TableHead>
                <TableHead className="text-xs w-[130px]">컬러</TableHead>
                <TableHead className="text-xs w-[70px] text-right">수량</TableHead>
                <TableHead className="text-xs w-[70px] text-right">비중</TableHead>
                <TableHead className="text-xs w-[80px] text-center">발주가능</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-sm text-gray-400">로딩 중...</TableCell></TableRow>
              ) : summary.combos.filter((c) => c.count > 0).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-sm text-gray-400">확정 건이 없습니다</TableCell></TableRow>
              ) : (
                summary.combos.filter((c) => c.count > 0).map((c, i) => (
                  <TableRow key={`${c.device}|${c.capacity}|${c.color}`} className={c.ready ? '' : 'bg-gray-50/60'}>
                    <TableCell className="text-xs text-gray-400">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium text-blue-600 whitespace-nowrap">{c.device}</TableCell>
                    <TableCell className={`text-xs ${c.capacity === UNSET ? 'text-gray-400 italic' : 'text-gray-700'}`}>{c.capacity}</TableCell>
                    <TableCell className={`text-xs whitespace-nowrap ${c.color === UNSET ? 'text-gray-400 italic' : 'text-gray-700'}`}>{c.color}</TableCell>
                    <TableCell className="text-xs font-bold text-gray-900 text-right">{c.count}</TableCell>
                    <TableCell className="text-xs text-gray-400 text-right">{c.ratio}%</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        c.ready ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {c.ready ? '가능' : '미정'}
                      </span>
                    </TableCell>
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
