// ============================================================
// 사전예약 — 응답시간 분석 페이지
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { RotateCw, ArrowLeft, X, Clock, AlertTriangle, Zap, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, ComposedChart, Area,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { WorkReportHeader, SectionCard, KpiCard } from '@/pages/work-report/_shared';
import { fetchResponseTimeStats } from '@/services/responseTimeService';

const PERIOD_BTNS = [
  { label: '전체', value: '' },
  { label: '오늘', value: '일별' },
  { label: '이번주', value: '주별' },
  { label: '이번달', value: '월별' },
  { label: '전일', value: '전일' },
  { label: '전주', value: '전주' },
  { label: '전달', value: '전달' },
];

function getRange(mode: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (mode === '전일') { const d = new Date(today); d.setDate(d.getDate()-1); return { start: d.toISOString().split('T')[0], end: d.toISOString().split('T')[0] }; }
  if (mode === '전주') { const day = today.getDay(); const mon = new Date(today); mon.setDate(today.getDate()-day-6); const sun = new Date(mon); sun.setDate(mon.getDate()+6); return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] }; }
  if (mode === '전달') { const s = new Date(now.getFullYear(), now.getMonth()-1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0] }; }
  if (mode === '일별') { const d = today.toISOString().split('T')[0]; return { start: d, end: d }; }
  if (mode === '주별') { const day = today.getDay(); const mon = new Date(today); mon.setDate(today.getDate()-(day===0?6:day-1)); return { start: mon.toISOString().split('T')[0], end: today.toISOString().split('T')[0] }; }
  if (mode === '월별') { const s = new Date(now.getFullYear(), now.getMonth(), 1); return { start: s.toISOString().split('T')[0], end: today.toISOString().split('T')[0] }; }
  return { start: '', end: '' };
}

function fmtMin(min: number) {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

const DAY_COLORS: Record<string, string> = {
  '일': '#fca5a5', '월': '#93c5fd', '화': '#86efac', '수': '#fcd34d',
  '목': '#c4b5fd', '금': '#f9a8d4', '토': '#a5b4fc',
};

export default function ResponseTimePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchResponseTimeStats>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodMode, setPeriodMode] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let start = customStart, end = customEnd;
      if (!start && periodMode) { const r = getRange(periodMode); start = r.start; end = r.end; }
      const data = await fetchResponseTimeStats(start || undefined, end || undefined);
      setStats(data);
    } catch (e: any) {
      toast.error('로드 실패: ' + e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [periodMode, customStart, customEnd]);

  const currentLabel = periodMode ? PERIOD_BTNS.find(b => b.value === periodMode)?.label :
    customStart ? `${customStart}${customEnd ? ' ~ ' + customEnd : ''}` : '전체';

  // 시간대 히트맵 데이터 (9~20시만)
  const heatmapData = useMemo(() => {
    if (!stats) return [];
    return Array.from({ length: 24 }, (_, h) => {
      const found = stats.hourlyDist.find(d => d.hour === h);
      return { hour: `${h}시`, count: found?.count ?? 0, avgMin: found?.avgMin ?? 0, isWork: h >= 9 && h < 20 };
    }).filter(d => d.isWork || d.count > 0);
  }, [stats]);

  if (!stats && !loading) return <div className="p-6 text-gray-400">데이터가 없습니다</div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <WorkReportHeader
        title="첫 대응 응답시간 분석"
        description="인입 → 첫 케어까지 걸린 시간 · 근무시간 기준 (월~토 09:30~20:00)"
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

      {/* 기간 필터 */}
      <SectionCard>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_BTNS.map(btn => (
              <button key={btn.value} onClick={() => { setPeriodMode(btn.value); setCustomStart(''); setCustomEnd(''); }}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                  periodMode === btn.value && !customStart ? 'bg-white text-pink-600 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
                }`}>{btn.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input type="date" value={customStart} onChange={e => { setCustomStart(e.target.value); setPeriodMode(''); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
            <span className="text-xs text-gray-400">~</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
            {(customStart || periodMode) && (
              <button onClick={() => { setPeriodMode(''); setCustomStart(''); setCustomEnd(''); }}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                <X className="size-3" /> 초기화
              </button>
            )}
          </div>
          <span className="ml-auto text-xs text-gray-400">{currentLabel} · {stats?.summary.totalCount ?? 0}건</span>
        </div>
      </SectionCard>

      {loading && <div className="text-center py-8 text-sm text-gray-400">로딩 중...</div>}

      {stats && (
        <>
          {/* KPI 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="size-4 text-pink-500" />
                <span className="text-xs text-gray-500 font-medium">팀 평균 응답</span>
              </div>
              <div className="text-2xl font-bold text-pink-600">{fmtMin(stats.summary.teamAvgMin)}</div>
              <div className="text-[10px] text-gray-400 mt-1">첫 케어까지 평균 시간</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="size-4 text-red-500" />
                <span className="text-xs text-gray-500 font-medium">1시간 이상 미대응</span>
              </div>
              <div className="text-2xl font-bold text-red-500">{stats.summary.over1hCount}건</div>
              <div className="text-[10px] text-gray-400 mt-1">60분 초과 대응 건수</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="size-4 text-yellow-500" />
                <span className="text-xs text-gray-500 font-medium">🦸 워커홀릭</span>
              </div>
              <div className="text-2xl font-bold text-yellow-500">{stats.summary.workaholicCount}건</div>
              <div className="text-[10px] text-gray-400 mt-1">일요일 대응 건수</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="size-4 text-blue-500" />
                <span className="text-xs text-gray-500 font-medium">총 대응 건수</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{stats.summary.totalCount}건</div>
              <div className="text-[10px] text-gray-400 mt-1">기간 내 첫 케어 완료</div>
            </div>
          </div>

          {/* 담당자별 */}
          <SectionCard title="👤 담당자별 응답시간">
            {stats.byStaff.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">데이터가 없습니다</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="px-3 py-2 text-left">담당자</th>
                      <th className="px-3 py-2 text-center">평균</th>
                      <th className="px-3 py-2 text-center">최소</th>
                      <th className="px-3 py-2 text-center">최대</th>
                      <th className="px-3 py-2 text-center">건수</th>
                      <th className="px-3 py-2 text-center">1시간+</th>
                      <th className="px-3 py-2 text-center">🦸워커홀릭</th>
                      <th className="px-3 py-2 text-center">근무외</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byStaff.map((s, i) => (
                      <tr key={s.staff_id} className={`border-t border-gray-50 ${i === 0 ? 'bg-emerald-50' : ''}`}>
                        <td className="px-3 py-2.5 font-medium">
                          {i === 0 && <span className="text-xs text-emerald-600 mr-1">🏆</span>}
                          {s.display_name}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-bold ${s.avg_minutes > 60 ? 'text-red-500' : s.avg_minutes > 30 ? 'text-orange-500' : 'text-emerald-600'}`}>
                            {fmtMin(s.avg_minutes)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{fmtMin(s.min_minutes)}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{fmtMin(s.max_minutes)}</td>
                        <td className="px-3 py-2.5 text-center text-gray-600">{s.total_count}</td>
                        <td className="px-3 py-2.5 text-center">
                          {s.over_1h_count > 0 ? <span className="text-red-500 font-semibold">{s.over_1h_count}</span> : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {s.workaholic_count > 0 ? <span className="text-yellow-500 font-semibold">🦸 {s.workaholic_count}</span> : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {s.after_hours_count > 0 ? <span className="text-orange-400">{s.after_hours_count}</span> : <span className="text-gray-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 시간대별 분포 */}
            <SectionCard title="⏰ 시간대별 인입 & 응답시간">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={heatmapData}>
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="분" />
                  <Tooltip formatter={(v: any, name: string) => [name === '인입건수' ? `${v}건` : `${v}분`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="count" name="인입건수" fill="#f9a8d4" radius={[3,3,0,0]}>
                    {heatmapData.map((d, i) => (
                      <Cell key={i} fill={!d.isWork ? '#e5e7eb' : d.count > 5 ? '#ec4899' : '#f9a8d4'} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="avgMin" name="평균응답(분)" stroke="#6366f1" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="text-[10px] text-gray-400 mt-1">회색 = 근무시간 외</div>
            </SectionCard>

            {/* 요일별 분포 */}
            <SectionCard title="📅 요일별 인입 & 응답시간">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={stats.weekdayDist}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="분" />
                  <Tooltip formatter={(v: any, name: string) => [name === '인입건수' ? `${v}건` : `${v}분`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="count" name="인입건수" radius={[3,3,0,0]}>
                    {stats.weekdayDist.map((d, i) => (
                      <Cell key={i} fill={d.day === '일' ? '#fca5a5' : DAY_COLORS[d.day] ?? '#e5e7eb'} />
                    ))}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="avgMin" name="평균응답(분)" stroke="#6366f1" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="text-[10px] text-red-400 mt-1">빨간색(일) = 정상 근무일 아님 🦸</div>
            </SectionCard>
          </div>

          {/* 일별 추이 */}
          <SectionCard title="📈 일별 응답시간 추이">
            {stats.dailyTrend.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-6">데이터가 없습니다</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={stats.dailyTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="분" />
                  <Tooltip formatter={(v: any, name: string) => {
                    if (name === '인입건수') return [`${v}건`, name];
                    if (name === '1시간+') return [`${v}건`, '1시간 이상 미대응'];
                    return [`${v}분`, name];
                  }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="count" name="인입건수" fill="#f9a8d4" radius={[3,3,0,0]} />
                  <Bar yAxisId="left" dataKey="over1h" name="1시간+" fill="#fca5a5" radius={[3,3,0,0]} />
                  <Line yAxisId="right" type="monotone" dataKey="avgMin" name="평균응답(분)" stroke="#6366f1" dot={{ r: 3 }} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
