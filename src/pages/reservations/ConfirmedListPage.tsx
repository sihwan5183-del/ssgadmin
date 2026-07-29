// ============================================================
// 확정(서류작성) 목록
// status='확정' 건만 누적해서 보여주는 전용 목록.
// 행 클릭 시 기존 사전예약 상세 모달을 열어 기기/용량/컬러를 채울 수 있습니다.
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCw, X, Download, Search, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useRole } from '@/hooks/useRole';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { maskName, maskPhone } from '@/lib/maskPii';
import { formatPhone } from '@/lib/phoneFormat';
import { WorkReportHeader, SectionCard, KpiCard } from '@/pages/work-report/_shared';
import { CHANNEL_OPTIONS } from '@/types/reservation';
import { ReservationDetailModal } from './ReservationDetailModal';
import {
  fetchConfirmedReservations,
  downloadCsv,
  UNSET,
  type ConfirmedRow,
} from '@/services/confirmedOrderService';

type ViewFilter = '전체' | '발주가능' | '미정';

export default function ConfirmedListPage() {
  const { isAdmin } = useRole();
  const { staff } = useDashboardStaff();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState<ConfirmedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [channel, setChannel] = useState('');
  const [assignee, setAssignee] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewFilter>(
    searchParams.get('unset') === '1' ? '미정' : '전체',
  );

  const staffMap = useMemo(() => {
    const m: Record<string, string> = {};
    staff.forEach((s) => { m[s.user_id] = s.display_name; });
    return m;
  }, [staff]);

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

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) => {
      if (view === '발주가능' && !r.order_ready) return false;
      if (view === '미정' && r.order_ready) return false;
      if (q && !(r.name?.includes(q) || r.phone?.includes(q))) return false;
      return true;
    });
  }, [rows, view, search]);

  const readyCount = rows.filter((r) => r.order_ready).length;

  const handleReset = () => {
    setDateStart(''); setDateEnd(''); setChannel(''); setAssignee(''); setSearch(''); setView('전체');
  };

  const handleCsv = () => {
    if (!isAdmin) return toast.error('관리자만 내보낼 수 있습니다');
    if (filtered.length === 0) return toast.error('내보낼 데이터가 없습니다');
    downloadCsv(
      `확정목록_${new Date().toISOString().slice(0, 10)}.csv`,
      ['#', '접수일', '고객명', '연락처', '통신사', '채널', '담당자', '기기', '용량', '컬러', '발주가능', '메모'],
      filtered.map((r, i) => [
        i + 1,
        r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '',
        r.name ?? '',
        r.phone ?? '',
        r.carrier ?? '',
        r.channel ?? '',
        (r.assigned_to && staffMap[r.assigned_to]) || '미지정',
        r.device_norm,
        r.capacity_norm,
        r.color_norm,
        r.order_ready ? 'O' : 'X',
        r.memo ?? '',
      ]),
    );
    toast.success(`${filtered.length}건 CSV 다운로드`);
  };

  const cellClass = (v: string) =>
    v === UNSET ? 'text-xs text-gray-300 italic' : 'text-xs text-gray-700';

  return (
    <div className="p-6 space-y-4">
      <WorkReportHeader
        title="확정 목록"
        description="확정(서류작성) 상태로 누적된 고객 건입니다. 행을 클릭하면 기기·용량·컬러를 수정할 수 있습니다"
        rightSlot={
          <>
            {isAdmin && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCsv}>
                <Download className="size-3.5" /> CSV
              </Button>
            )}
            <Button
              size="sm"
              className="gap-1.5 bg-pink-500 hover:bg-pink-600"
              onClick={() => navigate('/reservations/confirmed')}
            >
              <BarChart2 className="size-3.5" /> 발주 대시보드
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="확정 총건수" value={rows.length} color="pink" />
        <KpiCard label="발주 가능" value={readyCount} color="green" sub="기기·용량·컬러 모두 확정" />
        <KpiCard
          label="정보 미정"
          value={rows.length - readyCount}
          color={rows.length - readyCount > 0 ? 'orange' : 'gray'}
          sub="추가 확인 필요"
        />
      </div>

      {/* 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <Input
              placeholder="고객명 · 연락처 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['전체', '발주가능', '미정'] as ViewFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  view === v ? 'bg-white text-pink-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-400 shrink-0 ml-1">접수일</span>
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
          <span className="ml-auto text-xs text-gray-400">{filtered.length}건 표시</span>
        </div>
      </SectionCard>

      {/* 목록 */}
      <SectionCard>
        <div className="overflow-auto max-h-[calc(100vh-380px)]">
          <Table className="[&_td]:py-2 [&_th]:py-2 min-w-[1080px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[40px]">#</TableHead>
                <TableHead className="text-xs w-[110px]">접수일</TableHead>
                <TableHead className="text-xs">고객명</TableHead>
                <TableHead className="text-xs">연락처</TableHead>
                <TableHead className="text-xs whitespace-nowrap">통신사</TableHead>
                <TableHead className="text-xs whitespace-nowrap">채널</TableHead>
                <TableHead className="text-xs whitespace-nowrap">담당자</TableHead>
                <TableHead className="text-xs">기기</TableHead>
                <TableHead className="text-xs w-[80px]">용량</TableHead>
                <TableHead className="text-xs w-[110px]">컬러</TableHead>
                <TableHead className="text-xs w-[80px] text-center">발주가능</TableHead>
                <TableHead className="text-xs">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-sm text-gray-400">로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-sm text-gray-400">데이터가 없습니다</TableCell></TableRow>
              ) : (
                filtered.map((r, idx) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-pink-50/50 transition-colors"
                    onClick={() => setDetailId(r.id)}
                  >
                    <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{maskName(r.name)}</TableCell>
                    <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                      {maskPhone(formatPhone(r.phone))}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">{r.carrier ?? '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">{r.channel ?? '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {(r.assigned_to && staffMap[r.assigned_to]) || '미지정'}
                    </TableCell>
                    <TableCell className={`whitespace-nowrap ${r.device_norm === UNSET ? 'text-xs text-gray-300 italic' : 'text-xs text-blue-600 font-medium'}`}>
                      {r.device_norm}
                    </TableCell>
                    <TableCell className={cellClass(r.capacity_norm)}>{r.capacity_norm}</TableCell>
                    <TableCell className={`whitespace-nowrap ${cellClass(r.color_norm)}`}>{r.color_norm}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.order_ready ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {r.order_ready ? '가능' : '미정'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[220px]" title={r.memo ?? ''}>
                      <span className="line-clamp-2 whitespace-normal break-all leading-snug">{r.memo ?? '-'}</span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {detailId && (
        <ReservationDetailModal
          reservationId={detailId}
          onClose={() => setDetailId(null)}
          onDone={() => { setDetailId(null); load(); }}
        />
      )}
    </div>
  );
}
