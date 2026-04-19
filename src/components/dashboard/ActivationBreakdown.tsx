import { Card } from "@/components/ui/card";
import { Smartphone, Sparkles } from "lucide-react";
import { mobileBreakdownStats, strategyProductStats } from "@/data/mockData";

export const ActivationBreakdown = () => {
  const totalMobile = mobileBreakdownStats.reduce((s, r) => s + r.count, 0);
  const totalStrategy = strategyProductStats.reduce((s, r) => s + r.count, 0);
  const maxStrategy = Math.max(...strategyProductStats.map((s) => s.count));

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {/* 모바일 유형 */}
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-primary/10 grid place-items-center">
              <Smartphone className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">모바일 유형별 건수</h3>
              <p className="text-[11px] text-muted-foreground">MNP · 기변 · 신규</p>
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
  );
};
