import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Legend,
} from "recharts";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { useModelAnalysis } from "@/hooks/useModelAnalysis";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const formatKRW = (n: number) => "₩" + n.toLocaleString("ko-KR");
const formatShortKRW = (n: number) => {
  if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `₩${(n / 10_000).toFixed(0)}만`;
  return formatKRW(n);
};

const MAKER_COLORS: Record<string, string> = {
  삼성: "hsl(220 80% 55%)",
  애플: "hsl(0 0% 45%)",
  기타: "hsl(200 10% 50%)",
};

const CHART_PAGE_SIZE = 8;
const RANK_PAGE_SIZE = 8;

export const OverallModelAnalysis = () => {
  const { overallStats: stats, totalCount, loading, hasData } = useModelAnalysis();
  const [chartPage, setChartPage] = useState(0);
  const [rankPage, setRankPage] = useState(0);
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
        <div className="flex gap-1.5 text-[11px]">
          <div className="rounded-lg bg-card/50 border border-border/40 px-2.5 py-1">
            <div className="text-muted-foreground text-[10px]">총 개통</div>
            <div className="font-semibold tabular-nums text-xs">{totalCount.toLocaleString()}건</div>
          </div>
          <div className="rounded-lg bg-card/50 border border-border/40 px-2.5 py-1">
            <div className="text-muted-foreground text-[10px]">전략 비중</div>
            <div className="font-semibold tabular-nums text-xs text-primary-glow">{strategyPct}%</div>
          </div>
          <div className="rounded-lg bg-card/50 border border-border/40 px-2.5 py-1">
            <div className="text-muted-foreground text-[10px]">총 리베이트</div>
            <div className="font-semibold tabular-nums text-xs text-secondary">{formatShortKRW(totalRevenue)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bar — 모델별 총 판매 (채널별 차트와 동일한 스타일) */}
        <div className="lg:col-span-3 glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold tracking-tight">모델별 총 판매 비중</h4>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">
                {chartPage + 1}/{Math.max(1, Math.ceil(stats.length / CHART_PAGE_SIZE))}
              </span>
              <Button variant="ghost" size="icon" className="size-6"
                disabled={chartPage === 0}
                onClick={() => setChartPage(p => p - 1)}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-6"
                disabled={(chartPage + 1) * CHART_PAGE_SIZE >= stats.length}
                onClick={() => setChartPage(p => p + 1)}>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
          {(() => {
            const paged = stats.slice(chartPage * CHART_PAGE_SIZE, (chartPage + 1) * CHART_PAGE_SIZE);
            return (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paged} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="petName"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={({ x, y, payload }) => {
                    const label = String(payload.value);
                    const short = label.length > 10 ? label.slice(0, 9) + "…" : label;
                    return (
                      <text x={x} y={(y as number) + 12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10}>
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
                  formatter={(v: number, _n, p: any) => [
                    `${v}건 · 점유율 ${p.payload.share.toFixed(1)}%`,
                    p.payload.name,
                  ]}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {paged.map((m) => (
                    <Cell key={m.name} fill={m.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
            );
          })()}
        </div>

        {/* 모델 랭킹 리스트 */}
        <div className="lg:col-span-2 glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold tracking-tight flex items-center gap-1.5">
              <Trophy className="size-3.5 text-primary-glow" />
              전체 모델 랭킹
            </h4>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">
                {rankPage + 1}/{Math.max(1, Math.ceil(stats.length / RANK_PAGE_SIZE))}
              </span>
              <Button variant="ghost" size="icon" className="size-6"
                disabled={rankPage === 0}
                onClick={() => setRankPage(p => p - 1)}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-6"
                disabled={(rankPage + 1) * RANK_PAGE_SIZE >= stats.length}
                onClick={() => setRankPage(p => p + 1)}>
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>

          <ul className="space-y-1">
            {stats.slice(rankPage * RANK_PAGE_SIZE, (rankPage + 1) * RANK_PAGE_SIZE).map((m, _pi) => {
              const i = rankPage * RANK_PAGE_SIZE + _pi;
              const isTop3 = i < 3;
              return (
              <li
                key={m.name}
                className={cn(
                  "flex items-center gap-2.5 p-2 rounded-lg border transition-colors",
                  isTop3
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card/40 border-border/40 hover:border-primary/30"
                )}
              >
                <div
                  className={cn(
                    "size-6 rounded-md grid place-items-center text-[11px] font-bold tabular-nums shrink-0",
                    i === 0
                      ? "bg-gradient-to-br from-amber-200 to-orange-100 text-amber-700 ring-1 ring-amber-400"
                      : i === 1
                      ? "bg-gradient-to-br from-slate-300/30 to-slate-500/10 text-slate-200 ring-1 ring-slate-300/30"
                      : i === 2
                      ? "bg-gradient-to-br from-orange-400/30 to-amber-700/10 text-orange-300 ring-1 ring-orange-400/30"
                      : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {i + 1}
                </div>
                <span
                  className="shrink-0 rounded text-[9px] font-bold px-1 py-0.5 leading-none"
                  style={{
                    background: MAKER_COLORS[m.maker] ?? MAKER_COLORS["기타"],
                    color: "#fff",
                  }}
                >
                  {m.maker === "삼성" ? "S" : m.maker === "애플" ? "A" : "·"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={cn("text-xs truncate", isTop3 ? "font-bold" : "font-medium")}>{m.petName}</span>
                    {m.isStrategy && (
                      <Badge className="bg-gradient-primary border-0 text-primary-foreground text-[9px] h-3.5 px-1">
                        전략
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("tabular-nums", isTop3 ? "text-xs font-bold" : "text-xs font-medium")}>{m.count}건</div>
                  <div className="text-[9px] text-muted-foreground tabular-nums">{m.share.toFixed(1)}%</div>
                </div>
              </li>
              );
            })}
          </ul>

          {topModel && (
            <div className="mt-2 rounded-lg bg-gradient-soft border border-primary/30 p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Sparkles className="size-3 text-primary-glow" /> 베스트셀러
              </div>
              <div className="mt-0.5 flex items-baseline justify-between">
                <span className="font-bold text-xs">{topModel.petName}</span>
                <span className="text-[11px] text-primary-glow font-semibold tabular-nums">
                  <TrendingUp className="size-3 inline mr-0.5" />{topModel.share.toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
