// ============================================================
// 팀 업무 현황 — 관리자: 전체 / 직원: 본인만
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { WorkReportHeader, SectionCard, FilterButtons, WRBadge } from './_shared';
import {
  getTeamWorkDashboardData,
  aggregateByAction,
  aggregateByStaff,
} from '@/services/workReport/workReportService';

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
  const { isAdmin, isManager } = useRole();
  const canViewAll = isAdmin || isManager;

  const [period, setPeriod] = useState('오늘');
  const [loading, setLoading] = useState(false);
  const [staffRows, setStaffRows] = useState<ReturnType<typeof aggregateByStaff>>([]);
  const [totalAgg, setTotalAgg] = useState<ReturnType<typeof aggregateByAction> | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const logs = await getTeamWorkDashboardData(user.id, canViewAll, from, to);
      setTotalAgg(aggregateByAction(logs));
      setStaffRows(aggregateByStaff(logs));
    } catch (e: any) {
      toast.error('데이터 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, canViewAll, period]);

  useEffect(() => { load(); }, [load]);

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

      {!canViewAll && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700 flex items-center gap-2">
          <AlertTriangle className="size-3.5 shrink-0" />
          팀 업무 현황은 관리자/팀장만 전체 조회 가능합니다. 본인 데이터만 표시됩니다.
        </div>
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
                      <td className="py-3 px-3 font-medium text-gray-800">{r.staff_name}</td>
                      <td className="py-3 px-3 text-right text-gray-700">{r.call_attempt}</td>
                      <td className="py-3 px-3 text-right text-indigo-600">{r.call_connected}</td>
                      <td className="py-3 px-3 text-right text-orange-500">{r.absent}</td>
                      <td className="py-3 px-3 text-right text-yellow-600">{r.recare}</td>
                      <td className="py-3 px-3 text-right text-red-500">{r.failed}</td>
                      <td className="py-3 px-3 text-right text-green-600 font-semibold">{r.consultation_success}</td>
                      <td className="py-3 px-3 text-right text-pink-600 font-semibold">{r.activation_completed}</td>
                      <td className="py-3 px-3 text-right text-purple-600 font-bold">{r.settlement_confirmed}</td>
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
