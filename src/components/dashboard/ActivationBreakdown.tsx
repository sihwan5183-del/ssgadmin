import { Card } from "@/components/ui/card";
import { Smartphone, Sparkles, CreditCard } from "lucide-react";
import { mobileBreakdownStats, strategyProductStats, usimChannelStats } from "@/data/mockData";

export const ActivationBreakdown = () => {
  const totalMobile = mobileBreakdownStats.reduce((s, r) => s + r.count, 0);
  const totalStrategy = strategyProductStats.reduce((s, r) => s + r.count, 0);
  const maxStrategy = Math.max(1, ...strategyProductStats.map((s) => s.count));
  const totalUsim = usimChannelStats.reduce((s, r) => s + r.count, 0);
  const maxUsim = Math.max(1, ...usimChannelStats.map((r) => r.count));

  return (
    <>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* 모바일 유형 (MNP / 기변만) */}
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-primary/10 grid place-items-center">
                <Smartphone className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">모바일 유형별 건수</h3>
                <p className="text-[11px] text-muted-foreground">MNP · 기변</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">합계</div>
              <div className="font-bold tabular-nums">{totalMobile.toLocaleString()}건</div>
            </div>
          </div>

          <div className="space-y-4">
            {mobileBreakdownStats.map((row) => (
              <div key={row.label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm font-medium">{row.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                      {row.count.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">건</span>
                    <span className="text-xs text-primary font-semibold tabular-nums w-12 text-right">
                      {row.share.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-gradient-primary rounded-full transition-all"
                    style={{ width: `${row.share}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 전략 상품 */}
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-success/10 grid place-items-center">
                <Sparkles className="size-4 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">전략 상품 건수</h3>
                <p className="text-[11px] text-muted-foreground">인터넷 · TV프리 · IOT · 대명</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">합계</div>
              <div className="font-bold tabular-nums">{totalStrategy.toLocaleString()}건</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {strategyProductStats.map((row) => {
              const ratio = (row.count / maxStrategy) * 100;
              return (
                <div
                  key={row.label}
                  className="p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-accent/30 transition-colors"
                >
                  <div className="text-xs text-muted-foreground">{row.label}</div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tabular-nums">{row.count}</span>
                    <span className="text-xs text-muted-foreground">건</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* USIM 단독개통 — 채널별 */}
      <section className="mb-6">
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-warning/10 grid place-items-center">
                <CreditCard className="size-4 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">USIM 단독개통 (USIM MNP) · 채널별</h3>
                <p className="text-[11px] text-muted-foreground">
                  유심만 개통한 건은 모두 USIM MNP — 인입 경로별 집계
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">합계</div>
              <div className="font-bold tabular-nums text-lg">
                {totalUsim.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">건</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {usimChannelStats.map((row) => {
              const ratio = (row.count / maxUsim) * 100;
              return (
                <div
                  key={row.channel}
                  className="p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: row.color }}
                    />
                    <span className="text-xs font-medium">{row.channel}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums">{row.count}</span>
                    <span className="text-[11px] text-muted-foreground">건</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${ratio}%`, background: row.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </>
  );
};
