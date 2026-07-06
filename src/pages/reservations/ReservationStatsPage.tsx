// ============================================================
// 사전예약 관리 — 통계 현황 (채널별 퍼널 + 날짜 필터 + 그래프)
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { RotateCw, ArrowLeft, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { WorkReportHeader, SectionCard } from '@/pages/work-report/_shared';
import { supabase } from '@/integrations/supabase/client';

// ── 날짜 유틸 ─────────────────────────────────────────────
function toKstDateStr(date: Date) {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '-').replace('.', '').trim();
}

function getRange(mode: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (mode === '전일') {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    return { start: d, end: new Date(d.getTime() + 86399999), label: '전일' };
  }
  if (mode === '전주') {
    const day = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - day - 6);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: mon, end: new Date(sun.getTime() + 86399999), label: '전주' };
  }
  if (mode === '전달') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start, end, label: '전달' };
  }
  if (mode === '일별') {
    return { start: today, end: new Date(today.getTime() + 86399999), label: '오늘' };
  }
  if (mode === '주별') {
    const day = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return { start: mon, end: new Date(today.getTime() + 86399999), label: '이번 주' };
  }
  if (mode === '월별') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: new Date(today.getTime() + 86399999), label: '이번 달' };
  }
  return { start: new Date(0), end: new Date(), label: '전체' };
}

const CHANNELS = ['전체', '메타광고', '네이버 검색광고', '기타'];
const FUNNEL_STEPS = [
  { key: '신규',     label: '신규(인입)', color: '#93c5fd' },
  { key: '문자발송', label: '문자발송',   color: '#7dd3fc' },
  { key: '부재',     label: '부재',       color: '#fdba74' },
  { key: '재케어',   label: '재케어',     color: '#c4b5fd' },
  { key: '상담성공', label: '상담성공',   color: '#6ee7b7' },
  { key: '상담실패', label: '상담실패',   color: '#fca5a5' },
  { key: '예약완료', label: '예약완료',   color: '#f9a8d4' },
  { key: '개통완료', label: '개통완료',   color: '#a5b4fc' },
];
const CONVERSION_POINTS = [
  { from: '신규',     to: '부재',     label: '신규 → 부재율',        color: 'text-orange-500' },
  { from: '부재',     to: '상담성공', label: '부재 → 상담성공율',     color: 'text-purple-500' },
  { from: '재케어',   to: '상담성공', label: '재케어 → 상담성공율',   color: 'text-blue-500' },
  { from: '상담성공', to: '예약완료', label: '상담성공 → 예약완료율', color: 'text-pink-500' },
  { from: '예약완료', to: '개통완료', label: '예약완료 → 개통완료율', color: 'text-indigo-500' },
];
const STATUS_ORDER = ['신규', '문자발송', '부재', '재케어', '상담성공', '상담실패', '예약완료', '개통완료'];

type RowData = { status: string; channel: string | null; created_at: string };

function calcRate(n: number, d: number) {
  if (d === 0) return '-';
  return Math.round((n / d) * 100) + '%';
}
function getCount(rows: RowData[], status: string, channel?: string) {
  return rows.filter(r => r.status === status && (channel ? r.channel === channel : true)).length;
}
function getCountFromStage(rows: RowData[], fromStatus: string, channel?: string) {
  const idx = STATUS_ORDER.indexOf(fromStatus);
  const valid = STATUS_ORDER.slice(idx);
  return rows.filter(r => valid.includes(r.status) && (channel ? r.channel === channel : true)).length;
}

// ── 퍼널 카드 ────────────────────────────────────────────
function FunnelCard({
  label, rows, channel, onStepClick,
}: {
  label: string;
  rows: RowData[];
  channel?: string;
  onStepClick: (step: string, channel?: string) => void;
}) {
  const filtered = rows.filter(r => channel ? r.channel === channel : true);
  const total = filtered.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-800">{label}</h3>
        <span className="text-xs text-gray-400">총 {total}건</span>
      </div>

      <div className="space-y-1.5 mb-5">
        {FUNNEL_STEPS.map((step) => {
          const count = getCount(rows, step.key, channel);
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <button
              key={step.key}
              className="w-full flex items-center gap-2 hover:bg-gray-50 rounded-lg px-1 py-0.5 transition-colors group"
              onClick={() => onStepClick(step.key, channel)}
              title="클릭하면 그래프로 봅니다"
            >
              <div className="w-[76px] text-xs text-gray-500 shrink-0 text-right group-hover:text-gray-800">{step.label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: step.color }}
                />
                {count > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                    {count}건
                  </span>
                )}
              </div>
              <div className="w-[32px] text-xs text-gray-400 shrink-0">{pct}%</div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        {CONVERSION_POINTS.map((cp) => {
          const fromCount = getCountFromStage(rows, cp.from, channel);
          const toCount = getCountFromStage(rows, cp.to, channel);
          return (
            <div key={cp.label} className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{cp.label}</span>
              <span className={`font-bold text-sm ${cp.color}`}>{calcRate(toCount, fromCount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 그래프 드로어 ─────────────────────────────────────────
function GraphDrawer({
  rows, step, channel, onClose,
}: {
  rows: RowData[];
  step: string;
  channel?: string;
  onClose: () => void;
}) {
  const stepInfo = FUNNEL_STEPS.find(s => s.key === step);

  // 일별 추이 데이터
  const chartData = useMemo(() => {
    const filtered = rows.filter(r =>
      r.status === step && (channel ? r.channel === channel : true)
    );
    const byDate: Record<string, number> = {};
    filtered.forEach(r => {
      const d = new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
      byDate[d] = (byDate[d] ?? 0) + 1;
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  }, [rows, step, channel]);

  // 채널별 비교
  const channelData = useMemo(() => {
    return ['메타광고', '네이버 검색광고', '기타'].map(ch => ({
      channel: ch,
      count: getCount(rows, step, ch),
    }));
  }, [rows, step]);

  const total = getCount(rows, step, channel);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl w-full max-w-4xl max-h-[70vh] overflow-y-auto shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold">
              {channel ?? '전체'} — {stepInfo?.label ?? step}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">총 {total}건</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 일별 추이 */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-3">일별 인입 추이</div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [`${v}건`]} />
                  <Bar dataKey="count" fill={stepInfo?.color ?? '#a5b4fc'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
            )}
          </div>

          {/* 채널별 비교 */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-3">채널별 비교</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={channelData}>
                <XAxis dataKey="channel" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [`${v}건`]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {channelData.map((_, i) => (
                    <Cell key={i} fill={['#f9a8d4', '#93c5fd', '#6ee7b7'][i % 3]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────
export default function ReservationStatsPage() {
  const navigate = useNavigate();
  const [allRows, setAllRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [failStats, setFailStats] = useState<{ reason: string; count: number }[]>([]);

  // 필터
  const [periodMode, setPeriodMode] = useState<string>(''); // '' = 전체
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // 그래프 드로어
  const [graphStep, setGraphStep] = useState<string | null>(null);
  const [graphChannel, setGraphChannel] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('status, channel, created_at');
      if (error) throw error;
      setAllRows((data ?? []) as RowData[]);

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

  // 날짜 필터 적용
  const rows = useMemo(() => {
    if (!periodMode && !customStart) return allRows;
    let start: Date, end: Date;
    if (customStart) {
      start = new Date(customStart);
      end = customEnd ? new Date(customEnd + 'T23:59:59') : new Date();
    } else {
      const range = getRange(periodMode);
      start = range.start;
      end = range.end;
    }
    return allRows.filter(r => {
      const d = new Date(r.created_at);
      return d >= start && d <= end;
    });
  }, [allRows, periodMode, customStart, customEnd]);

  const PERIOD_BTNS = [
    { label: '전체', value: '' },
    { label: '일별', value: '일별' },
    { label: '주별', value: '주별' },
    { label: '월별', value: '월별' },
    { label: '전일', value: '전일' },
    { label: '전주', value: '전주' },
    { label: '전달', value: '전달' },
  ];

  const currentLabel = periodMode ? PERIOD_BTNS.find(b => b.value === periodMode)?.label :
    customStart ? `${customStart}${customEnd ? ' ~ ' + customEnd : ''}` : '전체';

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="사전예약 통계"
        description="채널별 단계 퍼널 및 전환율 분석 · 항목 클릭 시 그래프"
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

      {/* 날짜 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          {/* 기간 버튼 */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_BTNS.map(btn => (
              <button
                key={btn.value}
                onClick={() => { setPeriodMode(btn.value); setCustomStart(''); setCustomEnd(''); }}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  periodMode === btn.value && !customStart
                    ? 'bg-white text-pink-600 shadow-sm font-semibold'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* 직접 날짜 선택 */}
          <div className="flex items-center gap-1.5 ml-2">
            <input
              type="date"
              value={customStart}
              onChange={e => { setCustomStart(e.target.value); setPeriodMode(''); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
            />
            {(customStart || periodMode) && (
              <button
                onClick={() => { setPeriodMode(''); setCustomStart(''); setCustomEnd(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
              >
                <X className="size-3" /> 초기화
              </button>
            )}
          </div>

          <span className="ml-auto text-xs text-gray-400">
            {currentLabel} · {rows.length}건
          </span>
        </div>
      </SectionCard>

      {/* 채널별 퍼널 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <FunnelCard label="전체" rows={rows}
          onStepClick={(step) => { setGraphStep(step); setGraphChannel(undefined); }} />
        <FunnelCard label="메타광고" rows={rows} channel="메타광고"
          onStepClick={(step, ch) => { setGraphStep(step); setGraphChannel(ch); }} />
        <FunnelCard label="네이버 검색광고" rows={rows} channel="네이버 검색광고"
          onStepClick={(step, ch) => { setGraphStep(step); setGraphChannel(ch); }} />
        <FunnelCard label="기타" rows={rows} channel="기타"
          onStepClick={(step, ch) => { setGraphStep(step); setGraphChannel(ch); }} />
      </div>

      {/* 실패 사유 */}
      <SectionCard title="상담실패 사유 분석">
        {failStats.length > 0 ? (
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
        ) : (
          <div className="text-sm text-gray-400 text-center py-4">데이터가 없습니다</div>
        )}
      </SectionCard>

      {/* 그래프 드로어 */}
      {graphStep && (
        <GraphDrawer
          rows={rows}
          step={graphStep}
          channel={graphChannel}
          onClose={() => setGraphStep(null)}
        />
      )}
    </div>
  );
}
