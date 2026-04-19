import { Card } from "@/components/ui/card";
import { Radio, Flame } from "lucide-react";
import { channelActivationStats } from "@/data/mockData";

export const ChannelActivationBreakdown = () => {
  const totalMonthly = channelActivationStats.reduce((s, r) => s + r.monthly, 0);
  const totalToday = channelActivationStats.reduce((s, r) => s + r.today, 0);
  const maxMonthly = Math.max(...channelActivationStats.map((r) => r.monthly));
  const topToday = [...channelActivationStats].sort((a, b) => b.today - a.today)[0];

  return (
    <section className="mb-6">
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-secondary/10 grid place-items-center">
              <Radio className="size-4 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">채널별 개통 현황</h3>
              <p className="text-[11px] text-muted-foreground">
                인입 경로별 당월 누적 · 오늘 개통
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">당월 합계</div>
              <div className="font-bold tabular-nums text-lg">
                {totalMonthly.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">건</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">오늘 합계</div>
              <div className="font-bold tabular-nums text-lg text-primary">
                {totalToday.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">건</span>
              </div>
            </div>
            {topToday && topToday.today > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Flame className="size-3.5" />
                오늘 1위 · {topToday.channel}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {channelActivationStats.map((row) => {
            const ratio = (row.monthly / maxMonthly) * 100;
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
                  <span className="text-2xl font-bold tabular-nums">
                    {row.monthly}
                  </span>
                  <span className="text-[11px] text-muted-foreground">건 누적</span>
                </div>

                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-semibold tabular-nums text-primary">
                    +{row.today}
                  </span>
                  <span className="text-[11px] text-muted-foreground">오늘</span>
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
  );
};
