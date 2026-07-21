// ============================================================
// CRM 접수 — 목록 페이지 (체크박스 선택 + CSV + 삭제)
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, RotateCw, X, Download, Trash2 } from 'lucide-react';
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
import { useRole } from '@/hooks/useRole';
import { maskName, maskPhone } from '@/lib/maskPii';
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

// CSV 다운로드
function downloadCSV(rows: any[], staff: any[]) {
  const headers = ['접수일시','고객명','생년월일','연락처','통신사','지부','매장','문의상품','제품명','용량','컬러','혜택','상태','담당자','문의내용','주소','메모'];
  const getStaffName = (id: string) => staff.find(s => s.user_id === id)?.display_name ?? '';
  const csvRows = rows.map(r => [
    r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '',
    r.customer_name ?? r.name ?? '',
    (r as any).birth ?? '',
    r.customer_phone ?? r.phone ?? '',
    r.current_carrier ?? '',
    (r as any).crm_group ?? '',
    (r as any).crm_branch ?? '',
    r.desired_product ?? '',
    (r as any).model_name ?? '',
    r.desired_device ?? '',
    (r as any).product_color ?? '',
    (r as any).product_benefit ?? '',
    r.status ?? '',
    r.assigned_to ? getStaffName(r.assigned_to) : '',
    (r as any).inquiry_content ?? '',
    (r as any).address ?? '',
    r.memo ?? '',
  ]);
  const bom = '\uFEFF';
  const csv = bom + [headers, ...csvRows].map(row =>
    row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CRM접수_${new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CrmIntakePage() {
  const { user } = useAuth();
  const { staff } = useDashboardStaff();
  const { isAdmin } = useRole();

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState(''); // 전체/오늘/이번주/이번달
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // 체크박스 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // 기간 필터 → dateStart/dateEnd 자동 계산
  const applyPeriod = (period: string) => {
    setPeriodFilter(period);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'today') {
      setDateStart(today.toISOString().slice(0, 10));
      setDateEnd(today.toISOString().slice(0, 10));
    } else if (period === 'week') {
      const day = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      setDateStart(mon.toISOString().slice(0, 10));
      setDateEnd(today.toISOString().slice(0, 10));
    } else if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateStart(start.toISOString().slice(0, 10));
      setDateEnd(today.toISOString().slice(0, 10));
    } else {
      setDateStart('');
      setDateEnd('');
    }
    setPage(1);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('leads').select('*', { count: 'exact' })
        .eq('source', 'crm').is('deleted_at', null)
        .order('created_at', { ascending: false }).range(from, to);
      if (statusFilter) query = query.eq('status', statusFilter);
      if (dateStart) query = query.gte('created_at', dateStart);
      if (dateEnd) query = query.lte('created_at', dateEnd + 'T23:59:59');
      if (search) query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      setRows(data ?? []);
      setTotal(count ?? 0);
      setSelected(new Set()); // 페이지 바뀌면 선택 초기화
    } catch (e: any) { toast.error('로드 실패: ' + e.message); }
    finally { setLoading(false); }
  }, [page, statusFilter, dateStart, dateEnd, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  // 전체 선택/해제
  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map(r => r.id)));
  };
  const toggleOne = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  // 선택 삭제
  const handleDelete = async () => {
    try {
      const ids = [...selected];
      const { error } = await supabase.from('leads')
        .update({ deleted_at: new Date().toISOString() } as any)
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length}건 삭제되었습니다`);
      setSelected(new Set());
      setConfirmDelete(false);
      load();
    } catch (e: any) { toast.error('삭제 실패: ' + e.message); }
  };

  // CSV 다운로드 (선택된 것만 or 전체)
  const handleCSV = () => {
    if (!isAdmin) { toast.error('CSV 다운로드는 관리자만 가능합니다'); return; }
    const target = selected.size > 0 ? rows.filter(r => selected.has(r.id)) : rows;
    if (target.length === 0) { toast.error('다운로드할 데이터가 없습니다'); return; }
    downloadCSV(target, staff);
    toast.success(`${target.length}건 CSV 다운로드`);
  };

  const handleSearch = () => { setSearch(searchInput); setPage(1); };
  const handleReset = () => {
    setSearch(''); setSearchInput(''); setStatusFilter('');
    setDateStart(''); setDateEnd(''); setPeriodFilter(''); setPage(1);
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="CRM 접수"
        description="수기 인입 고객을 등록하고 단계별로 관리합니다"
        rightSlot={
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-xs text-gray-500">{selected.size}건 선택됨</span>
                <Button variant="outline" size="sm" onClick={handleCSV} className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  <Download className="size-4" /> CSV
                </Button>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50">
                    <Trash2 className="size-4" /> 삭제
                  </Button>
                )}
              </>
            )}
            {selected.size === 0 && (
              <Button variant="outline" size="sm" onClick={handleCSV} className="gap-1.5 text-gray-600">
                <Download className="size-4" /> CSV 전체
              </Button>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 bg-pink-500 hover:bg-pink-600 text-white">
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
          {/* 기간 빠른 선택 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
            {[
              { key: '', label: '전체' },
              { key: 'today', label: '오늘' },
              { key: 'week', label: '이번주' },
              { key: 'month', label: '이번달' },
            ].map(btn => (
              <button key={btn.key}
                onClick={() => applyPeriod(btn.key)}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  periodFilter === btn.key
                    ? 'bg-white text-pink-600 shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {btn.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-1 min-w-[180px]">
            <Input placeholder="고객명 · 연락처 검색" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()} className="text-sm" />
            <Button variant="outline" size="sm" onClick={handleSearch}><Search className="size-4" /></Button>
          </div>
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
            <span className="text-xs text-gray-400">~</span>
            <input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
          </div>
          <Select value={statusFilter || '_all_'} onValueChange={v => { setStatusFilter(v === '_all_' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[120px] text-sm"><SelectValue placeholder="전체 상태" /></SelectTrigger>
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
                <TableHead className="w-[36px]">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-gray-300 cursor-pointer" />
                </TableHead>
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
                <TableHead className="text-xs">혜택</TableHead>
                <TableHead className="text-xs">메모</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={14} className="text-center py-12 text-sm text-gray-400">로딩 중...</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={14} className="text-center py-12 text-sm text-gray-400">데이터가 없습니다</TableCell></TableRow>
              ) : rows.map((r, idx) => (
                <TableRow key={r.id}
                  className={`cursor-pointer hover:bg-pink-50/50 transition-colors ${selected.has(r.id) ? 'bg-pink-50' : ''}`}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)}
                      className="rounded border-gray-300 cursor-pointer" />
                  </TableCell>
                  <TableCell className="text-xs text-gray-400" onClick={() => setDetailId(r.id)}>{(page-1)*PAGE_SIZE+idx+1}</TableCell>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap" onClick={() => setDetailId(r.id)}>
                    {r.created_at ? new Date(r.created_at).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-'}
                  </TableCell>
                  <TableCell className="text-sm font-medium" onClick={() => setDetailId(r.id)}>{maskName(r.customer_name ?? r.name) || '-'}</TableCell>
                  <TableCell className="text-xs text-gray-500" onClick={() => setDetailId(r.id)}>{(r as any).birth ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600" onClick={() => setDetailId(r.id)}>{maskPhone(r.customer_phone ?? r.phone)}</TableCell>
                  <TableCell className="text-sm text-gray-600" onClick={() => setDetailId(r.id)}>{r.current_carrier ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600" onClick={() => setDetailId(r.id)}>{(r as any).crm_group ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600" onClick={() => setDetailId(r.id)}>{(r as any).crm_branch ?? '-'}</TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[100px] truncate" onClick={() => setDetailId(r.id)}>{r.desired_product ?? '-'}</TableCell>
                  <TableCell onClick={() => setDetailId(r.id)}><StatusBadge status={r.status ?? '신규 접수'} /></TableCell>
                  <TableCell className="text-sm text-gray-600" onClick={() => setDetailId(r.id)}>
                    {r.assigned_to ? (staff.find(s => s.user_id === r.assigned_to)?.display_name ?? '-') : '-'}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-pink-600 max-w-[150px] truncate" onClick={() => setDetailId(r.id)}>{(r as any).product_benefit ?? '-'}</TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[140px] truncate" onClick={() => setDetailId(r.id)}>{r.memo ?? '-'}</TableCell>
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

      {addOpen && <CrmAddModal open={addOpen} onClose={() => setAddOpen(false)} onDone={() => { setAddOpen(false); load(); }} />}
      {detailId && <CrmDetailModal leadId={detailId} onClose={() => setDetailId(null)} onDone={() => { setDetailId(null); load(); }} />}

      {/* 삭제 확인 모달 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-sm mb-2">⚠️ {selected.size}건 삭제</div>
            <div className="text-xs text-gray-500 mb-4">선택한 데이터를 삭제합니다. 복구할 수 없습니다.</div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>취소</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={handleDelete}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

