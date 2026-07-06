// ============================================================
// 사전예약 통계 — 채널별 퍼널 + 날짜필터 + 비교 모드
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { RotateCw, ArrowLeft, X, TrendingUp, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { WorkReportHeader, SectionCard } from '@/pages/work-report/_shared';
import { supabase } from '@/integrations/supabase/client';

// ── 상수 ──────────────────────────────────────────────────
const CHANNELS = ['메타광고', '네이버 검색광고', '기타'];
const CHANNEL_COLORS: Record<string, string> = {
  '메타광고': '#f9a8d4',
  '네이버 검색광고': '#86efac',
  '기타': '#c4b5fd',
};
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
  { from: '신규',     to: '부재',     label: '신규→부재',        color: '#fb923c' },
  { from: '부재',     to: '상담성공', label: '부재→상담성공',     color: '#a78bfa' },
  { from: '재케어',   to: '상담성공', label: '재케어→상담성공',   color: '#60a5fa' },
  { from: '상담성공', to: '예약완료', label: '상담성공→예약완료', color: '#f472b6' },
  { from: '예약완료', to: '개통완료', label: '예약완료→개통완료', color: '#818cf8' },
];
const STATUS_ORDER = ['신규', '문자발송', '부재', '재케어', '상담성공', '상담실패', '예약완료', '개통완료'];
const PERIOD_BTNS = [
  { label: '전체', value: '' },
  { label: '일별', value: '일별' },
  { label: '주별', value: '주별' },
  { label: '월별', value: '월별' },
  { label: '전일', value: '전일' },
  { label: '전주', value: '전주' },
  { label: '전달', value: '전달' },
];

// ── 유틸 ──────────────────────────────────────────────────
type Row = { status: string; channel: string | null; created_at: string };

function getRange(mode: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === '전일') { const d = new Date(today); d.setDate(d.getDate()-1); return { start: d, end: new Date(d.getTime()+86399999) }; }
  if (mode === '전주') { const day = today.getDay(); const mon = new Date(today); mon.setDate(today.getDate()-day-6); return { start: mon, end: new Date(new Date(mon).setDate(mon.getDate()+6)+86399999) }; }
  if (mode === '전달') { return { start: new Date(now.getFullYear(), now.getMonth()-1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) }; }
  if (mode === '일별') { return { start: today, end: new Date(today.getTime()+86399999) }; }
  if (mode === '주별') { const day = today.getDay(); const mon = new Date(today); mon.setDate(today.getDate()-(day===0?6:day-1)); return { start: mon, end: new Date(today.getTime()+86399999) }; }
  if (mode === '월별') { return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(today.getTime()+86399999) }; }
  return null;
}

function filterByPeriod(rows: Row[], mode: string, customStart: string, customEnd: string) {
  if (!mode && !customStart) return rows;
  let start: Date, end: Date;
  if (customStart) { start = new Date(customStart); end = customEnd ? new Date(customEnd+'T23:59:59') : new Date(); }
  else { const r = getRange(mode); if (!r) return rows; start = r.start; end = r.end; }
  return rows.filter(r => { const d = new Date(r.created_at); return d >= start && d <= end; });
}

function cnt(rows: Row[], status: string, channel?: string) {
  return rows.filter(r => r.status === status && (channel ? r.channel === channel : true)).length;
}
function cntFrom(rows: Row[], from: string, channel?: string) {
  const idx = STATUS_ORDER.indexOf(from);
  const valid = STATUS_ORDER.slice(idx);
  return rows.filter(r => valid.includes(r.status) && (channel ? r.channel === channel : true)).length;
}
function rate(n: number, d: number) { return d === 0 ? 0 : Math.round((n/d)*100); }
function rateStr(n: number, d: number) { return d === 0 ? '-' : rate(n,d)+'%'; }

// ── 퍼널 카드 ─────────────────────────────────────────────
function FunnelCard({ label, rows, channel, onStepClick }: {
  label: string; rows: Row[]; channel?: string;
  onStepClick: (step: string, ch?: string) => void;
}) {
  const filtered = rows.filter(r => channel ? r.channel === channel : true);
  const total = filtered.length;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">{label}</h3>
        <span className="text-xs text-gray-400">총 {total}건</span>
      </div>
      <div className="space-y-1.5 mb-4">
        {FUNNEL_STEPS.map(step => {
          const count = cnt(rows, step.key, channel);
          const pct = total > 0 ? Math.round((count/total)*100) : 0;
          return (
            <button key={step.key} className="w-full flex items-center gap-2 hover:bg-gray-50 rounded px-1 py-0.5 group" onClick={() => onStepClick(step.key, channel)}>
              <div className="w-[72px] text-[11px] text-gray-500 shrink-0 text-right">{step.label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden relative">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: step.color }} />
                {count > 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-700">{count}건</span>}
              </div>
              <div className="w-[28px] text-[10px] text-gray-400 shrink-0">{pct}%</div>
            </button>
          );
        })}
      </div>
      <div className="border-t border-gray-100 pt-3 space-y-1">
        {CONVERSION_POINTS.map(cp => (
          <div key={cp.label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{cp.label}</span>
            <span className="font-bold" style={{ color: cp.color }}>{rateStr(cntFrom(rows, cp.to, channel), cntFrom(rows, cp.from, channel))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 채널 비교 차트 ────────────────────────────────────────
function ChannelCompareChart({ rows }: { rows: Row[] }) {
  // 퍼널 단계별 채널 비교 막대차트
  const barData = FUNNEL_STEPS.map(step => {
    const obj: any = { name: step.label };
    CHANNELS.forEach(ch => { obj[ch] = cnt(rows, step.key, ch); });
    return obj;
  });

  // 전환율 레이더 차트
  const radarData = CONVERSION_POINTS.map(cp => {
    const obj: any = { subject: cp.label };
    CHANNELS.forEach(ch => {
      obj[ch] = rate(cntFrom(rows, cp.to, ch), cntFrom(rows, cp.from, ch));
    });
    return obj;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 단계별 채널 비교 막대 */}
      <SectionCard title="단계별 채널 비교">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ left: -20 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            {CHANNELS.map(ch => (
              <Bar key={ch} dataKey={ch} fill={CHANNEL_COLORS[ch]} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* 전환율 레이더 비교 */}
      <SectionCard title="전환율 채널 비교">
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            {CHANNELS.map(ch => (
              <Radar key={ch} name={ch} dataKey={ch} stroke={CHANNEL_COLORS[ch]} fill={CHANNEL_COLORS[ch]} fillOpacity={0.3} />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

// ── 기간 비교 ─────────────────────────────────────────────
function PeriodCompareChart({ allRows }: { allRows: Row[] }) {
  const comparePairs = [
    { a: '일별', b: '전일', labelA: '오늘', labelB: '전일' },
    { a: '주별', b: '전주', labelA: '이번주', labelB: '전주' },
    { a: '월별', b: '전달', labelA: '이번달', labelB: '전달' },
  ];

  const data = comparePairs.map(pair => {
    const rA = getRange(pair.a);
    const rB = getRange(pair.b);
    const rowsA = rA ? allRows.filter(r => { const d = new Date(r.created_at); return d >= rA.start && d <= rA.end; }) : [];
    const rowsB = rB ? allRows.filter(r => { const d = new Date(r.created_at); return d >= rB.start && d <= rB.end; }) : [];
    return {
      기간: pair.labelA + ' vs ' + pair.labelB,
      [pair.labelA]: rowsA.length,
      [pair.labelB]: rowsB.length,
      성공A: cnt(rowsA, '상담성공') + cnt(rowsA, '예약완료') + cnt(rowsA, '개통완료'),
      성공B: cnt(rowsB, '상담성공') + cnt(rowsB, '예약완료') + cnt(rowsB, '개통완료'),
      labelA: pair.labelA,
      labelB: pair.labelB,
    };
  });

  return (
    <SectionCard title="기간 비교 (인입 vs 성공건수)">
      <div className="grid grid-cols-3 gap-4">
        {data.map(d => (
          <div key={d.기간} className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-600 mb-3">{d.기간}</div>
            <div className="space-y-2">
              {[d.labelA, d.labelB].map((label, i) => {
                const total = i === 0 ? d[d.labelA as any] : d[d.labelB as any];
                const success = i === 0 ? d.성공A : d.성공B;
                const diff = i === 1 ? (d[d.labelA as any] as number) - (d[d.labelB as any] as number) : null;
                return (
                  <div key={label} className={`rounded-lg p-3 ${i === 0 ? 'bg-pink-50 border border-pink-100' : 'bg-white border border-gray-100'}`}>
                    <div className="text-[10px] text-gray-400 mb-1">{label}</div>
                    <div className="flex items-end gap-2">
                      <span className="text-xl font-bold text-gray-800">{total}</span>
                      <span className="text-xs text-gray-500 mb-0.5">인입</span>
                      <span className="text-sm font-semibold text-emerald-600 mb-0.5 ml-auto">{success}건 성공</span>
                    </div>
                    {diff !== null && (
                      <div className={`text-[10px] mt-1 font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {diff > 0 ? `▲ ${diff}건 증가` : diff < 0 ? `▼ ${Math.abs(diff)}건 감소` : '변동 없음'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ── 그래프 드로어 ─────────────────────────────────────────
function GraphDrawer({ rows, step, channel, onClose }: { rows: Row[]; step: string; channel?: string; onClose: () => void }) {
  const stepInfo = FUNNEL_STEPS.find(s => s.key === step);
  const chartData = useMemo(() => {
    const filtered = rows.filter(r => r.status === step && (channel ? r.channel === channel : true));
    const byDate: Record<string, number> = {};
    filtered.forEach(r => {
      const d = new Date(r.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
      byDate[d] = (byDate[d] ?? 0) + 1;
    });
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }, [rows, step, channel]);
  const channelData = CHANNELS.map(ch => ({ channel: ch, count: cnt(rows, step, ch) }));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-4xl max-h-[65vh] overflow-y-auto shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold">{channel ?? '전체'} — {stepInfo?.label ?? step}</h2>
            <p className="text-sm text-gray-400 mt-0.5">총 {cnt(rows, step, channel)}건</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-4" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">일별 추이</div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [`${v}건`]} />
                  <Bar dataKey="count" fill={stepInfo?.color ?? '#a5b4fc'} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">데이터 없음</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">채널별 비교</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={channelData}>
                <XAxis dataKey="channel" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [`${v}건`]} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {channelData.map((d, i) => <Cell key={i} fill={CHANNEL_COLORS[d.channel] ?? '#e5e7eb'} />)}
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
  const [allRows, setAllRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [failStats, setFailStats] = useState<{ reason: string; count: number }[]>([]);
  const [periodMode, setPeriodMode] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [viewMode, setViewMode] = useState<'funnel' | 'compare' | 'period'>('funnel');
  const [graphStep, setGraphStep] = useState<string | null>(null);
  const [graphChannel, setGraphChannel] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('reservations').select('status, channel, created_at');
      if (error) throw error;
      setAllRows((data ?? []) as Row[]);
      const { data: fd } = await supabase.from('reservations').select('fail_reason:reservation_fail_reasons(reason)').eq('status','상담실패').not('fail_reason_id','is',null);
      const rc: Record<string,number> = {};
      (fd ?? []).forEach((r: any) => { const rs = r.fail_reason?.reason; if (rs) rc[rs] = (rc[rs]??0)+1; });
      setFailStats(Object.entries(rc).map(([reason,count]) => ({reason,count})).sort((a,b) => b.count-a.count));
    } catch (e: any) { toast.error('통계 로드 실패: ' + e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => filterByPeriod(allRows, periodMode, customStart, customEnd), [allRows, periodMode, customStart, customEnd]);
  const currentLabel = periodMode ? PERIOD_BTNS.find(b => b.value === periodMode)?.label : customStart ? `${customStart}${customEnd?' ~ '+customEnd:''}` : '전체';

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="사전예약 통계"
        description="채널별 퍼널 · 기간비교 · 채널비교 분석"
        rightSlot={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/reservations')} className="gap-1.5"><ArrowLeft className="size-4" /> 목록</Button>
            <Button variant="ghost" size="icon" onClick={load}><RotateCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          </div>
        }
      />

      {/* 뷰 모드 탭 */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { value: 'funnel',  label: '📊 퍼널 분석' },
          { value: 'compare', label: '🔀 채널 비교' },
          { value: 'period',  label: '📅 기간 비교' },
        ].map(m => (
          <button key={m.value} onClick={() => setViewMode(m.value as any)}
            className={`px-4 py-1.5 text-xs rounded-lg font-medium transition-colors ${viewMode === m.value ? 'bg-white text-pink-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* 날짜 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_BTNS.map(btn => (
              <button key={btn.value} onClick={() => { setPeriodMode(btn.value); setCustomStart(''); setCustomEnd(''); }}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${periodMode === btn.value && !customStart ? 'bg-white text-pink-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                {btn.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 ml-1">
            <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPeriodMode(''); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
            <span className="text-xs text-gray-400">~</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700" />
            {(customStart || periodMode) && (
              <button onClick={() => { setPeriodMode(''); setCustomStart(''); setCustomEnd(''); }} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                <X className="size-3" /> 초기화
              </button>
            )}
          </div>
          <span className="ml-auto text-xs text-gray-400">{currentLabel} · {rows.length}건</span>
        </div>
      </SectionCard>

      {/* 뷰 모드별 콘텐츠 */}
      {viewMode === 'funnel' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          <FunnelCard label="전체" rows={rows} onStepClick={(s) => { setGraphStep(s); setGraphChannel(undefined); }} />
          {CHANNELS.map(ch => (
            <FunnelCard key={ch} label={ch} rows={rows} channel={ch} onStepClick={(s, c) => { setGraphStep(s); setGraphChannel(c); }} />
          ))}
        </div>
      )}

      {viewMode === 'compare' && <ChannelCompareChart rows={rows} />}
      {viewMode === 'period' && <PeriodCompareChart allRows={allRows} />}

      {/* 실패 사유 (퍼널 모드에서만) */}
      {viewMode === 'funnel' && (
        <SectionCard title="상담실패 사유 분석">
          {failStats.length > 0 ? (
            <div className="space-y-2">
              {failStats.map(f => {
                const total = failStats.reduce((s,x) => s+x.count, 0);
                const pct = total > 0 ? Math.round((f.count/total)*100) : 0;
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
          ) : <div className="text-sm text-gray-400 text-center py-4">데이터가 없습니다</div>}
        </SectionCard>
      )}

      {graphStep && <GraphDrawer rows={rows} step={graphStep} channel={graphChannel} onClose={() => setGraphStep(null)} />}
    </div>
  );
}
