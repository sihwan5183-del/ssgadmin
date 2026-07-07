// ============================================================
// CRM 접수 — 수기 인입 관리 페이지
// source = 'crm' 으로 leads 테이블에 저장
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, RotateCw, Download, X } from 'lucide-react';
import { toast } from 'sonner';
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
import { useDashboardStaff } from '@/hooks/useDashboardStaff';
import { WorkReportHeader, SectionCard } from '@/pages/work-report/_shared';
import { formatPhone } from '@/lib/phoneFormat';
import { CrmAddModal } from './CrmAddModal';
import { CrmDetailModal } from './CrmDetailModal';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = ['신규 접수','부재','재케어','성공','실패','개통완료'];
const STATUS_COLORS: Record<string, string> = {
  '신규 접수': 'bg-blue-100 text-blue-700',
  '부재':      'bg-orange-100 text-orange-700',
  '재케어':    'bg-purple-100 text-purple-700',
  '성공':      'bg-emerald-100 text-emerald-700',
  '실패':      'bg-red-100 text-red-700',
  '개통완료':  'bg-indigo-100 text-indigo-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export default function CrmIntakePage() {
  const { user } = useAuth();
  const { staff } = useDashboardStaff();

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('source', 'crm')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (statusFilter) query = query.eq('status', statusFilter);
      if (dateStart) query = query.gte('created_at', dateStart);
      if (dateEnd) query = query.lte('created_at', dateEnd + 'T23:59:59');
      if (search) query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);

      const { data, error, count } = await query;
      if (error) throw error;
      setRows(data ?? []);
      setTotal(count ?? 0);
    } catch (e: any) {
      toast.error('로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateStart, dateEnd, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleReset = () => {
    setSearch(''); setSearchInput(''); setStatusFilter('');
    setDateStart(''); setDateEnd(''); setPage(1);
  };

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="CRM 접수"
        description="수기 인입 고객을 등록하고 단계별로 관리합니다"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)}
              className="gap-1.5 bg-pink-500 hover:bg-pink-600 text-white">
              <Plus className="size-4" /> 신규 등록
            </Button>
          </div>
        }
      />

      {/* 상태별 KPI */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {STATUS_OPTIONS.map(s => (
          <button key={s}
            onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1); }}
            className={`rounded-xl border p-2.5 text-left bg-white hover:shadow-md transition-all ${statusFilter === s ? 'ring-2 ring-pink-400 shadow-md' : 'border-gray-100'}`}>
            <div className="text-[10px] text-gray-400 font-medium truncate">{s}</div>
            <div className="text-lg font-bold mt-0.5">{statusCounts[s] ?? 0}</div>
          </button>
        ))}
      </div>

      {/* 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 flex-1 min-w-[180px]">
            <Input placeholder="고객명 · 연락처 검색" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="text-sm" />
            <Button variant="outline" size="sm" onClick={handleSearch}>
              <Search className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateStart}
              onChange={e => { setDateStart(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
            <span className="text-xs text-gray-400">~</span>
            <input type="date" value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
          </div>
          <Select value={statusFilter || '_all_'}
            onValueChange={v => { setStatusFilter(v === '_all_' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[120px] text-sm">
              <SelectValue placeholder="전체 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all_">전체 상태</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1 text-gray-400">
            <X className="size-3.5" /> 초기화
          </Button>
          <Button variant="ghost" size="icon" onClick={load}>
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
                <TableHead className="text-xs w-[36px]">#</TableHead>
                <TableHead className="text-xs">접수일시</TableHead>
                <TableHead className="text-xs">고객명</TableHead>
                <TableHead className="text-xs">생년월일</TableHead>
                <TableHead className="text-xs">연락처</TableHead>
                <TableHead className="text-xs">통신사</TableHead>
                <TableHead className="text-xs">지부</TableHead>
                <TableHead className="text-xs">매장</TableHead>
                <TableHead className="text-xs">문의상품</TableHead>
                <TableHead className="text-xs">상태</TableHead>
                <TableHead className="text-xs">담당자</TableHead>
                <TableHead className="text-xs">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-sm text-gray-400">로딩 중...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-12 text-sm text-gray-400">데이터가 없습니다</TableCell></TableRow>
              ) : rows.map((r, idx) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-pink-50/50 transition-colors"
                  onClick={() => setDetailId(r.id)}>
                  <TableCell className="text-xs text-gray-400">{(page-1)*PAGE_SIZE+idx+1}</TableCell>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                    {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-'}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{r.customer_name ?? r.name ?? '-'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{(r as any).birth ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600">{formatPhone(r.customer_phone ?? r.phone ?? '')}</TableCell>
                  <TableCell className="text-sm text-gray-600">{r.current_carrier ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600">{(r as any).crm_group ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600">{(r as any).crm_branch ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[120px] truncate">{r.desired_product ?? '-'}</TableCell>
                  <TableCell><StatusBadge status={r.status ?? '신규 접수'} /></TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {r.assigned_to ? (staff.find(s => s.user_id === r.assigned_to)?.display_name ?? '-') : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[140px] truncate">{r.memo ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>이전</Button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p+1)}>다음</Button>
          </div>
        )}
      </SectionCard>

      {addOpen && (
        <CrmAddModal open={addOpen} onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); load(); }} />
      )}
      {detailId && (
        <CrmDetailModal leadId={detailId} onClose={() => setDetailId(null)}
          onDone={() => { setDetailId(null); load(); }} />
      )}
    </div>
  );
}
