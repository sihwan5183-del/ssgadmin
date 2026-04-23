import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Sparkles, Trophy, TrendingUp } from "lucide-react";
import { useModelAnalysis, resolvePetName, seriesName } from "@/hooks/useModelAnalysis";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const formatKRW = (n: number) => n.toLocaleString("ko-KR") + "원";

const MAKER_COLORS: Record<string, string> = {
  삼성: "hsl(220 80% 55%)",
  애플: "hsl(0 0% 45%)",
  기타: "hsl(200 10% 50%)",
};

export const ChannelModelAnalysis = () => {
  const { channelData, stackedData, modelsInfo, policyShare, getTop5, hasData, matchModel } = useModelAnalysis();
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [detailModel, setDetailModel] = useState<any>(null);

  // auto-select first channel when data arrives
  const effectiveChannel = selectedChannel || (channelData[0]?.channel ?? "");
  const top5 = getTop5(effectiveChannel);
  const selectedRow = channelData.find((r) => r.channel === effectiveChannel);
  const channelTotal = selectedRow?.models.reduce((s, m) => s + m.count, 0) ?? 0;
  const channelAvgRebate = selectedRow && channelTotal > 0
    ? Math.round(selectedRow.models.reduce((s, m) => s + m.avgRebate * m.count, 0) / channelTotal)
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
          <span className="text-gradient font-bold text-sm">{effectiveChannel || "데이터 없음"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Stacked Bar — 채널별 모델 판매 */}
        <div className="lg:col-span-3 rounded-2xl p-5 bg-card/20 border border-border/30">
          <div className="flex items-baseline justify-between mb-3">
            <h4 className="text-base font-semibold tracking-tight">채널별 모델 판매 비중</h4>
            <span className="text-[11px] text-muted-foreground">단위: 건</span>
          </div>
          <div className="h-80 overflow-x-auto">
            <div style={{ minWidth: Math.max(stackedData.length * 100, 400) }} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackedData}
                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                barSize={stackedData.length <= 4 ? 60 : 40}
                onClick={(e: any) => {
                  if (e?.activeLabel) setSelectedChannel(e.activeLabel as string);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" vertical={false} />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--primary) / 0.06)" }}
                  contentStyle={{
                    background: "hsl(240 18% 8% / 0.95)",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 13,
                    padding: "10px 14px",
                  }}
                  formatter={(v: number, name: string) => [
                    <span className="font-bold">{v}건</span>,
                    name,
                  ]}
                />
                {modelsInfo.map((m, i) => (
                  <Bar
                    key={m.name}
                    dataKey={m.name}
                    stackId="a"
                    fill={m.color}
                    radius={i === modelsInfo.length - 1 ? [6, 6, 0, 0] : 0}
                    cursor="pointer"
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
          {/* Compact legend — top 5 + 기타 only */}
          <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
            {modelsInfo.map((m) => (
              <div key={m.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                {m.name}
              </div>
            ))}
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
                    p.channel === effectiveChannel
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
          <div className="mt-1 text-2xl font-bold text-gradient">{effectiveChannel || "데이터 없음"}</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-card/40 border border-border/40 p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <TrendingUp className="size-3" /> 총판매
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums">
                {channelTotal}
                <span className="text-xs text-muted-foreground ml-1">건</span>
              </div>
            </div>
            <div className="rounded-lg bg-card/40 border border-border/40 p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Sparkles className="size-3" /> 건당 평균
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-secondary">
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
              {effectiveChannel} · 판매 모델 TOP 5
            </h4>
            <span className="text-[11px] text-muted-foreground">건수 기준</span>
          </div>

          <ul className="space-y-1">
            {top5.map((m, i) => {
              const maker = resolvePetName(m.name, matchModel).maker;
              const pct = channelTotal > 0 ? Math.round((m.count / channelTotal) * 100) : 0;
              const isTop3 = i < 3;
              return (
                <li
                  key={m.name}
                  className={cn(
                    "flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer",
                    isTop3
                      ? "bg-primary/5 border-primary/20"
                      : "bg-card/40 border-border/40 hover:border-primary/30"
                  )}
                  onClick={() => {
                    if ((m as any).rawModels?.length > 1) setDetailModel(m);
                  }}
                  title={(m as any).rawModels?.length > 1 ? "클릭하여 상세 스펙 보기" : undefined}
                >
                  <div
                    className={cn(
                      "size-6 rounded-md grid place-items-center text-[11px] font-bold tabular-nums shrink-0",
                      i === 0
                        ? "bg-gradient-to-br from-amber-400/40 to-orange-500/10 text-amber-300 ring-1 ring-amber-400/40"
                        : "bg-muted/60 text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </div>
                  <span
                    className="shrink-0 rounded text-[9px] font-bold px-1 py-0.5 leading-none"
                    style={{
                      background: MAKER_COLORS[maker] ?? MAKER_COLORS["기타"],
                      color: "#fff",
                    }}
                  >
                    {maker === "삼성" ? "S" : maker === "애플" ? "A" : "·"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn("text-xs truncate", isTop3 ? "font-bold" : "font-medium")}>{m.name}</span>
                      {m.isStrategy ? (
                        <Badge className="bg-gradient-primary border-0 text-primary-foreground text-[9px] h-3.5 px-1">
                          전략
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-border text-muted-foreground text-[9px] h-3.5 px-1">
                          일반
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      평균 {formatKRW(m.avgRebate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("tabular-nums", isTop3 ? "text-xs font-bold" : "text-xs font-medium")}>{m.count}건</div>
                    <div className="text-[9px] text-muted-foreground tabular-nums">{pct}%</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Detail popup for raw model breakdown */}
      <Dialog open={!!detailModel} onOpenChange={(v) => !v && setDetailModel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{detailModel?.name} — 상세 스펙 내역</DialogTitle>
          </DialogHeader>
          <ul className="space-y-1.5 max-h-60 overflow-y-auto">
            {(detailModel?.rawModels ?? []).map((rm: string) => (
              <li key={rm} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30 border border-border/30">
                <span>{rm}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
};
