import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Legend,
} from "recharts";
import { Sparkles, TrendingUp, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDashboardModelAnalytics } from "@/hooks/useDashboardModelAnalytics";

const formatKRW = (n: number) => "₩" + n.toLocaleString("ko-KR");
const formatShortKRW = (n: number) => {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${(n / 10_000).toFixed(0)}만`;
  return formatKRW(n);
};

export const OverallModelAnalysis = () => {
  const { models: stats, loading } = useDashboardModelAnalytics();
  const totalCount = stats.reduce((s, m) => s + m.count, 0);
  const totalRevenue = stats.reduce((s, m) => s + m.revenue, 0);
  const strategyCount = stats.filter((m) => m.isStrategy).reduce((s, m) => s + m.count, 0);
  const strategyPct = totalCount > 0 ? Math.round((strategyCount / totalCount) * 100) : 0;
  const topModel = stats[0];

  return (
    <section className="glass-strong rounded-2xl p-5 md:p-6 shadow-card-elevated">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-secondary animate-pulse" />
            전체 합산 분석
          </div>
          <h2 className="mt-1.5 text-xl md:text-2xl font-bold tracking-tight">
            전체 모델별 개통 현황
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            모든 채널을 합산한 모델별 판매 건수 · 리베이트 기여도
          </p>
        </div>
        <div className="flex gap-2 text-[11px]">
          <div className="rounded-lg bg-card/50 border border-border/40 px-3 py-1.5">
            <div className="text-muted-foreground">총 개통</div>
            <div className="font-bold tabular-nums text-sm">{totalCount.toLocaleString()}건</div>
          </div>
          <div className="rounded-lg bg-card/50 border border-border/40 px-3 py-1.5">
            <div className="text-muted-foreground">전략 모델 비중</div>
            <div className="font-bold tabular-nums text-sm text-primary-glow">{strategyPct}%</div>
          </div>
          <div className="rounded-lg bg-card/50 border border-border/40 px-3 py-1.5">
            <div className="text-muted-foreground">총 리베이트</div>
            <div className="font-bold tabular-nums text-sm text-secondary">{formatShortKRW(totalRevenue)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bar — 모델별 총 판매 (채널별 차트와 동일한 스타일) */}
        <div className="lg:col-span-3 glass rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight">모델별 총 판매 비중</h4>
            <span className="text-[11px] text-muted-foreground">단위: 건</span>
          </div>
          <div className="h-80">
            {loading ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
            ) : stats.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">선택한 기간의 모델 데이터가 없습니다</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={({ x, y, payload }) => {
                      const label = String(payload.value);
                      const short = label.length > 8 ? label.slice(0, 7) + "…" : label;
                      return (
                        <text x={x} y={(y as number) + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>
                          {short}
                        </text>
                      );
                    }}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                    contentStyle={{
                      background: "hsl(240 18% 8% / 0.95)",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, p: any) => [`${v}건 · 점유율 ${p.payload.share.toFixed(1)}%`, p.payload.name]}
                  />
                  {(() => {
                    const LegendAny = Legend as any;
                    return (
                      <LegendAny
                        wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        iconType="circle"
                        payload={stats.map((m) => ({ value: m.name, type: "circle", id: m.name, color: m.color }))}
                      />
                    );
                  })()}
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {stats.map((m) => <Cell key={m.name} fill={m.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 모델 랭킹 리스트 */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <Trophy className="size-4 text-primary-glow" />
              전체 모델 랭킹
            </h4>
            <span className="text-[11px] text-muted-foreground">건수 기준</span>
          </div>

          <ul className="space-y-2">
            {stats.map((m, i) => (
              <li
                key={m.name}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-card/40 border border-border/40 hover:border-primary/30 transition-colors"
              >
                <div
                  className={cn(
                    "size-7 rounded-lg grid place-items-center text-xs font-bold tabular-nums shrink-0",
                    i === 0
                      ? "bg-gradient-to-br from-amber-400/40 to-orange-500/10 text-amber-300 ring-1 ring-amber-400/40"
                      : i === 1
                      ? "bg-gradient-to-br from-slate-300/30 to-slate-500/10 text-slate-200 ring-1 ring-slate-300/30"
                      : i === 2
                      ? "bg-gradient-to-br from-orange-400/30 to-amber-700/10 text-orange-300 ring-1 ring-orange-400/30"
                      : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                <span className="size-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm truncate">{m.name}</span>
                    {m.isStrategy && (
                      <Badge className="bg-gradient-primary border-0 text-primary-foreground text-[10px] h-4 px-1.5">
                        전략
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    평균 {formatKRW(m.avgRebate)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold tabular-nums">{m.count}건</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{m.share.toFixed(1)}%</div>
                </div>
              </li>
            ))}
          </ul>

          {topModel && (
            <div className="mt-3 rounded-xl bg-gradient-soft border border-primary/30 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3 text-primary-glow" /> 베스트 셀러
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-bold text-sm">{topModel.name}</span>
                <span className="text-xs text-primary-glow font-semibold tabular-nums">
                  <TrendingUp className="size-3 inline mr-0.5" />
                  {topModel.share.toFixed(1)}% 점유
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
