// ============================================================
// 내 업무 대시보드 — 본인 데이터만 (권한 필터 적용)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { WorkReportHeader, KpiCard, SectionCard, FilterButtons } from './_shared';
import { getMyWorkDashboardData, aggregateByAction } from '@/services/workReport/workReportService';
import { getMyNewLeadsSummary, getMyPendingNewLeads, type NewLeadItem, type NewLeadsSummary } from '@/services/workReport/newLeadsService';
import { resolveStaffDisplayName } from '@/services/workReport/staffDisplayService';
import { ACTION_TYPE_LABEL } from '@/types/workReport';

const PERIOD_OPTIONS = ['오늘', '어제', '이번주', '이번달'];

function getDateRange(period: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (period === '오늘') return { from: fmt(today), to: fmt(today) };
  if (period === '어제') {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { from: fmt(y), to: fmt(y) };
  }
  if (period === '이번주') {
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return { from: fmt(mon), to: fmt(today) };
  }
  // 이번달
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: fmt(first), to: fmt(today) };
}

const KPI_CARDS = [
  { key: 'call_attempt',         label: '통화시도',  color: 'blue'   },
  { key: 'call_connected',       label: '연결완료',  color: 'indigo' },
  { key: 'absent',               label: '부재',      color: 'orange' },
  { key: 'recare_registered',    label: '재케어',    color: 'yellow' },
  { key: 'failed',               label: '실패',      color: 'red'    },
  { key: 'consultation_success', label: '상담성공',  color: 'green'  },
  { key: 'activation_completed', label: '개통완료',  color: 'pink'   },
  { key: 'settlement_confirmed', label: '정산확정',  color: 'gray'   },
] as const;

const FLOW_STEPS = [
  'call_attempt', 'call_connected', 'consultation_success',
  'delivery_sent', 'activation_completed', 'settlement_confirmed',
] as const;

export default function MyWorkDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('오늘');
  const [loading, setLoading] = useState(false);
  const [agg, setAgg] = useState<ReturnType<typeof aggregateByAction> | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const [displayName, setDisplayName] = useState<string>('');
  const [newSummary, setNewSummary] = useState<NewLeadsSummary | null>(null);
  const [pendingLeads, setPendingLeads] = useState<NewLeadItem[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { from, to } = getDateRange(period);
      const logs = await getMyWorkDashboardData(user.id, from, to);
      setTotalLogs(logs.length);
      setAgg(aggregateByAction(logs));
      // 본인 표시명 조회
      const name = await resolveStaffDisplayName(user.id, user.email ?? '');
      setDisplayName(name);
      // 신규건 / 미처리 신규건 조회
      const { from } = getDateRange(period);
      const [newSum, pending] = await Promise.all([
        getMyNewLeadsSummary(user.id, from),
        getMyPendingNewLeads(user.id),
      ]);
      setNewSummary(newSum);
      setPendingLeads(pending);
    } catch (e: any) {
      toast.error('데이터 조회 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => { load(); }, [load]);

  const userName = user?.user_metadata?.display_name ?? user?.email ?? '나';

  return (
    <div className="space-y-5">
      <WorkReportHeader
        title="내 업무 대시보드"
        description={`${displayName || userName}님의 영업 활동 현황입니다.`}
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

      {/* 1구역: 내 업무 요약 */}
      <SectionCard title={`${period} 내 업무 요약`}>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
            {KPI_CARDS.map(({ key, label, color }) => {
              const val = agg?.[key];
              const counted = val?.counted ?? 0;
              const total = val?.total ?? 0;
              return (
                <KpiCard
                  key={key}
                  label={label}
                  value={counted}
                  sub={total !== counted ? `전체 ${total}건 / 인정 ${counted}건` : undefined}
                  color={color as any}
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 2구역: 전환 흐름 */}
      <SectionCard title="내 전환 흐름">
        {loading ? (
          <div className="py-6 text-center text-sm text-gray-400">로딩 중...</div>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {FLOW_STEPS.map((key, idx) => {
              const count = agg?.[key]?.counted ?? 0;
              const prev = idx > 0 ? (agg?.[FLOW_STEPS[idx - 1]]?.counted ?? 0) : null;
              const rate = prev && prev > 0 ? Math.round((count / prev) * 100) : null;
              return (
                <div key={key} className="flex items-center gap-1">
                  <div className="flex flex-col items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 min-w-[80px]">
                    <div className="text-xs text-gray-500 mb-1">{ACTION_TYPE_LABEL[key]}</div>
                    <div className="text-xl font-bold text-gray-900">{count}</div>
                    {rate !== null && (
                      <div className="text-[10px] text-pink-500 font-medium mt-0.5">{rate}%</div>
                    )}
                  </div>
                  {idx < FLOW_STEPS.length - 1 && (
                    <ChevronRight className="size-4 text-gray-300 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* 신규 접수건 요약 카드 */}
      <SectionCard title="신규 접수 현황">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '오늘 신규 접수', value: newSummary?.today_new ?? 0, color: 'text-blue-600' },
            { label: '미처리 신규건', value: newSummary?.pending_new ?? 0, color: 'text-red-500' },
            { label: '오늘 배정건', value: newSummary?.today_assigned ?? 0, color: 'text-green-600' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 미처리 신규건 리스트 */}
      {pendingLeads.length > 0 && (
        <SectionCard title={`내 미처리 신규건 (${pendingLeads.length}건)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  {['접수시간', '고객명', '채널', '상태', '경과'].map((h) => (
                    <th key={h} className="py-2 px-3 font-medium text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                      {new Date(lead.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      {' '}
                      {new Date(lead.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-gray-800">{lead.customer_name_masked}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        lead.channel === 'dogmaru' ? 'bg-blue-100 text-blue-700' :
                        lead.channel === 'udak' ? 'bg-purple-100 text-purple-700' :
                        'bg-pink-100 text-pink-700'
                      }`}>
                        {lead.channel === 'dogmaru' ? '도그마루' : lead.channel === 'udak' ? '유닥' : '메타'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-blue-600 font-medium">{lead.status}</td>
                    <td className="py-2.5 px-3 text-xs text-orange-500 font-medium">{lead.elapsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 3구역: 총 로그 통계 */}
      <SectionCard title="활동 통계">
        <div className="flex gap-4 flex-wrap">
          {[
            { label: '전체 로그', value: totalLogs, color: 'text-gray-700' },
            { label: '인정 로그', value: agg ? Object.values(agg).reduce((s, v) => s + v.counted, 0) : 0, color: 'text-green-600' },
            { label: '미인정 로그', value: totalLogs - (agg ? Object.values(agg).reduce((s, v) => s + v.counted, 0) : 0), color: 'text-red-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-xl border border-gray-100 px-6 py-4 text-center min-w-[120px]">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-4">
          ※ 인정 로그 기준으로 집계됩니다. 미인정 로그는 활동 로그 페이지에서 확인할 수 있습니다.
        </p>
      </SectionCard>
    </div>
  );
}
