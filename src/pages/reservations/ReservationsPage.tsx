// ============================================================
// 사전예약 관리 — 목록 메인 페이지
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RotateCw, BarChart2 } from 'lucide-react';
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
import { WorkReportHeader, SectionCard } from '@/pages/work-report/_shared';
import {
  fetchReservations,
  fetchReservationStats,
} from '@/services/reservationService';
import type { Reservation, ReservationStatus } from '@/types/reservation';
import { RESERVATION_STATUS_LIST } from '@/types/reservation';
import { ReservationAddModal } from './ReservationAddModal';
import { ReservationDetailModal } from './ReservationDetailModal';
import { formatPhone } from '@/lib/phoneFormat';

const PAGE_SIZE = 50;

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
  const navigate = useNavigate();

  const [rows, setRows] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | ''>('');

  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, s] = await Promise.all([
        fetchReservations({ status: statusFilter || undefined, search, page, pageSize: PAGE_SIZE }),
        fetchReservationStats(),
      ]);
      setRows(res.data);
      setTotal(res.count);
      setStats(s);
    } catch (e: any) {
      toast.error('데이터 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="사전예약 관리"
        description="갤럭시 Z 폴더블8 사전예약 고객을 단계별로 관리합니다"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/reservations/stats')}
              className="gap-1.5 text-gray-600"
            >
              <BarChart2 className="size-4" /> 통계
            </Button>
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-1.5 bg-pink-500 hover:bg-pink-600 text-white"
            >
              <Plus className="size-4" /> 신규 등록
            </Button>
          </div>
        }
      />

      {/* KPI 요약 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {RESERVATION_STATUS_LIST.map((s) => (
            <button
              key={s.value}
              onClick={() => { setStatusFilter(s.value); setPage(1); }}
              className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${
                statusFilter === s.value ? 'ring-2 ring-pink-400 shadow-md' : ''
              } ${s.color.replace('text-', 'border-').split(' ')[0]} bg-white`}
            >
              <div className="text-[10px] text-gray-500 font-medium">{s.label}</div>
              <div className="text-xl font-bold mt-0.5">{stats.byStatus[s.value] ?? 0}</div>
            </button>
          ))}
        </div>
      )}

      {/* 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] flex gap-2">
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
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ReservationStatus | ''); setPage(1); }}>
            <SelectTrigger className="w-[130px] text-sm">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체 상태</SelectItem>
              {RESERVATION_STATUS_LIST.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setSearchInput(''); setStatusFilter(''); setPage(1); }}>
            초기화
          </Button>
          <Button variant="ghost" size="icon" onClick={load} className="shrink-0">
            <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <span className="text-xs text-gray-400 ml-auto">총 {total}건</span>
        </div>
      </SectionCard>

      {/* 테이블 */}
      <SectionCard>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="text-xs w-[40px]">#</TableHead>
                <TableHead className="text-xs">고객명</TableHead>
                <TableHead className="text-xs">연락처</TableHead>
                <TableHead className="text-xs">통신사</TableHead>
                <TableHead className="text-xs">채널</TableHead>
                <TableHead className="text-xs">관심기기</TableHead>
                <TableHead className="text-xs">상태</TableHead>
                <TableHead className="text-xs">담당자</TableHead>
                <TableHead className="text-xs">인입일</TableHead>
                <TableHead className="text-xs">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-sm text-gray-400">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-sm text-gray-400">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r, idx) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-pink-50/50 transition-colors"
                    onClick={() => setDetailId(r.id)}
                  >
                    <TableCell className="text-xs text-gray-400">{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm text-gray-600">{formatPhone(r.phone)}</TableCell>
                    <TableCell className="text-sm text-gray-600">{r.carrier ?? '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">{r.channel ?? '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600">{r.device_interest ?? '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {(r.status === '상담실패') && r.fail_reason && (
                        <div className="text-[10px] text-red-400 mt-0.5">{r.fail_reason.reason}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {(r.assignee as any)?.full_name ?? (r.assignee as any)?.email ?? '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">
                      {r.contact_date ? new Date(r.contact_date).toLocaleDateString('ko-KR') : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 max-w-[160px] truncate">
                      {r.memo ?? '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</Button>
          </div>
        )}
      </SectionCard>

      {/* 모달 */}
      {addOpen && (
        <ReservationAddModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); load(); }}
        />
      )}
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

