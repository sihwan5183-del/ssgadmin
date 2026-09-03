// ============================================================
// 사전예약 관리 — 목록 메인 페이지
// 채널별 탭 + 날짜 필터 + 상태 필터
// ============================================================
// v20260803: "유심 MNP"는 이제 관심기기가 아니라 상태(status) 값으로도 존재합니다
//  (RESERVATION_STATUS_LIST에 포함) — 상태 카드/필터가 자동으로 유심 MNP를
//  다뤄주므로, 이 페이지에서 관심기기 기준 별도 카드/필터는 넣지 않습니다.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, RotateCw, BarChart2, X, Clock } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { maskName, maskPhone } from '@/lib/maskPii';
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { WorkReportHeader, SectionCard } from '@/pages/work-report/_shared';
import { fetchReservations, fetchAllPaged, deleteReservation } from '@/services/reservationService';
import type { Reservation, ReservationStatus, ProspectGrade } from '@/types/reservation';
import { RESERVATION_STATUS_LIST, PROSPECT_GRADE_OPTIONS, ABSENT_COUNT_OPTIONS, ABSENT_MAX } from '@/types/reservation';
import type { AbsentCount } from '@/types/reservation';
import { ReservationAddModal } from './ReservationAddModal';
import { ReservationDetailModal } from './ReservationDetailModal';
import { formatPhone } from '@/lib/phoneFormat';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 50;

// deploy trigger v3 (기존고객 채널 - JSX 중복 </TableCell> 오류 수정)
const CHANNEL_TABS = [
  { value: '',           label: '전체' },
  { value: '메타광고',   label: '메타광고' },
  { value: '네이버 검색광고', label: '네이버 검색광고' },
  { value: '기타',       label: '기타' },
  { value: '기존고객',    label: '기존고객' },
];

// iphone18 캠페인 — 기존1(전체통신사) / 신규2(MNP전용) 구분용
// utm_campaign에는 메타 광고관리자가 자동으로 채워주는 캠페인 ID(숫자)가 그대로 들어오므로,
// 여기서 사람이 읽을 수 있는 이름으로 매핑해서 보여줍니다. 새 캠페인이 생기면 이 배열에 추가하세요.
const CAMPAIGN_OPTIONS = [
  { value: '120249648804880479', label: '기존1 (전체통신사)' },
  { value: '120249757384390479', label: '신규2 (MNP전용)' },
];
const CAMPAIGN_LABELS: Record<string, string> = Object.fromEntries(
  CAMPAIGN_OPTIONS.map((c) => [c.value, c.label])
);
function campaignLabel(v?: string | null): string {
  if (!v) return '-';
  return CAMPAIGN_LABELS[v] ?? v;
}

function StatusBadge({ status, prospectGrade }: { status: ReservationStatus; prospectGrade?: string | null }) {
  const found = RESERVATION_STATUS_LIST.find((s) => s.value === status);
  const label = status === '가망' && prospectGrade ? prospectGrade : (found?.label ?? status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${found?.color ?? 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

export default function ReservationsPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { staff } = useDashboardStaff();
  const navigate = useNavigate();

  // 전체 데이터 (채널별 카운트용)
  const [allRows, setAllRows] = useState<Reservation[]>([]);
  // 필터된 표시 데이터
  const [rows, setRows] = useState<Reservation[]>([]);

  // 중복 전화번호 Set — 현재 페이지(rows)가 아니라 전체 데이터(allRows) 기준으로 잡아야
  // 상태/채널/페이지가 달라서 화면에 같이 안 보이는 중복도 놓치지 않고 잡힘 (v20260902)
  const duplicatePhones = useMemo(() => {
    const cnt: Record<string, number> = {};
    allRows.forEach((r: any) => { if (r.phone) cnt[r.phone] = (cnt[r.phone] || 0) + 1; });
    return new Set(Object.keys(cnt).filter(p => cnt[p] > 1));
  }, [allRows]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  // 필터 상태
  const [channelTab, setChannelTab] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('');
  const [gradeFilter, setGradeFilter] = useState<ProspectGrade | ''>('');
  const [absentFilter, setAbsentFilter] = useState<AbsentCount | 0>(0); // 부재 회차 필터 (v20260901) — 0=전체
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // 모달
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  };

  // 일괄 문자발송 처리
  const handleBulkSms = async (sent: boolean) => {
    if (selectedIds.size === 0) return;
    const label = sent ? '발송완료' : '미발송';
    if (!window.confirm(`선택한 ${selectedIds.size}건을 문자 ${label}으로 처리할까요?`)) return;
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ sms_sent: sent, sms_sent_at: sent ? new Date().toISOString() : null })
        .in('id', [...selectedIds]);
      if (error) throw error;
      toast.success(`${selectedIds.size}건 문자 ${label} 처리 완료`);
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      toast.error('처리 실패: ' + e.message);
    }
  };

  // 일괄 택배발송 처리
  const handleBulkCourier = async (sent: boolean) => {
    if (selectedIds.size === 0) return;
    const label = sent ? '발송완료' : '미발송';
    if (!window.confirm(`선택한 ${selectedIds.size}건을 택배 ${label}으로 처리할까요?`)) return;
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ courier_sent: sent, courier_sent_at: sent ? new Date().toISOString() : null })
        .in('id', [...selectedIds]);
      if (error) throw error;
      toast.success(`${selectedIds.size}건 택배 ${label} 처리 완료`);
      setSelectedIds(new Set());
      await load();
    } catch (e: any) {
      toast.error('처리 실패: ' + e.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}건을 삭제하시겠어요?`)) return;
    try {
      await Promise.all([...selectedIds].map(id => deleteReservation(id)));
      toast.success(`${selectedIds.size}건 삭제 완료`);
      setSelectedIds(new Set());
      setPage(1);
      await load();
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    }
  };

  const handleCSV = () => {
    const selected = rows.filter(r => selectedIds.has(r.id));
    const target = selected.length > 0 ? selected : rows;
    const header = ['#', '접수일', '고객명', '연락처', '생년월일', '통신사', '채널', '캠페인', '상태', '담당자', '관심기기', '메모', '택배발송', '송장번호'];
    const csvRows = target.map((r, i) => [
      i + 1,
      r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '',
      r.name,
      r.phone,
      r.birth_date ?? '',
      r.carrier ?? '',
      r.channel ?? '',
      campaignLabel((r as any).utm_campaign),
      r.status,
      (r as any).assignee?.full_name ?? '',
      (r as any).device_interest ?? '',
      r.memo ?? '',
      (r as any).courier_sent ? 'O' : 'X',
      (r as any).courier_tracking_number ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `사전예약_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // CSV 내보내기용 헤더/행 변환 (선택 export / 전체 export 공용)
  const toCsvRows = (target: typeof rows) => target.map((r, i) => [
    i + 1,
    r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '',
    r.name,
    r.phone,
    r.birth_date ?? '',
    r.carrier ?? '',
    r.channel ?? '',
    campaignLabel((r as any).utm_campaign),
    r.status,
    (r as any).assignee?.full_name ?? '',
    (r as any).device_interest ?? '',
    r.memo ?? '',
    (r as any).courier_sent ? 'O' : 'X',
    (r as any).courier_tracking_number ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const downloadCsvText = (rowsCsv: string[], filenameSuffix: string) => {
    const header = ['#', '접수일', '고객명', '연락처', '생년월일', '통신사', '채널', '캠페인', '상태', '담당자', '관심기기', '메모', '택배발송', '송장번호'];
    const csv = [header.join(','), ...rowsCsv].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `사전예약_${filenameSuffix}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // [CSV 전체] — 화면 페이지 크기(최대 200건)에 안 걸리게, 지금 걸린 필터 조건(상태/담당자/검색어/채널/기간) 그대로
  // 전체 건수를 끝까지 순회해서 한 번에 내려받는다.
  const [csvAllLoading, setCsvAllLoading] = useState(false);
  const handleCsvAll = async () => {
    setCsvAllLoading(true);
    try {
      const CHUNK = 1000;
      const all: typeof rows = [];
      for (let p = 1; ; p++) {
        const res = await fetchReservations({
          status: statusFilter || undefined,
          prospect_grade: (statusFilter === '가망' && gradeFilter) || undefined,
          absent_count: (statusFilter === '부재' && absentFilter) || undefined,
          assigned_to: assigneeFilter || undefined,
          search,
          page: p,
          pageSize: CHUNK,
          channel: channelTab || undefined,
          campaign: campaignFilter || undefined,
          dateStart: dateStart || undefined,
          dateEnd: dateEnd || undefined,
        } as any);
        all.push(...res.data);
        if (res.data.length < CHUNK || all.length >= res.count) break;
      }
      if (all.length === 0) return toast.error('내보낼 데이터가 없습니다');
      downloadCsvText(toCsvRows(all), '전체');
      toast.success(`${all.length}건 CSV 다운로드`);
    } catch (e: any) {
      toast.error('전체 CSV 내보내기 실패: ' + e.message);
    } finally {
      setCsvAllLoading(false);
    }
  };

  // 전체 데이터 로드 (채널별 카운트용)
  // 중복 전화번호 계산
  const getDuplicatePhones = (list: typeof rows) => {
    const phoneCnt: Record<string, number> = {};
    list.forEach(r => { if (r.phone) phoneCnt[r.phone] = (phoneCnt[r.phone] || 0) + 1; });
    return new Set(Object.entries(phoneCnt).filter(([,cnt]) => cnt > 1).map(([p]) => p));
  };

  // v20260903: 사전예약이 1000건을 넘어가면서(현재 1000건대) Supabase가 요청 1건당 최대 1000행만
  // 돌려주는 기본 제한에 걸려, 이 화면의 KPI 카드(상태별/부재 회차별/채널별 카운트)가 실제 DB
  // 건수보다 적게 표시되던 버그 수정. fetchAllPaged로 1000건씩 끝까지 순회해서 빠짐없이 가져온다.
  const loadAll = useCallback(async () => {
    try {
      const data = await fetchAllPaged<any>('id, status, channel, contact_date, prospect_grade, absent_count, phone');
      setAllRows(data);
    } catch (e: any) {
      toast.error('전체 데이터 로드 실패: ' + e.message);
    }
  }, []);

  // 필터 적용 데이터 로드
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchReservations({
        status: statusFilter || undefined,
        prospect_grade: (statusFilter === '가망' && gradeFilter) || undefined,
        absent_count: (statusFilter === '부재' && absentFilter) || undefined,
        assigned_to: assigneeFilter || undefined,
        search,
        page,
        pageSize,
        channel: channelTab || undefined,
        campaign: campaignFilter || undefined,
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
      } as any);
      setRows(res.data);
      setTotal(res.count);
    } catch (e: any) {
      toast.error('데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, gradeFilter, absentFilter, assigneeFilter, search, page, pageSize, channelTab, campaignFilter, dateStart, dateEnd]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { load(); }, [load]);
  // 가망이 아닌 상태로 바뀌면 등급 필터는 의미가 없으므로 초기화
  useEffect(() => { if (statusFilter !== '가망') setGradeFilter(''); }, [statusFilter]);
  useEffect(() => { if (statusFilter !== '부재') setAbsentFilter(0); }, [statusFilter]);

  // 채널별 카운트
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { '': allRows.length };
    CHANNEL_TABS.slice(1).forEach(tab => {
      counts[tab.value] = allRows.filter(r => (r as any).channel === tab.value).length;
    });
    return counts;
  }, [allRows]);

  // 테이블 인라인 즉시수정: 담당자
  async function updateAssignee(id: string, assigned_to: string | null) {
    const { error } = await supabase
      .from('reservations')
      .update({ assigned_to })
      .eq('id', id);
    if (error) { toast.error('담당자 변경 실패: ' + error.message); return; }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, assigned_to } : r)));
    toast.success('담당자가 변경되었습니다');
  }

  // 테이블 인라인 즉시수정: 상태 (실패/취소는 사유·단계 필수라 상세모달로 유도)
  // v20260803: 일반 상태 드롭다운으로 "택배발송"을 고르면(전용 토글 버튼 안 거치고)
  // courier_sent/courier_sent_at이 안 채워지던 버그 수정 — 어느 경로로 바꾸든 항상 같이 채워지게 함.
  async function updateStatusInline(id: string, status: ReservationStatus) {
    if (status === '실패' || status === '취소') {
      setDetailId(id);
      return;
    }
    const goingToShipped = status === '택배발송';
    // 부재로 바꾸면 회차는 기존값 유지(없으면 1회), 부재가 아니면 회차 초기화 (v20260901)
    const cur = rows.find((r) => r.id === id);
    const absent_count = status === '부재' ? ((cur as any)?.absent_count ?? 1) : null;
    const payload: Record<string, any> = {
      status, fail_reason_id: null, fail_stage: null, fail_memo: null, cancel_stage: null, absent_count,
      courier_sent: goingToShipped,
      courier_sent_at: goingToShipped ? new Date().toISOString() : null,
    };
    if (status === '확정') payload.confirmed_at = new Date().toISOString();
    const { error } = await supabase
      .from('reservations')
      .update(payload)
      .eq('id', id);
    if (error) { toast.error('상태 변경 실패: ' + error.message); return; }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, ...payload } as any : r)));
    toast.success('상태가 변경되었습니다');
  }

  // 테이블 인라인 즉시수정: 부재 회차 (v20260901)
  async function updateAbsentCountInline(id: string, absent_count: AbsentCount) {
    const { error } = await supabase.from('reservations').update({ absent_count }).eq('id', id);
    if (error) { toast.error('부재 회차 변경 실패: ' + error.message); return; }
    setRows((p) => p.map((r) => (r.id === id ? { ...r, absent_count } as any : r)));
    setAllRows((p) => p.map((r) => (r.id === id ? { ...r, absent_count } as any : r)));
    toast.success(`부재 ${absent_count}회로 변경`);
  }

  // 상태별 카운트 (현재 채널 탭 기준)
  const statusCounts = useMemo(() => {
    const filtered = channelTab ? allRows.filter(r => (r as any).channel === channelTab) : allRows;
    const counts: Record<string, number> = {};
    RESERVATION_STATUS_LIST.forEach(s => {
      counts[s.value] = filtered.filter(r => r.status === s.value).length;
    });
    return counts;
  }, [allRows, channelTab]);

  // 가망 등급별 카운트 (상/중/하, 현재 채널 탭 기준)
  const gradeCounts = useMemo(() => {
    const filtered = channelTab ? allRows.filter(r => (r as any).channel === channelTab) : allRows;
    const prospects = filtered.filter(r => r.status === '가망');
    const counts: Record<ProspectGrade | '미선택', number> = { 상: 0, 중: 0, 하: 0, 미선택: 0 };
    prospects.forEach(r => {
      const g = (r as any).prospect_grade as ProspectGrade | null;
      if (g === '상' || g === '중' || g === '하') counts[g]++;
      else counts['미선택']++;
    });
    return counts;
  }, [allRows, channelTab]);

  // 부재 회차별 카운트 (1/2/3회, 현재 채널 탭 기준) — v20260901
  const absentCounts = useMemo(() => {
    const filtered = channelTab ? allRows.filter(r => (r as any).channel === channelTab) : allRows;
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    filtered.filter(r => r.status === '부재').forEach(r => {
      const n = ((r as any).absent_count ?? 1) as number;
      counts[n] = (counts[n] ?? 0) + 1;
    });
    return counts;
  }, [allRows, channelTab]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleReset = () => {
    setSearch(''); setSearchInput(''); setStatusFilter(''); setGradeFilter(''); setAbsentFilter(0); setAssigneeFilter(''); setCampaignFilter('');
    setDateStart(''); setDateEnd(''); setPage(1);
  };
  const handleTabChange = (val: string) => {
    setChannelTab(val); setPage(1); setStatusFilter('');
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="사전예약 관리"
        description="갤럭시 Z 폴더블8 사전예약 고객을 채널별·단계별로 관리합니다"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/reservations/stats')} className="gap-1.5 text-gray-600">
              <BarChart2 className="size-4" /> 통계
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/reservations/response-time')} className="gap-1.5 text-orange-500 border-orange-200 hover:bg-orange-50">
              <Clock className="size-4" /> 응답시간
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleBulkSms(true)} className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
                  📨 문자발송 O ({selectedIds.size})
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkSms(false)} className="gap-1.5 text-gray-500 border-gray-200 hover:bg-gray-50">
                  문자발송 X ({selectedIds.size})
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkCourier(true)} className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                  📦 택배발송 O ({selectedIds.size})
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkCourier(false)} className="gap-1.5 text-gray-500 border-gray-200 hover:bg-gray-50">
                  택배발송 X ({selectedIds.size})
                </Button>
                {isAdmin && (
                <Button size="sm" variant="outline" onClick={handleCSV} className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
                  CSV ({selectedIds.size})
                </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleBulkDelete} className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50">
                  삭제 ({selectedIds.size})
                </Button>
              </>
            )}
            {isAdmin && (
            <Button size="sm" onClick={handleCsvAll} disabled={csvAllLoading} variant="outline" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
              {csvAllLoading ? '내보내는 중...' : 'CSV 전체'}
            </Button>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 bg-pink-500 hover:bg-pink-600 text-white">
              <Plus className="size-4" /> 신규 등록
            </Button>
          </div>
        }
      />

      {/* 채널별 탭 */}
      <div className="flex items-center gap-0 border-b border-gray-200">
        {CHANNEL_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              channelTab === tab.value
                ? 'border-pink-500 text-pink-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              channelTab === tab.value ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {channelCounts[tab.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* 상태별 KPI 카드 (유심 MNP도 여기 상태값으로 포함되어 있어 자동으로 카드 하나가 더 생깁니다) */}
      <div className="grid grid-cols-4 sm:grid-cols-9 gap-2">
        {RESERVATION_STATUS_LIST.map((s) => (
          <button
            key={s.value}
            onClick={() => { setStatusFilter(statusFilter === s.value ? '' : s.value); setPage(1); }}
            className={`rounded-xl border p-2.5 text-left transition-all hover:shadow-md bg-white ${
              statusFilter === s.value ? 'ring-2 ring-pink-400 shadow-md' : 'border-gray-100'
            }`}
          >
            <div className="text-[10px] text-gray-400 font-medium truncate">{s.label}</div>
            <div className="text-lg font-bold mt-0.5">{statusCounts[s.value] ?? 0}</div>
            {s.value === '부재' && (statusCounts['부재'] ?? 0) > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {ABSENT_COUNT_OPTIONS.map((n) => {
                  const active = absentFilter === n && statusFilter === '부재';
                  const isMax = n === ABSENT_MAX;
                  return (
                    <span
                      key={n}
                      title={isMax ? '부재 3회 건만 보기 (토글)' : `부재 ${n}회 건만 보기`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusFilter('부재');
                        setAbsentFilter(absentFilter === n ? 0 : n);
                        setPage(1);
                      }}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full cursor-pointer ${
                        active
                          ? isMax ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                          : isMax ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-700'
                      }`}
                    >
                      {n}회 {absentCounts[n] ?? 0}
                    </span>
                  );
                })}
              </div>
            )}
            {s.value === '가망' && (statusCounts['가망'] ?? 0) > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {PROSPECT_GRADE_OPTIONS.map((g) => (
                  <span
                    key={g}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusFilter('가망');
                      setGradeFilter(gradeFilter === g ? '' : g);
                      setPage(1);
                    }}
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      gradeFilter === g && statusFilter === '가망'
                        ? 'bg-amber-500 text-white'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {g} {gradeCounts[g]}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 검색 + 날짜 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          {/* 검색 */}
          <div className="flex gap-1.5 flex-1 min-w-[180px]">
            <Input
              placeholder="고객명 · 연락처 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleSearch}>
              <Search className="size-4" />
            </Button>
          </div>

          {/* 날짜 필터 */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateStart}
              onChange={e => { setDateStart(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
          </div>

          {/* 담당자 필터 */}
          <Select value={assigneeFilter || '_all_'} onValueChange={(v) => { setAssigneeFilter(v === '_all_' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[130px] text-sm">
              <SelectValue placeholder="전체 담당자" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 담당자</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>{s.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 캠페인 필터 (iphone18 기존1/신규2 MNP 구분용) */}
          <Select value={campaignFilter || '_all_'} onValueChange={(v) => { setCampaignFilter(v === '_all_' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[150px] text-sm">
              <SelectValue placeholder="전체 캠페인" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 캠페인</SelectItem>
              {CAMPAIGN_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 상태 필터 */}
          <Select value={statusFilter || '_all_'} onValueChange={(v) => { setStatusFilter((v === '_all_' ? '' : v) as ReservationStatus | ''); setPage(1); }}>
            <SelectTrigger className="w-[120px] text-sm">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 상태</SelectItem>
              {RESERVATION_STATUS_LIST.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 가망 등급 필터 (상태=가망일 때만 노출) */}
          {statusFilter === '가망' && (
            <Select value={gradeFilter || '_all_'} onValueChange={(v) => { setGradeFilter((v === '_all_' ? '' : v) as ProspectGrade | ''); setPage(1); }}>
              <SelectTrigger className="w-[110px] text-sm border-amber-200 text-amber-700">
                <SelectValue placeholder="전체 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">전체 등급</SelectItem>
                {PROSPECT_GRADE_OPTIONS.map((g) => (
                  <SelectItem key={g} value={g}>{g} ({gradeCounts[g]})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 부재 회차 필터 (상태=부재일 때만 노출) — v20260901 */}
          {statusFilter === '부재' && (
            <Select value={absentFilter ? String(absentFilter) : '_all_'} onValueChange={(v) => { setAbsentFilter((v === '_all_' ? 0 : Number(v)) as AbsentCount | 0); setPage(1); }}>
              <SelectTrigger className={`w-[120px] text-sm ${absentFilter === ABSENT_MAX ? 'border-red-200 text-red-600' : 'border-orange-200 text-orange-700'}`}>
                <SelectValue placeholder="전체 회차" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_">전체 회차</SelectItem>
                {ABSENT_COUNT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}회 ({absentCounts[n] ?? 0})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-gray-400">
            <X className="size-3.5" /> 초기화
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { loadAll(); load(); }} className="shrink-0">
            <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white cursor-pointer"
            >
              <option value={50}>50건씩</option>
              <option value={100}>100건씩</option>
              <option value={200}>200건씩</option>
            </select>
            <span className="text-xs text-gray-400">총 {total}건</span>
          </div>
        </div>
      </SectionCard>

      {/* 테이블 */}
      <SectionCard>
        <div className="overflow-auto max-h-[calc(100vh-300px)]">
          <Table className="[&_td]:py-2 [&_th]:py-2 min-w-[1300px]">
            <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[36px] text-center">
                  <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer accent-pink-500"
                    checked={rows.length > 0 && selectedIds.size === rows.length}
                    onChange={toggleAll} />
                </TableHead>
                <TableHead className="text-xs w-[36px]">#</TableHead>
                <TableHead className="text-xs w-[120px]">접수일</TableHead>
                <TableHead className="text-xs">고객명</TableHead>
                <TableHead className="text-xs">연락처</TableHead>
                <TableHead className="text-xs">생년월일</TableHead>
                <TableHead className="text-xs whitespace-nowrap">통신사</TableHead>
                <TableHead className="text-xs whitespace-nowrap">채널</TableHead>
                <TableHead className="text-xs whitespace-nowrap">캠페인</TableHead>
                <TableHead className="text-xs whitespace-nowrap">상태</TableHead>
                <TableHead className="text-xs whitespace-nowrap">담당자</TableHead>
                <TableHead className="text-xs">관심기기</TableHead>
                <TableHead className="text-xs w-[70px]">용량</TableHead>
                <TableHead className="text-xs w-[90px]">컬러</TableHead>
                <TableHead className="text-xs">메모</TableHead>
                <TableHead className="text-xs w-[80px] text-center">문자발송</TableHead>
                <TableHead className="text-xs w-[130px] text-center">택배발송 · 송장번호</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-sm text-gray-400">로딩 중...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-sm text-gray-400">데이터가 없습니다</TableCell>
                </TableRow>
              ) : (
                rows.map((r, idx) => (
                  <TableRow key={r.id} className={`cursor-pointer hover:bg-pink-50/50 transition-colors ${selectedIds.has(r.id) ? 'bg-pink-50' : ''}`} onClick={() => setDetailId(r.id)}>
                    <TableCell className="text-xs text-center" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" className="w-3.5 h-3.5 cursor-pointer accent-pink-500"
                        checked={selectedIds.has(r.id)}
                        onChange={() => {}}
                        onClick={(e) => toggleSelect(r.id, e)} />
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{(page - 1) * pageSize + idx + 1}</TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                      {r.contact_date ? (
                          <span>
                            <span className="block">{new Date(r.contact_date).toLocaleDateString('ko-KR')}</span>
                            <span className="text-gray-400 text-[11px]">{new Date(r.contact_date).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{maskName(r.name)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <span className={duplicatePhones.has(r.phone) ? "text-red-500 font-bold" : ""}>
                        {maskPhone(r.phone)}
                      </span>
                      {duplicatePhones.has(r.phone) && (
                        <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">중복</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{(r as any).birth_date ?? '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">{r.carrier ?? '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                      {r.channel ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${ r.channel === '메타광고' ? 'bg-blue-100 text-blue-700' : r.channel === '네이버 검색광고' ? 'bg-green-100 text-green-700' : r.channel === '기존고객' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{r.channel}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 whitespace-nowrap">{campaignLabel((r as any).utm_campaign)}</TableCell>
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Select value={r.status} onValueChange={(v) => updateStatusInline(r.id, v as ReservationStatus)}>
                        <SelectTrigger className={`h-7 text-[11px] w-[132px] border-none font-semibold rounded-full px-2.5 ${RESERVATION_STATUS_LIST.find(s => s.value === r.status)?.color ?? 'bg-gray-100 text-gray-600'}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESERVATION_STATUS_LIST.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {r.status === '가망' && (r as any).prospect_grade && (
                        <div className="text-[10px] text-amber-500 mt-0.5 pl-1">{(r as any).prospect_grade} 등급</div>
                      )}
                      {r.status === '부재' && (
                        <Select value={String((r as any).absent_count ?? 1)} onValueChange={(v) => updateAbsentCountInline(r.id, Number(v) as AbsentCount)}>
                          <SelectTrigger className={`h-5 mt-1 text-[10px] w-[74px] border-none rounded-full px-2 font-semibold ${
                            ((r as any).absent_count ?? 1) === ABSENT_MAX ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-orange-600'
                          }`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ABSENT_COUNT_OPTIONS.map((n) => (
                              <SelectItem key={n} value={String(n)}>부재 {n}회</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {r.status === '실패' && r.fail_reason && (
                        <div className="text-[10px] text-red-400 mt-0.5 pl-1">{r.fail_reason.reason}</div>
                      )}
                      {r.status === '취소' && (r as any).cancel_stage && (
                        <div className="text-[10px] text-gray-400 mt-0.5 pl-1">{(r as any).cancel_stage} 단계에서 취소</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Select value={r.assigned_to ?? '_none_'} onValueChange={(v) => updateAssignee(r.id, v === '_none_' ? null : v)}>
                        <SelectTrigger className="h-7 text-xs w-[100px]">
                          <SelectValue placeholder="담당자 지정" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none_">미지정</SelectItem>
                          {staff.map((st) => (
                            <SelectItem key={st.user_id} value={st.user_id}>{st.display_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-blue-600 font-medium whitespace-nowrap">{(r as any).device_interest ?? '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500 text-center">{(r as any).capacity ?? '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500 text-center whitespace-nowrap">{(r as any).product_color ?? '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[220px]" title={r.memo ?? ''}>
                      <span className="line-clamp-2 whitespace-normal break-all leading-snug">{r.memo ?? '-'}</span>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={async () => {
                          const newVal = !(r as any).sms_sent;
                          const { error } = await supabase
                            .from('reservations')
                            .update({ sms_sent: newVal, sms_sent_at: newVal ? new Date().toISOString() : null })
                            .eq('id', r.id);
                          if (!error) {
                            toast.success(newVal ? '문자 발송 완료 처리' : '발송 취소 처리');
                            await load();
                          } else {
                            toast.error('처리 실패');
                          }
                        }}
                        className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                          (r as any).sms_sent
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={(r as any).sms_sent_at ? `발송: ${new Date((r as any).sms_sent_at).toLocaleString('ko-KR')}` : '미발송'}
                      >
                        {(r as any).sms_sent ? 'O' : 'X'}
                      </button>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center gap-1">
                        {(() => {
                          const status = (r as any).status as string;
                          const shipped = status === '택배발송';
                          const canToggle = status === '확정' || shipped;
                          return (
                            <button
                              disabled={!canToggle}
                              onClick={async () => {
                                if (!canToggle) return;
                                const goingToShipped = !shipped;
                                const { error } = await supabase
                                  .from('reservations')
                                  .update({
                                    status: goingToShipped ? '택배발송' : '확정',
                                    courier_sent: goingToShipped,
                                    courier_sent_at: goingToShipped ? new Date().toISOString() : null,
                                  })
                                  .eq('id', r.id);
                                if (!error) {
                                  toast.success(goingToShipped ? '택배발송 완료 처리' : '확정으로 되돌림');
                                  await load();
                                } else {
                                  toast.error('처리 실패');
                                }
                              }}
                              title={
                                !canToggle
                                  ? '확정 상태에서만 처리할 수 있습니다'
                                  : shipped
                                  ? ((r as any).courier_sent_at ? `발송: ${new Date((r as any).courier_sent_at).toLocaleString('ko-KR')} (다시 누르면 확정으로 되돌림)` : '다시 누르면 확정으로 되돌림')
                                  : '누르면 택배발송 완료로 전환'
                              }
                              className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${
                                !canToggle
                                  ? 'bg-gray-50 text-gray-200 cursor-not-allowed'
                                  : shipped
                                  ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                            >
                              {shipped ? 'O' : 'X'}
                            </button>
                          );
                        })()}
                        <input
                          key={`${r.id}-tracking`}
                          type="text"
                          defaultValue={(r as any).courier_tracking_number ?? ''}
                          placeholder="송장번호"
                          onBlur={async (e) => {
                            const v = e.target.value.trim();
                            if (v === ((r as any).courier_tracking_number ?? '')) return;
                            const { error } = await supabase
                              .from('reservations')
                              .update({ courier_tracking_number: v || null })
                              .eq('id', r.id);
                            if (!error) {
                              toast.success('송장번호 저장');
                            } else {
                              toast.error('저장 실패');
                            }
                          }}
                          className="w-[100px] text-[10px] text-center border border-gray-200 rounded px-1 py-0.5 bg-gray-50/60 focus:border-indigo-300 focus:bg-white outline-none"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>이전</Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>다음</Button>
          </div>
        )}
      </SectionCard>

      {addOpen && (
        <ReservationAddModal open={addOpen} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); loadAll(); load(); }} />
      )}
      {detailId && (
        <ReservationDetailModal reservationId={detailId} onClose={() => setDetailId(null)} onDone={() => { setDetailId(null); loadAll(); load(); }} />
      )}
    </div>
  );
}
