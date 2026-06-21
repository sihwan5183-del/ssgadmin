// ============================================================
// LogDetailModal — 숫자 클릭 시 상세 로그 팝업
// activity_logs 기반 / 고객명 마스킹 / 전화번호 미노출
// ============================================================
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ACTION_TYPE_LABEL, type ActivityActionType } from '@/types/workReport';
import { maskCustomerName } from '@/services/workReport/reportFormatService';
import { cancelActivityLog } from '@/services/workReport/activityLogService';
import { getKstDateRangeUtc } from '@/services/workReport/dateUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { toast } from 'sonner';
import { resolveStaffDisplayNames } from '@/services/workReport/staffDisplayService';
import { WRBadge } from './_shared';

const CHANNEL_LABEL: Record<string, string> = {
  meta: '메타', dogmaru: '도그마루', udak: '유닥', moyo: '모요', other: '기타인입',
};

export interface LogDetailFilter {
  title: string;                          // 모달 제목
  dateFrom: string;
  dateTo: string;
  actionTypes?: ActivityActionType[];     // action_type 필터 (없으면 전체)
  staffId?: string;                       // 특정 담당자 필터
  sourceType?: 'activity' | 'leads' | 'sales';  // activity_logs vs leads vs sales
  statusFilter?: string[];               // leads용 status 필터
}

interface DetailRow {
  id: string;
  created_at: string;
  staff_name: string;
  resolved_name?: string;
  customer_name: string | null;
  channel: string | null;
  action_type: string;
  previous_status: string | null;
  next_status: string | null;
  memo: string | null;
  fail_reason: string | null;
  is_counted: boolean;
  not_counted_reason: string | null;
}

interface SalesRow {
  id: string;
  open_date: string | null;
  manager: string | null;
  customer_name: string | null;
  product: string | null;
  status: string | null;
  channel: string | null;
}

interface LeadsRow {
  id: string;
  created_at: string;
  customer_name: string | null;
  channel: string | null;
  campaign_name: string | null;
  status: string;
  assigned_name: string;
}

export function LogDetailModal({
  filter,
  onClose,
  onDone,
}: {
  filter: LogDetailFilter;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const { isAdmin, isManager } = useRole();
  const canExclude = isAdmin || isManager;
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [leadsRows, setLeadsRows] = useState<LeadsRow[]>([]);
  const [salesRows, setSalesRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 제외 예정 목록 (저장 전 로컬 상태)
  const [pendingExcludes, setPendingExcludes] = useState<Map<string, '실수' | '중복'>>(new Map());

  const handleExclude = (logId: string, reason: '실수' | '중복') => {
    setPendingExcludes((prev) => {
      const next = new Map(prev);
      if (next.get(logId) === reason) {
        next.delete(logId); // 같은 버튼 다시 누르면 취소
      } else {
        next.set(logId, reason);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user || pendingExcludes.size === 0) return;
    setSaving(true);
    try {
      for (const [logId, reason] of pendingExcludes.entries()) {
        await cancelActivityLog({ logId, reason, cancelledBy: user.id });
      }
      const excluded = new Map(pendingExcludes); // 저장 전 복사
      toast.success(`${excluded.size}건이 집계에서 제외되었습니다.`);
      // 로컬 반영 (복사본 사용)
      setRows((prev) => prev.map((r) =>
        excluded.has(r.id)
          ? { ...r, is_counted: false, not_counted_reason: excluded.get(r.id) ?? '' }
          : r
      ));
      setPendingExcludes(new Map()); // 마지막에 초기화
      onDone?.();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (filter.sourceType === 'leads') {
          // 신규접수/미처리 → leads 테이블
          let q = supabase
            .from('leads')
            .select('id, created_at, customer_name, channel, campaign_name, status, assigned_to, profiles!left(display_name)')
            .gte('created_at', (() => { const {start} = getKstDateRangeUtc(filter.dateFrom, filter.dateTo); return start; })())
            .lte('created_at', (() => { const {end} = getKstDateRangeUtc(filter.dateFrom, filter.dateTo); return end; })())
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

          if (filter.statusFilter && filter.statusFilter.length > 0) {
            q = q.in('status', filter.statusFilter);
          }
          if (filter.staffId) {
            q = q.eq('assigned_to', filter.staffId);
          }

          const { data } = await q;
          setLeadsRows((data ?? []).map((r: any) => ({
            id: r.id,
            created_at: r.created_at,
            customer_name: r.customer_name,
            channel: r.channel,
            campaign_name: r.campaign_name,
            status: r.status,
            assigned_name: r.profiles?.display_name ?? '미배정',
          })));
        } else if (filter.sourceType === 'sales') {
          // sales 테이블 조회
          const { start, end } = (() => {
            const from = filter.dateFrom.slice(0, 7);
            const [y, m] = from.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            return { start: `${from}-01`, end: `${from}-${String(lastDay).padStart(2, '0')}` };
          })();
          let q = supabase.from('sales')
            .select('id, open_date, manager, customer_name, product, status, channel')
            .gte('open_date', start).lte('open_date', end)
            .is('deleted_at', null)
            .in('status', ['개통완료'])
            .order('open_date', { ascending: false }).limit(100);
          if (filter.staffId) {
            // manager 필드 — 이름 기준으로 매핑 필요 (profiles에서 조회)
            const { data: profile } = await supabase.from('profiles')
              .select('display_name').eq('user_id', filter.staffId).single();
            if (profile?.display_name) { q = q.or(`manager.eq.${profile.display_name},manager.eq.${filter.staffId}`); }
          }
          const { data } = await q;
          setSalesRows((data ?? []) as SalesRow[]);
        } else {
          // activity_logs — leads join 없이 조회 (id 충돌 방지)
          let q = supabase
            .from('activity_logs')
            .select('id, lead_id, staff_id, staff_name, channel, action_type, previous_status, next_status, memo, fail_reason, is_counted, not_counted_reason, created_at')
            .gte('created_at', (() => { const {start} = getKstDateRangeUtc(filter.dateFrom, filter.dateTo); return start; })())
            .lte('created_at', (() => { const {end} = getKstDateRangeUtc(filter.dateFrom, filter.dateTo); return end; })())
            .order('created_at', { ascending: false });

          if (filter.actionTypes && filter.actionTypes.length > 0) {
            q = q.in('action_type', filter.actionTypes);
          }
          if (filter.staffId) {
            q = q.eq('staff_id', filter.staffId);
          }

          const { data } = await q;
          const rawRows = (data ?? []) as any[];

          // lead_id로 고객명 별도 조회
          const leadIds = [...new Set(rawRows.map((r: any) => r.lead_id).filter(Boolean))];
          const leadNameMap = new Map<string, string>();
          if (leadIds.length > 0) {
            const { data: leadData } = await supabase
              .from('leads').select('id, customer_name').in('id', leadIds);
            (leadData ?? []).forEach((l: any) => leadNameMap.set(l.id, l.customer_name ?? ''));
          }

          // 담당자명 이메일 → display_name 변환
          const staffIds = [...new Set(rawRows.map((r: any) => r.staff_id).filter(Boolean))];
          const nameMap = staffIds.length > 0 ? await resolveStaffDisplayNames(staffIds) : new Map();

          setRows(rawRows.map((r: any) => ({
            ...r,
            customer_name: leadNameMap.get(r.lead_id) ?? null,
            resolved_name: nameMap.get(r.staff_id) ?? r.staff_name,
          })));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter]);

  const getChannelLabel = (ch: string | null, campaign?: string | null) => {
    if (campaign === '도그마루_홈캠') return '도그마루';
    if (ch === '유닥') return '유닥';
    return CHANNEL_LABEL[ch ?? ''] ?? ch ?? '-';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">{filter.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {filter.dateFrom === filter.dateTo ? filter.dateFrom : `${filter.dateFrom} ~ ${filter.dateTo}`}
              {filter.staffId && ' · 담당자 필터'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="overflow-auto flex-1 p-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">로딩 중...</div>
          ) : filter.sourceType === 'sales' ? (
            salesRows.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">해당 데이터가 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                    {['개통일','담당자','고객명','상품','상태','채널'].map(h => (
                      <th key={h} className="py-2.5 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {salesRows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 text-xs text-gray-400 font-mono">{r.open_date ?? '-'}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{r.manager ?? '-'}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{maskCustomerName(r.customer_name)}</td>
                      <td className="py-2.5 px-3 text-xs text-gray-600">{r.product ?? '-'}</td>
                      <td className="py-2.5 px-3"><WRBadge variant="success">{r.status ?? '-'}</WRBadge></td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">{r.channel ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : filter.sourceType === 'leads' ? (
            /* 신규접수/미처리 — leads 테이블 */
            leadsRows.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">해당 데이터가 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                    {['접수시간', '담당자', '고객명', '채널', '상태'].map((h) => (
                      <th key={h} className="py-2.5 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leadsRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        {' '}
                        {new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{r.assigned_name}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{maskCustomerName(r.customer_name)}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                          {getChannelLabel(r.channel, r.campaign_name)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <WRBadge variant="info">{r.status}</WRBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            /* activity_logs */
            rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">해당 로그가 없습니다.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                    {['처리시간', '담당자', '고객명', '채널', '행동', '이전→변경', '인정', '메모/실패사유', ...(canExclude ? ['제외'] : [])].map((h) => (
                      <th key={h} className="py-2.5 px-3 font-medium text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r) => (
                    <tr key={r.id} className={`hover:bg-gray-50 ${!r.is_counted ? 'bg-red-50/30' : ''}`}>
                      <td className="py-2.5 px-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        {' '}
                        {new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{r.resolved_name ?? r.staff_name}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">
                        {maskCustomerName(r.customer_name)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          r.channel === 'dogmaru' ? 'bg-blue-100 text-blue-700' :
                          r.channel === 'udak' ? 'bg-purple-100 text-purple-700' :
                          'bg-pink-100 text-pink-700'
                        }`}>
                          {CHANNEL_LABEL[r.channel ?? ''] ?? r.channel ?? '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <WRBadge variant="info">
                          {ACTION_TYPE_LABEL[r.action_type as ActivityActionType] ?? r.action_type}
                        </WRBadge>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 whitespace-nowrap">
                        {r.previous_status ?? '-'} → {r.next_status ?? '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <WRBadge variant={r.is_counted ? 'success' : 'danger'}>
                          {r.is_counted ? '인정' : '미인정'}
                        </WRBadge>
                        {!r.is_counted && r.not_counted_reason && (
                          <div className="text-[10px] text-red-400 mt-0.5">{r.not_counted_reason}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500 max-w-[180px]">
                        {r.fail_reason && <div className="text-red-400">{r.fail_reason}</div>}
                        {r.memo && <div>{r.memo}</div>}
                        {!r.fail_reason && !r.memo && '-'}
                      </td>
                      {canExclude && (
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.is_counted ? (
                            <div className="flex gap-1">
                              {(['실수', '중복'] as const).map((reason) => {
                                const selected = pendingExcludes.get(r.id) === reason;
                                return (
                                  <button
                                    key={reason}
                                    onClick={() => handleExclude(r.id, reason)}
                                    className={`text-[10px] border rounded px-1.5 py-0.5 transition-colors ${
                                      selected
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-400'
                                    }`}
                                  >
                                    {reason}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-300">제외됨</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            {filter.sourceType === 'sales' ? salesRows.length : filter.sourceType === 'leads' ? leadsRows.length : rows.length}건
            {pendingExcludes.size > 0 && (
              <span className="ml-2 text-red-500 font-medium">{pendingExcludes.size}건 제외 예정</span>
            )}
          </span>
          <div className="flex gap-2">
            {canExclude && pendingExcludes.size > 0 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-1.5 font-medium transition-colors disabled:opacity-50"
              >
                {saving ? '저장 중...' : `${pendingExcludes.size}건 제외 저장`}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs border border-gray-200 text-gray-600 rounded-lg px-4 py-1.5 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
