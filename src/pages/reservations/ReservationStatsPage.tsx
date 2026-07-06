// ============================================================
// 사전예약 관리 — 통계 현황 (채널별 퍼널 전환율)
// ============================================================
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { RotateCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { WorkReportHeader, SectionCard } from '@/pages/work-report/_shared';
import { supabase } from '@/integrations/supabase/client';

const CHANNELS = ['전체', '메타광고', '네이버 검색광고', '기타'];

// 퍼널 단계 정의
const FUNNEL_STEPS = [
  { key: '신규',     label: '신규(인입)' },
  { key: '문자발송', label: '문자발송' },
  { key: '부재',     label: '부재' },
  { key: '재케어',   label: '재케어' },
  { key: '상담성공', label: '상담성공' },
  { key: '예약완료', label: '예약완료' },
  { key: '개통완료', label: '개통완료' },
];

// 전환율 포인트 (어디서 어디로)
const CONVERSION_POINTS = [
  { from: '신규',     to: '부재',     label: '신규 → 부재율',          color: 'text-orange-500' },
  { from: '부재',     to: '상담성공', label: '부재 → 상담성공율',       color: 'text-purple-500' },
  { from: '재케어',   to: '상담성공', label: '재케어 → 상담성공율',     color: 'text-blue-500' },
  { from: '상담성공', to: '예약완료', label: '상담성공 → 예약완료율',   color: 'text-pink-500' },
  { from: '예약완료', to: '개통완료', label: '예약완료 → 개통완료율',   color: 'text-indigo-500' },
];

type RowData = { status: string; channel: string | null };

function calcRate(numerator: number, denominator: number) {
  if (denominator === 0) return '-';
  return Math.round((numerator / denominator) * 100) + '%';
}

function getCount(rows: RowData[], status: string, channel?: string) {
  return rows.filter(r =>
    r.status === status && (channel ? r.channel === channel : true)
  ).length;
}

// 실패 포함한 "이 단계까지 온 전체" = 해당 status + 이후 모든 status
const STATUS_ORDER = ['신규', '문자발송', '부재', '재케어', '상담성공', '상담실패', '예약완료', '개통완료'];

function getCountFromStage(rows: RowData[], fromStatus: string, channel?: string) {
  const fromIdx = STATUS_ORDER.indexOf(fromStatus);
  const validStatuses = STATUS_ORDER.slice(fromIdx);
  return rows.filter(r =>
    validStatuses.includes(r.status) && (channel ? r.channel === channel : true)
  ).length;
}

interface FunnelCardProps {
  label: string;
  rows: RowData[];
  channel?: string;
}

function FunnelCard({ label, rows, channel }: FunnelCardProps) {
  const total = rows.filter(r => channel ? r.channel === channel : true).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800">{label}</h3>
        <span className="text-xs text-gray-400">총 {total}건</span>
      </div>

      {/* 퍼널 바 */}
      <div className="space-y-2 mb-5">
        {FUNNEL_STEPS.map((step) => {
          const count = getCount(rows, step.key, channel);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isFail = step.key === '상담실패';
          return (
            <div key={step.key} className="flex items-center gap-2">
              <div className="w-[80px] text-xs text-gray-500 shrink-0 text-right">{step.label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${
                    step.key === '개통완료' ? 'bg-indigo-400' :
                    step.key === '예약완료' ? 'bg-pink-400' :
                    step.key === '상담성공' ? 'bg-emerald-400' :
                    step.key === '재케어'   ? 'bg-purple-300' :
                    step.key === '부재'     ? 'bg-orange-300' :
                    step.key === '문자발송' ? 'bg-sky-300' : 'bg-blue-300'
                  }`}
                  style={{ width: `${pct}%` }}
                />
                {count > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                    {count}건
                  </span>
                )}
              </div>
              <div className="w-[36px] text-xs text-gray-400 shrink-0">{pct}%</div>
            </div>
          );
        })}
        {/* 상담실패 별도 표시 */}
        {(() => {
          const count = getCount(rows, '상담실패', channel);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div className="flex items-center gap-2">
              <div className="w-[80px] text-xs text-red-400 shrink-0 text-right">상담실패</div>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
                <div className="h-full rounded-full bg-red-300" style={{ width: `${pct}%` }} />
                {count > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                    {count}건
                  </span>
                )}
              </div>
              <div className="w-[36px] text-xs text-red-400 shrink-0">{pct}%</div>
            </div>
          );
        })()}
      </div>

      {/* 전환율 포인트 */}
      <div className="border-t border-gray-100 pt-4 grid grid-cols-1 gap-2">
        {CONVERSION_POINTS.map((cp) => {
          const fromCount = getCountFromStage(rows, cp.from, channel);
          const toCount = getCountFromStage(rows, cp.to, channel);
          const rate = calcRate(toCount, fromCount);
          return (
            <div key={cp.label} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{cp.label}</span>
              <span className={`font-bold text-sm ${cp.color}`}>{rate}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReservationStatsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [failStats, setFailStats] = useState<{ reason: string; count: number }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('status, channel');
      if (error) throw error;
      setRows((data ?? []) as RowData[]);

      // 실패 사유 통계
      const { data: failData } = await supabase
        .from('reservations')
        .select('fail_reason:reservation_fail_reasons(reason)')
        .eq('status', '상담실패')
        .not('fail_reason_id', 'is', null);

      const reasonCount: Record<string, number> = {};
      (failData ?? []).forEach((r: any) => {
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

  const totalAll = rows.length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="사전예약 통계"
        description="채널별 단계 퍼널 및 전환율 분석"
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

      {/* 채널별 퍼널 카드 4개 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <FunnelCard label="전체" rows={rows} />
        <FunnelCard label="메타광고" rows={rows} channel="메타광고" />
        <FunnelCard label="네이버 검색광고" rows={rows} channel="네이버 검색광고" />
        <FunnelCard label="기타" rows={rows} channel="기타" />
      </div>

      {/* 실패 사유 */}
      {failStats.length > 0 && (
        <SectionCard title="상담실패 사유 분석">
          <div className="space-y-2">
            {failStats.map((f) => {
              const total = failStats.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? Math.round((f.count / total) * 100) : 0;
              return (
                <div key={f.reason} className="flex items-center gap-3">
                  <div className="w-[140px] text-sm text-gray-600 shrink-0">{f.reason}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-sm font-semibold text-gray-700 w-[50px] text-right">{f.count}건</div>
                  <div className="text-xs text-gray-400 w-[36px] text-right">{pct}%</div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {failStats.length === 0 && !loading && (
        <SectionCard title="상담실패 사유 분석">
          <div className="text-sm text-gray-400 text-center py-4">데이터가 없습니다</div>
        </SectionCard>
      )}
    </div>
  );
}
