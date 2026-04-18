import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { Sparkles, Trophy, TrendingUp } from "lucide-react";
import {
  models,
  stackedChannelData,
  getChannelTop5,
  getChannelPolicyShare,
  channelModelData,
} from "@/data/channelModelData";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatKRW = (n: number) => "₩" + n.toLocaleString("ko-KR");

export const ChannelModelAnalysis = () => {
  const [selectedChannel, setSelectedChannel] = useState<string>("당근");
  const top5 = getChannelTop5(selectedChannel);
  const policyShare = getChannelPolicyShare();
  const selectedRow = channelModelData.find((r) => r.channel === selectedChannel);
  const channelTotal = selectedRow?.models.reduce((s, m) => s + m.count, 0) ?? 0;
  const channelAvgRebate = selectedRow
    ? Math.round(
        selectedRow.models.reduce((s, m) => s + m.avgRebate * m.count, 0) /
          selectedRow.models.reduce((s, m) => s + m.count, 0)
      )
    : 0;

  return (
    <section className="glass-strong rounded-2xl p-5 md:p-6 shadow-card-elevated">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary-glow animate-pulse" />
            채널 × 모델 교차 분석
          </div>
          <h2 className="mt-1.5 text-xl md:text-2xl font-bold tracking-tight">
            채널별 판매 모델 상세 현황
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            막대를 클릭해 해당 채널의 TOP 5 모델을 확인하세요
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          현재 선택 ·{" "}
          <span className="text-gradient font-bold text-sm">{selectedChannel}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Stacked Bar — 채널별 모델 판매 */}
        <div className="lg:col-span-3 glass rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight">채널별 모델 판매 비중</h4>
            <span className="text-[11px] text-muted-foreground">단위: 건</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackedChannelData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                onClick={(e: any) => {
                  if (e?.activeLabel) setSelectedChannel(e.activeLabel as string);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                  contentStyle={{
                    background: "hsl(240 18% 8% / 0.95)",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => [`${v}건`, name]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                />
                {models.map((m, i) => (
                  <Bar
                    key={m.name}
                    dataKey={m.name}
                    stackId="a"
                    fill={m.color}
                    radius={i === models.length - 1 ? [8, 8, 0, 0] : 0}
                    cursor="pointer"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 정책 vs 일반 (채널별 100% 누적) */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight">채널별 정책/일반 모델 비중</h4>
            <span className="text-[11px] text-muted-foreground">100% 기준</span>
          </div>
          <div className="space-y-3">
            {policyShare.map((p) => {
              const active = p.channel === selectedChannel;
              return (
                <button
                  key={p.channel}
                  onClick={() => setSelectedChannel(p.channel)}
                  className={cn(
                    "w-full text-left rounded-xl p-3 border transition-all",
                    active
                      ? "border-primary/40 bg-gradient-soft shadow-glow"
                      : "border-border/40 bg-card/30 hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium">{p.channel}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      총 {p.total}건
                    </span>
                  </div>
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/60">
                    <div
                      className="bg-gradient-primary transition-all duration-500"
                      style={{ width: `${p.strategyPct}%` }}
                      title={`정책 ${p.strategyPct}%`}
                    />
                    <div
                      className="bg-muted-foreground/50 transition-all duration-500"
                      style={{ width: `${p.generalPct}%` }}
                      title={`일반 ${p.generalPct}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1.5 tabular-nums">
                    <span className="text-primary-glow font-semibold">
                      정책 {p.strategyPct}% ({p.strategy})
                    </span>
                    <span className="text-muted-foreground">
                      일반 {p.generalPct}% ({p.general})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TOP 5 + 채널 요약 */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="text-xs text-muted-foreground">선택된 채널</div>
          <div className="mt-1 text-2xl font-bold text-gradient">{selectedChannel}</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-card/40 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <TrendingUp className="size-3" /> 총 판매
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums">
                {channelTotal}
                <span className="text-xs text-muted-foreground ml-1">건</span>
              </div>
            </div>
            <div className="rounded-xl bg-card/40 border border-border/40 p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="size-3" /> 건당 평균 리베이트
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-secondary">
                {formatKRW(channelAvgRebate)}
              </div>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
            막대그래프 또는 우측 채널 카드를 클릭하면 해당 채널 기준으로 TOP 5와 평균 리베이트가 갱신됩니다.
          </div>
        </div>

        <div className="lg:col-span-3 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <Trophy className="size-4 text-primary-glow" />
              {selectedChannel} · 판매 모델 TOP 5
            </h4>
            <span className="text-[11px] text-muted-foreground">건수 기준</span>
          </div>

          <ul className="space-y-2">
            {top5.map((m, i) => {
              const pct = Math.round((m.count / channelTotal) * 100);
              return (
                <li
                  key={m.name}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/40 hover:border-primary/30 transition-colors"
                >
                  <div
                    className={cn(
                      "size-7 rounded-lg grid place-items-center text-xs font-bold tabular-nums",
                      i === 0
                        ? "bg-gradient-to-br from-amber-400/40 to-orange-500/10 text-amber-300 ring-1 ring-amber-400/40"
                        : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </div>
                  <span className="size-2.5 rounded-full" style={{ background: m.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{m.name}</span>
                      {m.isStrategy ? (
                        <Badge className="bg-gradient-primary border-0 text-primary-foreground text-[10px] h-5 px-1.5">
                          전략 모델
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-border text-muted-foreground text-[10px] h-5 px-1.5">
                          일반 모델
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      평균 리베이트 {formatKRW(m.avgRebate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">{m.count}건</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">{pct}%</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
};
