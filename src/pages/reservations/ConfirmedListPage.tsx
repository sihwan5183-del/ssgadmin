// ============================================================
// 확정 발주 스펙시트 — 본사 제출용 엑셀 양식 재현 + 본사 전산 수동 대사
// ============================================================
// 원본은 reservations 의 확정 건. 이미 있는 값(고객명/통신사/CTN/모델명/
// 용량/색상)은 자동으로 채워지고, 없는 값(주소/요금제/프리미엄팩/워치/
// 태블릿/인터넷/TV프리/스마트홈)만 이 화면에서 인라인으로 입력한다.
// 본사 대사는 자동매칭이 아니라 담당자가 화면 보고 눈으로 비교한 뒤
// 미확인 → 일치 / 불일치(사유) 로 직접 토글하는 방식.
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
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
import {
  fetchConfirmedReservations,
  downloadCsv,
  UNSET,
  type ConfirmedRow,
} from '@/services/confirmedOrderService';
import { setHqCheckStatus } from '@/services/crossCheckService';

type ViewFilter = '전체' | '발주가능' | '미정';
type CcFilter = '전체' | HqCheckStatus;

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

/** 인라인 편집 입력칸. blur 시점에 값이 바뀐 경우에만 저장한다. */
function EditableCell({
  value, onSave, placeholder, width = 90,
}: {
  value: string | null;
  onSave: (v: string) => void;
  placeholder?: string;
  width?: number;
}) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== (value ?? '')) onSave(draft); }}
      onClick={(e) => e.stopPropagation()}
      style={{ width }}
      className="text-xs border border-transparent hover:border-gray-200 focus:border-pink-300 focus:bg-white rounded px-1.5 py-1 bg-gray-50/60 outline-none transition-colors"
    />
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

  // ── 스펙 필드 인라인 저장 ──
  const saveField = async (id: string, field: SpecField, val: string) => {
    const payload = { [field]: val.trim() === '' ? null : val.trim() };
    const { error } = await supabase.from('reservations').update(payload).eq('id', id);
    if (error) {
      toast.error('저장 실패: ' + error.message);
      return;
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
        r.subscription_type ?? '',
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

  return (
    <div className="p-6 space-y-4">
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
        본사 전산 화면과 이 목록을 나란히 놓고 눈으로 비교한 뒤, <b className="text-gray-700">[대사]</b> 열에서 일치/불일치 버튼을 눌러 표시하세요. (자동 매칭 아님)
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
        <div className="overflow-auto max-h-[calc(100vh-420px)]">
          <Table className="[&_td]:py-1.5 [&_th]:py-1.5 min-w-[1900px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
              <TableRow className="bg-gray-100/80 hover:bg-gray-100/80">
                <TableHead className="text-[10px] text-center" colSpan={2}>대사</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={4}>고객정보</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={1}>고객주소</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={3}>사전예약정보</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={2}>요금제정보</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={2}>2ND</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={3}>홈상품</TableHead>
                <TableHead className="text-[10px] text-center border-l border-gray-200" colSpan={1}>담당자</TableHead>
              </TableRow>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[36px]">#</TableHead>
                <TableHead className="text-xs w-[150px]">상태</TableHead>
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
                  const ccMeta = HQ_CHECK_STATUS_LIST.find((s) => s.value === r.hq_check_status)!;
                  return (
                    <TableRow key={r.id} className="hover:bg-pink-50/30 transition-colors">
                      <TableCell className="text-xs text-gray-400">{idx + 1}</TableCell>

                      {/* 대사 상태 + 버튼 */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                        {maskName(r.name)}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap cursor-pointer" onClick={() => setDetailId(r.id)}>
                        {r.carrier ?? '-'}
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={r.subscription_type}
                          placeholder="MNP(SKT)"
                          width={90}
                          onSave={(v) => saveField(r.id, 'subscription_type', v)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 whitespace-nowrap cursor-pointer" onClick={() => setDetailId(r.id)}>
                        {maskPhone(formatPhone(r.phone))}
                      </TableCell>

                      {/* 고객주소 */}
                      <TableCell className="border-l border-gray-100">
                        <EditableCell
                          value={r.customer_address}
                          placeholder="주소 입력"
                          width={170}
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
                        <EditableCell value={r.rate_plan} placeholder="115" width={60} onSave={(v) => saveField(r.id, 'rate_plan', v)} />
                      </TableCell>
                      <TableCell>
                        <EditableCell value={r.premium_pack} placeholder="버즈4" width={80} onSave={(v) => saveField(r.id, 'premium_pack', v)} />
                      </TableCell>

                      {/* 2ND */}
                      <TableCell className="border-l border-gray-100">
                        <EditableCell value={r.bundle_watch} placeholder="워치9 40MM" width={90} onSave={(v) => saveField(r.id, 'bundle_watch', v)} />
                      </TableCell>
                      <TableCell>
                        <EditableCell value={r.bundle_tablet} placeholder="X236" width={70} onSave={(v) => saveField(r.id, 'bundle_tablet', v)} />
                      </TableCell>

                      {/* 홈상품 */}
                      <TableCell className="border-l border-gray-100">
                        <EditableCell value={r.home_internet} placeholder="올인원 500M" width={90} onSave={(v) => saveField(r.id, 'home_internet', v)} />
                      </TableCell>
                      <TableCell>
                        <EditableCell value={r.home_tv} placeholder="-" width={60} onSave={(v) => saveField(r.id, 'home_tv', v)} />
                      </TableCell>
                      <TableCell>
                        <EditableCell value={r.home_smarthome} placeholder="-" width={70} onSave={(v) => saveField(r.id, 'home_smarthome', v)} />
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
