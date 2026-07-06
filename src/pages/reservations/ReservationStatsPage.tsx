// ============================================================
// 사전예약 관리 — 통계 현황 페이지
// ============================================================
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { toast } from 'sonner';
import { RotateCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { WorkReportHeader, SectionCard, KpiCard } from '@/pages/work-report/_shared';
import { fetchReservationStats } from '@/services/reservationService';
import { RESERVATION_STATUS_LIST } from '@/types/reservation';
import { supabase } from '@/integrations/supabase/client';

const STATUS_COLORS: Record<string, string> = {
  '신규':     '#93c5fd',
  '문자발송': '#7dd3fc',
  '부재':     '#fdba74',
  '재케어':   '#c4b5fd',
  '상담성공': '#6ee7b7',
  '상담실패': '#fca5a5',
  '예약완료': '#f9a8d4',
  '개통완료': '#a5b4fc',
};

export default function ReservationStatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{
    total: number;
    byStatus: Record<string, number>;
    successRate: number;
    activationRate: number;
  } | null>(null);
  const [failStats, setFailStats] = useState<{ reason: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // 기본 통계
      const s = await fetchReservationStats();
      setStats(s);

      // 실패 사유 통계
      const { data } = await supabase
        .from('reservations')
        .select('fail_reason:reservation_fail_reasons(reason)')
        .eq('status', '상담실패')
        .not('fail_reason_id', 'is', null);

      const reasonCount: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const reason = r.fail_reason?.reason;
        if (reason) reasonCount[reason] = (reasonCount[reason] ?? 0) + 1;
      });
      setFailStats(
        Object.entries(reasonCount)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
      );
    } catch (e: any) {
      toast.error('통계 로드 실패: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const chartData = RESERVATION_STATUS_LIST.map((s) => ({
    name: s.label,
    value: stats?.byStatus[s.value] ?? 0,
    color: STATUS_COLORS[s.value] ?? '#e5e7eb',
  }));

  return (
    <div className="p-6 space-y-5 max-w-[1200px] mx-auto">
      <WorkReportHeader
        title="사전예약 통계"
        description="단계별 전환율 및 실패 사유 분석"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/reservations')} className="gap-1.5">
              <ArrowLeft className="size-4" /> 목록
            </Button>
            <Button variant="ghost" size="icon" onClick={load}>
              <RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* KPI 카드 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="전체 인입" value={stats.total} color="blue" />
          <KpiCard label="상담성공" value={stats.byStatus['상담성공'] ?? 0} color="green" />
          <KpiCard label="예약완료" value={stats.byStatus['예약완료'] ?? 0} color="pink" />
          <KpiCard label="개통완료" value={stats.byStatus['개통완료'] ?? 0} color="indigo" />
        </div>
      )}

      {/* 전환율 */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <SectionCard title="상담 성공률">
            <div className="text-4xl font-bold text-pink-500">{stats.successRate}%</div>
            <div className="text-xs text-gray-400 mt-1">전체 진행건 중 상담성공 이상 비율</div>
          </SectionCard>
          <SectionCard title="예약→개통 전환율">
            <div className="text-4xl font-bold text-indigo-500">{stats.activationRate}%</div>
            <div className="text-xs text-gray-400 mt-1">상담성공 이상 건 중 개통완료 비율</div>
          </SectionCard>
        </div>
      )}

      {/* 상태별 막대 차트 */}
      <SectionCard title="상태별 현황">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(v: any) => [`${v}건`]} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* 실패 사유 */}
      {failStats.length > 0 && (
        <SectionCard title="상담실패 사유 분석">
          <div className="space-y-2">
            {failStats.map((f) => {
              const total = failStats.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? Math.round((f.count / total) * 100) : 0;
              return (
                <div key={f.reason} className="flex items-center gap-3">
                  <div className="w-[120px] text-sm text-gray-600 shrink-0">{f.reason}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-sm font-semibold text-gray-700 w-[50px] text-right">
                    {f.count}건
                  </div>
                  <div className="text-xs text-gray-400 w-[36px] text-right">{pct}%</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

