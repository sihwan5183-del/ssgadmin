// ============================================================
// 팀 업무 현황 — 관리자: 전체 / 직원: 본인만
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { getTeamNewLeadsSummary } from '@/services/workReport/newLeadsService';
import { WorkReportHeader, SectionCard, FilterButtons, WRBadge } from './_shared';
import { LogDetailModal, type LogDetailFilter } from './LogDetailModal';
import {
  getTeamWorkDashboardData,
  aggregateByAction,
  aggregateByStaff,
  getSalesDoneCount,
} from '@/services/workReport/workReportService';
import { resolveStaffDisplayNames } from '@/services/workReport/staffDisplayService';

const PERIOD_OPTIONS = ['오늘', '이번주', '이번달'];

function getDateRange(period: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (period === '오늘') return { from: fmt(today), to: fmt(today) };
  if (period === '이번주') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: fmt(mon), to: fmt(today) };
  }
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: fmt(first), to: fmt(today) };
}

export default function TeamWorkDashboard() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const canViewAll = isAdmin || isManager;

  const [period, setPeriod] = useState('오늘');
  const [loading, setLoading] = useState(false);
  const [staffRows, setStaffRows] = useState<ReturnType<typeof aggregateByStaff>>([]);
  const [totalAgg, setTotalAgg] = useState<ReturnType<typeof aggregateByAction> | null>(null);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());
  const [detailFilter, setDetailFilter] = useState<LogDetailFilter | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const openDetail = (f: LogDetailFilter) => setDetailFilter(f);
  const [newSummary, setNewSummary] = useState<{ today_new: number; pending_new: number; by_channel: Record<string, number> } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const [logs, salesDone] = await Promise.all([
        getTeamWorkDashboardData(user.id, canViewAll, from, to),
        getSalesDoneCount(from, to),
      ]);
      const baseAgg = aggregateByAction(logs);
      // 개통완료/설치완료/정산확정은 sales 기준으로 덮어쓰기
      setTotalAgg({ ...baseAgg,
        activation_completed: { counted: salesDone.activation, total: salesDone.activation },
        settlement_confirmed: { counted: salesDone.settlement, total: salesDone.settlement },
      });
      const rows = aggregateByStaff(logs).map(r => ({
        ...r,
        activation_completed: salesDone.byStaff[r.staff_id]?.activation ?? 0,
        settlement_confirmed: salesDone.byStaff[r.staff_id]?.settlement ?? 0,
      }));
      setStaffRows(rows);
      // 신규건 요약 (from은 이미 위에서 선언됨)
      const newSum = await getTeamNewLeadsSummary(from, canViewAll, user.id);
      setNewSummary(newSum);
      // 담당자 표시명 일괄 조회
      const staffIds = rows.map((r) => r.staff_id);
      if (staffIds.length > 0) {
        const map = await resolveStaffDisplayNames(staffIds);
        setNameMap(map);
      }
    } catch (e: any) {
      toast.error('데이터 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, canViewAll, period]);

  useEffect(() => {
    if (!roleLoading) load();
  }, [roleLoading, load]);

  const kpiItems = [
    { label: '통화시도',  key: 'call_attempt',         color: 'text-blue-600' },
    { label: '연결완료',  key: 'call_connected',        color: 'text-indigo-600' },
    { label: '부재',      key: 'absent',                color: 'text-orange-500' },
    { label: '재케어',    key: 'recare_registered',     color: 'text-yellow-600' },
    { label: '실패',      key: 'failed',                color: 'text-red-500' },
    { label: '상담성공',  key: 'consultation_success',  color: 'text-green-600' },
    { label: '개통완료',  key: 'activation_completed',  color: 'text-pink-600' },
    { label: '정산확정',  key: 'settlement_confirmed',  color: 'text-purple-600' },
  ] as const;

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="팀 업무 현황"
        description={canViewAll ? '전체 팀원 업무량과 성과를 확인합니다.' : '본인 업무 현황입니다.'}
        rightSlot={
          <>
            <FilterButtons options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            <button
              onClick={load}
              className="flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`size-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {detailFilter && (
        <LogDetailModal filter={detailFilter} onClose={() => setDetailFilter(null)} onDone={load} />
      )}

      {!canViewAll && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700 flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0" />
          팀 업무 현황은 관리자/팀장만 전체 조회 가능합니다. 본인 데이터만 표시됩니다.
        </div>
      )}

      {/* 신규 접수 현황 */}
      {newSummary && (
        <SectionCard title="신규 접수 현황">
          <div className="space-y-3">
            {/* 전체 요약 */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '오늘 신규 접수 (전체)', value: newSummary.today_new, color: 'text-blue-600' },
                { label: '미처리 신규건', value: newSummary.pending_new, color: 'text-red-500' },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            {/* 채널별 분리 */}
            <div>
              <div className="text-xs text-gray-400 mb-2 font-medium">채널별 오늘 신규</div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '메타', value: newSummary.by_channel['meta'] ?? 0, color: 'bg-pink-50 border-pink-100 text-pink-600' },
                  { label: '도그마루', value: newSummary.by_channel['dogmaru'] ?? 0, color: 'bg-blue-50 border-blue-100 text-blue-600' },
                  { label: '유닥', value: newSummary.by_channel['udak'] ?? 0, color: 'bg-purple-50 border-purple-100 text-purple-600' },
                  { label: '모요', value: newSummary.by_channel['moyo'] ?? 0, color: 'bg-green-50 border-green-100 text-green-600' },
                  { label: '기타', value: newSummary.by_channel['other'] ?? 0, color: 'bg-gray-50 border-gray-100 text-gray-500' },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
                    <div className="text-xl font-bold">{s.value}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 전체 요약 */}
      <SectionCard title={`${period} 전체 요약`}>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            {kpiItems.map(({ label, key, color }) => (
              <div key={key} className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-center">
                <div className={`text-2xl font-bold ${color}`}>{totalAgg?.[key]?.counted ?? 0}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 담당자별 표 — 관리자/팀장만 */}
      {canViewAll && (
        <SectionCard title="담당자별 업무 현황">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
          ) : staffRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">데이터가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    {['담당자', '시도', '연결', '부재', '재케어', '실패', '상담성공', '개통완료', '정산확정', '전환율'].map((h) => (
                      <th key={h} className={`py-2.5 px-3 font-medium ${h === '담당자' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {staffRows.map((r) => (
                    <tr key={r.staff_id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 font-medium text-gray-800">{nameMap.get(r.staff_id) ?? r.staff_name}</td>
                      {[
                        { val: r.call_attempt, actions: ['call_attempt'], label: '통화시도', cls: 'text-gray-700' },
                        { val: r.call_connected, actions: ['call_connected'], label: '연결완료', cls: 'text-indigo-600' },
                        { val: r.absent, actions: ['absent'], label: '부재', cls: 'text-orange-500' },
                        { val: r.recare, actions: ['recare_registered','recare_completed'], label: '재케어', cls: 'text-yellow-600' },
                        { val: r.failed, actions: ['failed'], label: '실패', cls: 'text-red-500' },
                        { val: r.consultation_success, actions: ['consultation_success'], label: '상담성공', cls: 'text-green-600 font-semibold' },
                        { val: r.activation_completed, actions: ['activation_completed'], label: '개통완료', cls: 'text-pink-600 font-semibold' },
                        { val: r.settlement_confirmed, actions: ['settlement_confirmed'], label: '정산확정', cls: 'text-purple-600 font-bold' },
                      ].map(({ val, actions, label, cls }) => {
                        const { from: df } = (() => {
                          const t = new Date(); const fmt = (d: Date) => d.toISOString().split('T')[0];
                          if (period === '오늘') return { from: fmt(t) };
                          if (period === '이번주') { const m = new Date(t); m.setDate(t.getDate()-((t.getDay()+6)%7)); return { from: fmt(m) }; }
                          return { from: fmt(new Date(t.getFullYear(), t.getMonth(), 1)) };
                        })();
                        return (
                          <td key={label} className="py-3 px-3 text-right">
                            <button
                              onClick={() => val > 0 && openDetail({
                                title: `${nameMap.get(r.staff_id) ?? r.staff_name} · ${label} 상세`,
                                dateFrom: df, dateTo: today,
                                actionTypes: actions as any,
                                staffId: r.staff_id,
                              })}
                              className={`${cls} ${val > 0 ? 'hover:underline cursor-pointer' : 'cursor-default'}`}
                            >
                              {val}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-3 px-3 text-right">
                        <WRBadge variant="info">{r.conversion_rate}%</WRBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
