// ============================================================
// 확정 발주 스펙시트 — 본사 제출용 엑셀 양식 재현 + 본사 전산 수동 대사
// ============================================================
// v20260729-2: 스티키 헤더 버그 수정(overflow 이중래핑 제거) +
//   좌측 #/대사 열 가로스크롤시 고정 + 인라인 저장 신뢰성 강화
//   (디바운스 자동저장 + 저장상태 표시 점 + beforeunload 경고)
// v20260729-3: 가입유형 자동계산 기본값 반영 (LG U+→기기변경, 그외→MNP(통신사))
// v20260729-4: 관리자(isAdmin)는 고객명/연락처 마스킹 해제 + PII 워터마크 노출
// ============================================================
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RotateCw, X, Download, Search, BarChart2, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { maskName, maskPhone } from '@/lib/maskPii';
import { formatPhone } from '@/lib/phoneFormat';
import { WorkReportHeader, SectionCard, KpiCard } from '@/pages/work-report/_shared';
import { CHANNEL_OPTIONS, HQ_CHECK_STATUS_LIST, type HqCheckStatus } from '@/types/reservation';
import { ReservationDetailModal } from './ReservationDetailModal';
import PiiWatermark from '@/components/PiiWatermark';
import {
  fetchConfirmedReservations,
  downloadCsv,
  computeSubscriptionType,
  UNSET,
  type ConfirmedRow,
} from '@/services/confirmedOrderService';
import { setHqCheckStatus } from '@/services/crossCheckService';

type ViewFilter = '전체' | '발주가능' | '미정';
type CcFilter = '전체' | HqCheckStatus;
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const CC_ICON: Record<HqCheckStatus, any> = { '미확인': HelpCircle, '일치': CheckCircle2, '불일치': XCircle };

// 확정 건에 새로 얹는 스펙시트 필드. key = DB 컬럼명.
type SpecField =
  | 'subscription_type' | 'customer_address'
  | 'rate_plan' | 'premium_pack'
  | 'bundle_watch' | 'bundle_tablet'
  | 'home_internet' | 'home_tv' | 'home_smarthome';

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * 인라인 편집 입력칸.
 * - 타이핑 멈추고 0.7초 뒤 자동저장 + blur 시 즉시저장(둘 다 커버)
 * - 우측 상단에 저장상태 점(저장중/저장됨/실패) 표시
 * - 저장 안 된 값이 남아있으면 부모에게 알려서 beforeunload 경고에 반영
 */
function EditableCell({
  value, onSave, placeholder, width = 90, fieldKey, onDirtyChange,
}: {
  value: string | null;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  width?: number;
  fieldKey: string;
  onDirtyChange: (key: string, dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(value ?? '');
  const [state, setState] = useState<SaveState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value ?? '');
    setState('idle');
  }, [value]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
  }, []);

  const commit = async (v: string) => {
    if (v === (value ?? '')) {
      onDirtyChange(fieldKey, false);
      return;
    }
    setState('saving');
    try {
      await onSave(v);
      setState('saved');
      onDirtyChange(fieldKey, false);
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      savedFadeRef.current = setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('error'); // 실패 시 dirty 유지 (부모에서 이미 true로 표시돼있음)
    }
  };

  const handleChange = (v: string) => {
    setDraft(v);
    onDirtyChange(fieldKey, v !== (value ?? ''));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(v), 700);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commit(draft);
  };

  return (
    <div className="relative inline-block" style={{ width }}>
      <input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
        className="w-full text-xs border border-transparent hover:border-gray-200 focus:border-pink-300 focus:bg-white rounded px-1.5 py-1 bg-gray-50/60 outline-none transition-colors"
      />
      {state === 'saving' && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="저장 중..." />
      )}
      {state === 'saved' && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500" title="저장됨" />
      )}
      {state === 'error' && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" title="저장 실패 - 다시 시도해주세요" />
      )}
    </div>
  );
}

export default function ConfirmedListPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { staff } = useDashboardStaff();
  const navigate = useNavigate();

  const [rows, setRows] = useState<ConfirmedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [channel, setChannel] = useState('');
  const [assignee, setAssignee] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewFilter>('전체');
  const [ccFilter, setCcFilter] = useState<CcFilter>('전체');

  // ── 저장 안 된 셀 추적 (탭 닫기/새로고침 경고용) ──
  const dirtyKeysRef = useRef<Set<string>>(new Set());
  const handleDirtyChange = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyKeysRef.current.add(key);
    else dirtyKeysRef.current.delete(key);
  }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyKeysRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

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
      if (ccFilter !== '전체' && r.hq_check_status !== ccFilter) return false;
      if (q && !(r.name?.includes(q) || r.phone?.includes(q))) return false;
      return true;
    });
  }, [rows, view, ccFilter, search]);

  const ccCounts = useMemo(() => {
    const c: Record<HqCheckStatus, number> = { '미확인': 0, '일치': 0, '불일치': 0 };
    rows.forEach((r) => { c[r.hq_check_status] = (c[r.hq_check_status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const readyCount = rows.filter((r) => r.order_ready).length;

  const handleReset = () => {
    setDateStart(''); setDateEnd(''); setChannel(''); setAssignee(''); setSearch(''); setView('전체'); setCcFilter('전체');
  };

  // ── 스펙 필드 인라인 저장 (실패 시 throw → EditableCell이 에러상태 표시) ──
  const saveField = async (id: string, field: SpecField, val: string) => {
    const payload = { [field]: val.trim() === '' ? null : val.trim() };
    const { error } = await supabase.from('reservations').update(payload).eq('id', id);
    if (error) {
      toast.error('저장 실패: ' + error.message);
      throw error;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: payload[field] } as ConfirmedRow : r)));
  };

  // ── 본사 대사 토글 ──
  const handleSetCheck = async (r: ConfirmedRow, status: HqCheckStatus) => {
    let note: string | null = null;
    if (status === '불일치') {
      note = window.prompt('불일치 사유를 입력해주세요 (예: 컬러 다름 - 본사는 라벤더)', r.hq_check_note ?? '');
      if (note === null) return; // 취소
    }
    try {
      await setHqCheckStatus(r.id, status, note, user?.id ?? null);
      toast.success(status === '미확인' ? '대사 상태를 초기화했습니다' : `"${status}"로 표시했습니다`);
      await load();
    } catch (e: any) {
      toast.error('대사 처리 실패: ' + e.message);
    }
  };

  const handleCsv = () => {
    if (!isAdmin) return toast.error('관리자만 내보낼 수 있습니다');
    if (filtered.length === 0) return toast.error('내보낼 데이터가 없습니다');
    downloadCsv(
      `확정_발주스펙시트_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        '#', '고객명', '통신사', '가입유형', 'CTN', '고객주소',
        '모델명', '용량', '색상', '요금제', '프리미엄팩', '워치', '태블릿',
        '인터넷', 'TV프리', '스마트홈', '담당자', '대사상태', '불일치사유', '확인자', '확인시각',
      ],
      filtered.map((r, i) => [
        i + 1,
        r.name ?? '',
        r.carrier ?? '',
        r.subscription_type ?? computeSubscriptionType(r.carrier),
        r.phone ?? '',
        r.customer_address ?? '',
        r.device_norm,
        r.capacity_norm,
        r.color_norm,
        r.rate_plan ?? '',
        r.premium_pack ?? '',
        r.bundle_watch ?? '',
        r.bundle_tablet ?? '',
        r.home_internet ?? '',
        r.home_tv ?? '',
        r.home_smarthome ?? '',
        (r.assigned_to && staffMap[r.assigned_to]) || '미지정',
        r.hq_check_status,
        r.hq_check_note ?? '',
        (r.hq_checked_by && staffMap[r.hq_checked_by]) || '',
        formatDateTime(r.hq_checked_at),
      ]),
    );
    toast.success(`${filtered.length}건 CSV 다운로드`);
  };

  const cellClass = (v: string) =>
    v === UNSET ? 'text-xs text-gray-300 italic' : 'text-xs text-gray-700';

  // 좌측 고정 열 (# / 대사) 폭
  const COL_NO_W = 36;
  const COL_STATUS_W = 150;

  return (
    <div className="p-6 space-y-4">
      {isAdmin && <PiiWatermark />}
      <WorkReportHeader
        title="확정 발주 스펙시트"
        description="확정(서류작성) 건을 본사 제출 양식대로 정리합니다. 기존 값은 자동으로 채워지고, 없는 값만 입력하면 됩니다"
        rightSlot={
          <>
            {isAdmin && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCsv}>
                <Download className="size-3.5" /> CSV
              </Button>
            )}
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

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        본사 전산 화면과 이 목록을 나란히 놓고 눈으로 비교한 뒤, <b className="text-gray-700">[대사]</b> 열에서 일치/불일치 버튼을 눌러 표시하세요. (자동 매칭 아님) ·
        입력칸은 타이핑 멈추면 자동저장됩니다 (칸 우측 상단 점: <span className="text-amber-500">●</span>저장중 <span className="text-green-500">●</span>저장됨 <span className="text-red-500">●</span>실패)
      </div>

      {/* 대사 현황 KPI */}
      <div className="grid grid-cols-3 gap-3">
        {HQ_CHECK_STATUS_LIST.map((s) => (
          <KpiCard
            key={s.value}
            label={s.label}
            value={ccCounts[s.value]}
            color={s.value === '일치' ? 'green' : s.value === '불일치' ? 'red' : 'gray'}
          />
        ))}
      </div>

      {/* 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <Input
              placeholder="고객명 · 연락처 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['전체', '미확인', '일치', '불일치'] as CcFilter[]).map((v) => (
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
            <SelectTrigger className="w-[130px] text-sm"><SelectValue placeholder="전체 채널" /></SelectTrigger>
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
          <Button variant="ghost" size="icon" onClick={load} className="shrink-0">
            <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <span className="ml-auto text-xs text-gray-400">{filtered.length}건 표시 (전체 {rows.length}건)</span>
        </div>
      </SectionCard>

      {/* 스펙시트 */}
      <SectionCard>
        {/* shadcn Table이 자체적으로 overflow-auto div를 감싸고 있어서, 별도 div로 또
            감싸지 않고 그 내부 div에 직접 높이/스크롤을 지정한다. (이중 스크롤 컨테이너
            문제로 sticky가 안 먹던 버그 수정) */}
        <div className="[&>div]:max-h-[calc(100vh-460px)] [&>div]:overflow-auto">
          <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-[1900px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
              <TableRow className="bg-gray-100/80 hover:bg-gray-100/80">
                <TableHead
                  className="text-[10px] text-center sticky left-0 z-20 bg-gray-100 border-r border-gray-300"
                  colSpan={2}
                  style={{ minWidth: COL_NO_W + COL_STATUS_W }}
                >
                  대사
                </TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={4}>고객정보</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={1}>고객주소</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={3}>사전예약정보</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={2}>요금제정보</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={2}>2ND</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={3}>홈상품</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={1}>담당자</TableHead>
              </TableRow>
              <TableRow className="bg-gray-50">
                <TableHead
                  className="text-xs sticky left-0 z-20 bg-gray-50"
                  style={{ width: COL_NO_W, minWidth: COL_NO_W }}
                >
                  #
                </TableHead>
                <TableHead
                  className="text-xs sticky z-20 bg-gray-50 border-r border-gray-300"
                  style={{ left: COL_NO_W, width: COL_STATUS_W, minWidth: COL_STATUS_W }}
                >
                  상태
                </TableHead>
                <TableHead className="text-xs border-l border-gray-200">고객명</TableHead>
                <TableHead className="text-xs whitespace-nowrap">통신사</TableHead>
                <TableHead className="text-xs w-[100px]">가입유형</TableHead>
                <TableHead className="text-xs">CTN</TableHead>
                <TableHead className="text-xs w-[180px] border-l border-gray-200">주소</TableHead>
                <TableHead className="text-xs whitespace-nowrap border-l border-gray-200">모델명</TableHead>
                <TableHead className="text-xs w-[70px]">용량</TableHead>
                <TableHead className="text-xs w-[110px]">색상</TableHead>
                <TableHead className="text-xs w-[80px] border-l border-gray-200">요금제</TableHead>
                <TableHead className="text-xs w-[100px]">프리미엄팩</TableHead>
                <TableHead className="text-xs w-[100px] border-l border-gray-200">워치</TableHead>
                <TableHead className="text-xs w-[90px]">태블릿</TableHead>
                <TableHead className="text-xs w-[100px] border-l border-gray-200">인터넷</TableHead>
                <TableHead className="text-xs w-[80px]">TV프리</TableHead>
                <TableHead className="text-xs w-[90px]">스마트홈</TableHead>
                <TableHead className="text-xs whitespace-nowrap border-l border-gray-200">담당자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={18} className="text-center py-12 text-sm text-gray-400">로딩 중...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={18} className="text-center py-12 text-sm text-gray-400">데이터가 없습니다</TableCell></TableRow>
              ) : (
                filtered.map((r, idx) => {
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
                  return (
                    <TableRow key={r.id} className="hover:bg-pink-50/30 transition-colors group">
                      <TableCell
                        className={`text-xs text-gray-400 sticky left-0 z-[5] ${rowBg} group-hover:bg-pink-50`}
                        style={{ width: COL_NO_W, minWidth: COL_NO_W }}
                      >
                        {idx + 1}
                      </TableCell>

                      {/* 대사 상태 + 버튼 */}
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        className={`sticky z-[5] border-r border-gray-200 ${rowBg} group-hover:bg-pink-50`}
                        style={{ left: COL_NO_W, width: COL_STATUS_W, minWidth: COL_STATUS_W }}
                      >
                        <div className="flex items-center gap-1">
                          {(['미확인', '일치', '불일치'] as HqCheckStatus[]).map((s) => {
                            const Icon = CC_ICON[s];
                            const active = r.hq_check_status === s;
                            return (
                              <button
                                key={s}
                                title={s}
                                onClick={() => handleSetCheck(r, s)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                  active
                                    ? s === '일치' ? 'bg-green-500 text-white'
                                    : s === '불일치' ? 'bg-red-500 text-white'
                                    : 'bg-gray-300 text-white'
                                    : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                }`}
                              >
                                <Icon className="size-3.5" />
                              </button>
                            );
                          })}
                        </div>
                        {r.hq_checked_at && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {(r.hq_checked_by && staffMap[r.hq_checked_by]) || '-'} · {formatDateTime(r.hq_checked_at)}
                          </div>
                        )}
                        {r.hq_check_status === '불일치' && r.hq_check_note && (
                          <div className="text-[10px] text-red-500 mt-0.5 max-w-[140px] whitespace-normal leading-tight">{r.hq_check_note}</div>
                        )}
                      </TableCell>

                      {/* 고객정보 */}
                      <TableCell className="text-sm font-medium cursor-pointer border-l border-gray-100" onClick={() => setDetailId(r.id)}>
                        {isAdmin ? (r.name || '-') : maskName(r.name)}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap cursor-pointer" onClick={() => setDetailId(r.id)}>
                        {r.carrier ?? '-'}
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={r.subscription_type ?? computeSubscriptionType(r.carrier)}
                          placeholder="MNP(SKT)"
                          width={90}
                          fieldKey={`${r.id}:subscription_type`}
                          onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'subscription_type', v)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 whitespace-nowrap cursor-pointer" onClick={() => setDetailId(r.id)}>
                        {isAdmin ? formatPhone(r.phone) : maskPhone(formatPhone(r.phone))}
                      </TableCell>

                      {/* 고객주소 */}
                      <TableCell className="border-l border-gray-100">
                        <EditableCell
                          value={r.customer_address}
                          placeholder="주소 입력"
                          width={170}
                          fieldKey={`${r.id}:customer_address`}
                          onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'customer_address', v)}
                        />
                      </TableCell>

                      {/* 사전예약정보 (읽기전용, 기존 DB값) */}
                      <TableCell className={`whitespace-nowrap border-l border-gray-100 cursor-pointer ${r.device_norm === UNSET ? 'text-xs text-gray-300 italic' : 'text-xs text-blue-600 font-medium'}`} onClick={() => setDetailId(r.id)}>
                        {r.device_norm}
                      </TableCell>
                      <TableCell className={`cursor-pointer ${cellClass(r.capacity_norm)}`} onClick={() => setDetailId(r.id)}>{r.capacity_norm}</TableCell>
                      <TableCell className={`whitespace-nowrap cursor-pointer ${cellClass(r.color_norm)}`} onClick={() => setDetailId(r.id)}>{r.color_norm}</TableCell>

                      {/* 요금제정보 */}
                      <TableCell className="border-l border-gray-100">
                        <EditableCell
                          value={r.rate_plan} placeholder="115" width={60}
                          fieldKey={`${r.id}:rate_plan`} onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'rate_plan', v)}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={r.premium_pack} placeholder="버즈4" width={80}
                          fieldKey={`${r.id}:premium_pack`} onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'premium_pack', v)}
                        />
                      </TableCell>

                      {/* 2ND */}
                      <TableCell className="border-l border-gray-100">
                        <EditableCell
                          value={r.bundle_watch} placeholder="워치9 40MM" width={90}
                          fieldKey={`${r.id}:bundle_watch`} onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'bundle_watch', v)}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={r.bundle_tablet} placeholder="X236" width={70}
                          fieldKey={`${r.id}:bundle_tablet`} onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'bundle_tablet', v)}
                        />
                      </TableCell>

                      {/* 홈상품 */}
                      <TableCell className="border-l border-gray-100">
                        <EditableCell
                          value={r.home_internet} placeholder="올인원 500M" width={90}
                          fieldKey={`${r.id}:home_internet`} onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'home_internet', v)}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={r.home_tv} placeholder="-" width={60}
                          fieldKey={`${r.id}:home_tv`} onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'home_tv', v)}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={r.home_smarthome} placeholder="-" width={70}
                          fieldKey={`${r.id}:home_smarthome`} onDirtyChange={handleDirtyChange}
                          onSave={(v) => saveField(r.id, 'home_smarthome', v)}
                        />
                      </TableCell>

                      <TableCell className="text-xs text-gray-500 whitespace-nowrap border-l border-gray-100">
                        {(r.assigned_to && staffMap[r.assigned_to]) || '미지정'}
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
          onDone={() => { setDetailId(null); load(); }}
        />
      )}
    </div>
  );
}
