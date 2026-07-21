// ============================================================
// 사전예약 관리 — 목록 메인 페이지
// 채널별 탭 + 날짜 필터 + 상태 필터
// ============================================================
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
import { fetchReservations, deleteReservation } from '@/services/reservationService';
import type { Reservation, ReservationStatus } from '@/types/reservation';
import { RESERVATION_STATUS_LIST } from '@/types/reservation';
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

function StatusBadge({ status }: { status: ReservationStatus }) {
  const found = RESERVATION_STATUS_LIST.find((s) => s.value === status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${found?.color ?? 'bg-gray-100 text-gray-600'}`}>
      {found?.label ?? status}
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

  // 중복 전화번호 Set
  const duplicatePhones = useMemo(() => {
    const cnt: Record<string, number> = {};
    rows.forEach(r => { if (r.phone) cnt[r.phone] = (cnt[r.phone] || 0) + 1; });
    return new Set(Object.keys(cnt).filter(p => cnt[p] > 1));
  }, [rows]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  // 필터 상태
  const [channelTab, setChannelTab] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('');
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
    const header = ['#', '접수일', '고객명', '연락처', '생년월일', '통신사', '채널', '상태', '담당자', '관심기기', '메모'];
    const csvRows = target.map((r, i) => [
      i + 1,
      r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '',
      r.name,
      r.phone,
      r.birth_date ?? '',
      r.carrier ?? '',
      r.channel ?? '',
      r.status,
      (r as any).assignee?.full_name ?? '',
      (r as any).device_interest ?? '',
      r.memo ?? ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `사전예약_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // 전체 데이터 로드 (채널별 카운트용)
  // 중복 전화번호 계산
  const getDuplicatePhones = (list: typeof rows) => {
    const phoneCnt: Record<string, number> = {};
    list.forEach(r => { if (r.phone) phoneCnt[r.phone] = (phoneCnt[r.phone] || 0) + 1; });
    return new Set(Object.entries(phoneCnt).filter(([,cnt]) => cnt > 1).map(([p]) => p));
  };

  const loadAll = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('id, status, channel, contact_date');
    setAllRows((data ?? []) as any[]);
  }, []);

  // 필터 적용 데이터 로드
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchReservations({
        status: statusFilter || undefined,
        assigned_to: assigneeFilter || undefined,
        search,
        page,
        pageSize,
        channel: channelTab || undefined,
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
  }, [statusFilter, assigneeFilter, search, page, pageSize, channelTab, dateStart, dateEnd]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { load(); }, [load]);

  // 채널별 카운트
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = { '': allRows.length };
    CHANNEL_TABS.slice(1).forEach(tab => {
      counts[tab.value] = allRows.filter(r => (r as any).channel === tab.value).length;
    });
    return counts;
  }, [allRows]);

  // 상태별 카운트 (현재 채널 탭 기준)
  const statusCounts = useMemo(() => {
    const filtered = channelTab ? allRows.filter(r => (r as any).channel === channelTab) : allRows;
    const counts: Record<string, number> = {};
    RESERVATION_STATUS_LIST.forEach(s => {
      counts[s.value] = filtered.filter(r => r.status === s.value).length;
    });
    return counts;
  }, [allRows, channelTab]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleReset = () => {
    setSearch(''); setSearchInput(''); setStatusFilter(''); setAssigneeFilter('');
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
            <Button size="sm" onClick={handleCSV} variant="outline" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50">
              CSV 전체
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

      {/* 상태별 KPI 카드 */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
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
          <Table className="[&_td]:py-2 [&_th]:py-2">
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
                <TableHead className="text-xs">통신사</TableHead>
                <TableHead className="text-xs">채널</TableHead>
                <TableHead className="text-xs">상태</TableHead>
                <TableHead className="text-xs">담당자</TableHead>
                <TableHead className="text-xs">관심기기</TableHead>
                <TableHead className="text-xs w-[70px]">용량</TableHead>
                <TableHead className="text-xs">메모</TableHead>
                <TableHead className="text-xs w-[80px] text-center">문자발송</TableHead>
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
                    <TableCell className="text-sm text-gray-600">{r.carrier ?? '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.channel ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ r.channel === '메타광고' ? 'bg-blue-100 text-blue-700' : r.channel === '네이버 검색광고' ? 'bg-green-100 text-green-700' : r.channel === '기존고객' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{r.channel}</span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {r.status === '상담실패' && r.fail_reason && (
                        <div className="text-[10px] text-red-400 mt-0.5">{r.fail_reason.reason}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.assigned_to ? (staff.find(s => s.user_id === r.assigned_to)?.display_name ?? '-') : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-blue-600 font-medium whitespace-nowrap">{(r as any).device_interest ?? '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500 text-center">{(r as any).capacity ?? '-'}</TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[220px]" title={r.memo ?? ''}>
                      <span className="line-clamp-2 whitespace-normal break-all leading-snug">{r.memo ?? '-'}</span>
                    </TableCell>
                    <TableCell className="text-center">
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
