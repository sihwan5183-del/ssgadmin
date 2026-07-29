// ============================================================
// 확정(서류작성) 목록 — LG본사 전산 크로스체크
// ============================================================
// 메인 기능: 확정 건을 본사에서 받은 엑셀과 전화번호 기준으로 대조해서
//   일치 / 정보상이(기기·용량·컬러 다름) / 확인전 / 본사만있음
// 4가지로 분류한다. (은행 대사 방식)
// ============================================================
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RotateCw, X, Download, Search, BarChart2, Upload, CheckCircle2,
  AlertTriangle, HelpCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
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
import {
  runCrossCheck,
  fetchCrossCheckStatusMap,
  type MatchStatus,
  type HqImportSummary,
  type HqCrossCheckRow,
} from '@/services/crossCheckService';

type ViewFilter = '전체' | '발주가능' | '미정';
type CcFilter = '전체' | '일치' | '정보상이' | '확인전';

const CC_BADGE: Record<MatchStatus | '확인전', { label: string; cls: string; icon: any }> = {
  '일치':     { label: '일치',    cls: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  '정보상이': { label: '정보상이', cls: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  '본사만있음': { label: '본사만있음', cls: 'bg-red-100 text-red-700', icon: AlertTriangle },
  '확인전':   { label: '확인전',  cls: 'bg-gray-100 text-gray-500', icon: HelpCircle },
};

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function ConfirmedListPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { staff } = useDashboardStaff();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ConfirmedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hqOnlyOpen, setHqOnlyOpen] = useState(true);

  // 크로스체크 상태
  const [latestImport, setLatestImport] = useState<HqImportSummary | null>(null);
  const [statusMap, setStatusMap] = useState<Map<string, { status: MatchStatus; mismatchFields: string[] }>>(new Map());
  const [hqOnlyRows, setHqOnlyRows] = useState<HqCrossCheckRow[]>([]);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [channel, setChannel] = useState('');
  const [assignee, setAssignee] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewFilter>(
    searchParams.get('unset') === '1' ? '미정' : '전체',
  );
  const [ccFilter, setCcFilter] = useState<CcFilter>('전체');

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

  const loadCrossCheck = useCallback(async () => {
    try {
      const { latestImport, statusByReservationId, hqOnlyRows } = await fetchCrossCheckStatusMap();
      setLatestImport(latestImport);
      setStatusMap(statusByReservationId);
      setHqOnlyRows(hqOnlyRows);
    } catch (e: any) {
      toast.error('대사 현황 로드 실패: ' + e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCrossCheck(); }, [loadCrossCheck]);

  const getCcStatus = (id: string): MatchStatus | '확인전' => statusMap.get(id)?.status ?? '확인전';

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) => {
      if (view === '발주가능' && !r.order_ready) return false;
      if (view === '미정' && r.order_ready) return false;
      if (ccFilter !== '전체' && getCcStatus(r.id) !== ccFilter) return false;
      if (q && !(r.name?.includes(q) || r.phone?.includes(q))) return false;
      return true;
    });
  }, [rows, view, ccFilter, search, statusMap]);

  const ccCounts = useMemo(() => {
    const c: Record<string, number> = { '일치': 0, '정보상이': 0, '확인전': 0 };
    rows.forEach((r) => { c[getCcStatus(r.id)] = (c[getCcStatus(r.id)] ?? 0) + 1; });
    return c;
  }, [rows, statusMap]);

  const readyCount = rows.filter((r) => r.order_ready).length;

  const handleReset = () => {
    setDateStart(''); setDateEnd(''); setChannel(''); setAssignee(''); setSearch(''); setView('전체'); setCcFilter('전체');
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await runCrossCheck(file, user?.id ?? null);
      toast.success(
        `대사 완료 — 일치 ${result.matched.length} · 정보상이 ${result.mismatched.length} · 본사만있음 ${result.hqOnly.length} · 우리만있음 ${result.oursOnly.length}`,
        { duration: 6000 },
      );
      await Promise.all([load(), loadCrossCheck()]);
    } catch (err: any) {
      toast.error('업로드 실패: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCsv = () => {
    if (!isAdmin) return toast.error('관리자만 내보낼 수 있습니다');
    if (filtered.length === 0) return toast.error('내보낼 데이터가 없습니다');
    downloadCsv(
      `확정목록_대사결과_${new Date().toISOString().slice(0, 10)}.csv`,
      ['#', '접수일', '고객명', '연락처', '통신사', '채널', '담당자', '기기', '용량', '컬러', '발주가능', '대사상태', '불일치항목', '메모'],
      filtered.map((r, i) => {
        const cc = statusMap.get(r.id);
        return [
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
          cc?.status ?? '확인전',
          (cc?.mismatchFields ?? []).join('/'),
          r.memo ?? '',
        ];
      }),
    );
    toast.success(`${filtered.length}건 CSV 다운로드`);
  };

  const cellClass = (v: string) =>
    v === UNSET ? 'text-xs text-gray-300 italic' : 'text-xs text-gray-700';

  return (
    <div className="p-6 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      <WorkReportHeader
        title="확정 목록 — 본사 크로스체크"
        description="확정(서류작성) 건을 LG본사 전산 데이터와 전화번호 기준으로 대조합니다"
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
              onClick={handleUploadClick}
              disabled={uploading}
            >
              <Upload className={`size-3.5 ${uploading ? 'animate-pulse' : ''}`} />
              {uploading ? '대사 처리 중...' : '본사 데이터 업로드'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/reservations/confirmed')}
            >
              <BarChart2 className="size-3.5" /> 발주 대시보드
            </Button>
          </>
        }
      />

      {/* 마지막 대사 정보 */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <Clock className="size-3.5 shrink-0" />
        {latestImport ? (
          <span>
            마지막 대사: <b className="text-gray-700">{formatDateTime(latestImport.created_at)}</b>
            {latestImport.file_name && <> · {latestImport.file_name}</>}
            {' · '}본사 데이터 {latestImport.row_count}건 업로드
          </span>
        ) : (
          <span>아직 본사 데이터를 업로드한 적이 없습니다. 위 [본사 데이터 업로드] 버튼으로 시작하세요.</span>
        )}
      </div>

      {/* 대사 요약 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="일치"
          value={ccCounts['일치'] ?? 0}
          color="green"
          sub="본사 데이터와 완전히 일치"
        />
        <KpiCard
          label="정보상이"
          value={ccCounts['정보상이'] ?? 0}
          color={(ccCounts['정보상이'] ?? 0) > 0 ? 'orange' : 'gray'}
          sub="전화번호는 맞는데 기기·용량·컬러 다름"
        />
        <KpiCard
          label="확인전 (본사 미확인)"
          value={ccCounts['확인전'] ?? 0}
          color={(ccCounts['확인전'] ?? 0) > 0 ? 'red' : 'gray'}
          sub="본사 데이터에서 못 찾음"
        />
        <KpiCard
          label="본사만 있음"
          value={hqOnlyRows.length}
          color={hqOnlyRows.length > 0 ? 'red' : 'gray'}
          sub="본사엔 있는데 확정목록엔 없음"
        />
      </div>

      {/* 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <Input
              placeholder="고객명 · 연락처 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['전체', '일치', '정보상이', '확인전'] as CcFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setCcFilter(v)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  ccFilter === v ? 'bg-white text-pink-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v}
              </button>
            ))}
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
            <SelectTrigger className="w-[140px] text-sm"><SelectValue placeholder="전체 채널" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 채널</SelectItem>
              {CHANNEL_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={assignee || '_all_'} onValueChange={(v) => setAssignee(v === '_all_' ? '' : v)}>
            <SelectTrigger className="w-[120px] text-sm"><SelectValue placeholder="전체 담당자" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 담당자</SelectItem>
              {staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.display_name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-gray-400">
            <X className="size-3.5" /> 초기화
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { load(); loadCrossCheck(); }} className="shrink-0">
            <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <span className="ml-auto text-xs text-gray-400">{filtered.length}건 표시 (전체 {rows.length}건)</span>
        </div>
      </SectionCard>

      {/* 본사에만 있는 건 (확정목록엔 없음) — 가장 중요한 누락 케이스 */}
      {hqOnlyRows.length > 0 && (
        <SectionCard>
          <button
            onClick={() => setHqOnlyOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            <AlertTriangle className="size-4 text-red-500 shrink-0" />
            <span className="text-sm font-semibold text-red-700">
              본사에만 있고 확정목록엔 없는 건 — {hqOnlyRows.length}건
            </span>
            <span className="text-xs text-gray-400">본사는 접수했는데 우리 시스템에 확정으로 안 잡혀있는 케이스, 확인 필요</span>
            {hqOnlyOpen ? <ChevronUp className="size-4 ml-auto text-gray-400" /> : <ChevronDown className="size-4 ml-auto text-gray-400" />}
          </button>
          {hqOnlyOpen && (
            <div className="overflow-auto mt-3 max-h-[300px]">
              <Table className="[&_td]:py-2 [&_th]:py-2 min-w-[600px]">
                <TableHeader className="bg-red-50/50">
                  <TableRow className="bg-red-50/50">
                    <TableHead className="text-xs">연락처</TableHead>
                    <TableHead className="text-xs">고객명</TableHead>
                    <TableHead className="text-xs">기기</TableHead>
                    <TableHead className="text-xs w-[80px]">용량</TableHead>
                    <TableHead className="text-xs w-[100px]">컬러</TableHead>
                    <TableHead className="text-xs w-[110px]">일련번호</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hqOnlyRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-gray-700 whitespace-nowrap">{formatPhone(r.phone_raw ?? '')}</TableCell>
                      <TableCell className="text-xs text-gray-700">{r.name ?? '-'}</TableCell>
                      <TableCell className="text-xs text-gray-700">{r.device ?? '-'}</TableCell>
                      <TableCell className="text-xs text-gray-500">{r.capacity ?? '-'}</TableCell>
                      <TableCell className="text-xs text-gray-500">{r.color ?? '-'}</TableCell>
                      <TableCell className="text-xs text-gray-400">{r.serial_no ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      )}

      {/* 확정 목록 */}
      <SectionCard>
        <div className="overflow-auto max-h-[calc(100vh-460px)]">
          <Table className="[&_td]:py-2 [&_th]:py-2 min-w-[1180px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[40px]">#</TableHead>
                <TableHead className="text-xs w-[100px]">대사</TableHead>
                <TableHead className="text-xs w-[110px]">접수일</TableHead>
                <TableHead className="text-xs">고객명</TableHead>
                <TableHead className="text-xs">연락처</TableHead>
                <TableHead className="text-xs whitespace-nowrap">통신사</TableHead>
                <TableHead className="text-xs whitespace-nowrap">채널</TableHead>
                <TableHead className="text-xs whitespace-nowrap">담당자</TableHead>
                <TableHead className="text-xs">기기</TableHead>
                <TableHead className="text-xs w-[80px]">용량</TableHead>
                <TableHead className="text-xs w-[110px]">컬러</TableHead>
                <TableHead className="text-xs">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-sm text-gray-400">로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-sm text-gray-400">데이터가 없습니다</TableCell></TableRow>
              ) : (
                filtered.map((r, idx) => {
                  const cc = statusMap.get(r.id);
                  const status = cc?.status ?? '확인전';
                  const badge = CC_BADGE[status];
                  const Icon = badge.icon;
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-pink-50/50 transition-colors"
                      onClick={() => setDetailId(r.id)}
                    >
                      <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}
                          title={cc?.mismatchFields?.length ? `불일치: ${cc.mismatchFields.join(', ')}` : undefined}
                        >
                          <Icon className="size-3" />
                          {badge.label}
                        </span>
                        {cc?.mismatchFields && cc.mismatchFields.length > 0 && (
                          <div className="text-[10px] text-orange-500 mt-0.5">{cc.mismatchFields.join('/')} 다름</div>
                        )}
                      </TableCell>
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
                      <TableCell className="text-xs text-gray-500 max-w-[200px]" title={r.memo ?? ''}>
                        <span className="line-clamp-2 whitespace-normal break-all leading-snug">{r.memo ?? '-'}</span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {detailId && (
        <ReservationDetailModal
          reservationId={detailId}
          onClose={() => setDetailId(null)}
          onDone={() => { setDetailId(null); load(); loadCrossCheck(); }}
        />
      )}
    </div>
  );
}
