import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Sun, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { summaryStats } from "@/data/mockData";

const Delta = ({ value }: { value: number }) => {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 text-xs font-semibold " +
        (positive ? "text-success" : "text-destructive")
      }
    >
      <Icon className="size-3.5" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

export const HeroPerformance = () => {
  const { monthlyTarget, monthlyActivations, todayActivations, todayDelta, newRegularsDelta } =
    summaryStats;
  const achievement = Math.min(100, Math.round((monthlyActivations / monthlyTarget) * 100));

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* 1. 당월 목표 달성률 — 가장 큰 카드 */}
      <Card className="lg:col-span-1 p-7 glass relative overflow-hidden">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-gradient-primary opacity-10 blur-2xl" />
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Target className="size-4 text-primary" />
          당월 목표 달성률
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-6xl font-bold text-gradient tabular-nums leading-none">
            {achievement}
          </span>
          <span className="text-2xl font-semibold text-foreground">%</span>
        </div>
        <Progress value={achievement} className="mt-5 h-3" />
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {monthlyActivations.toLocaleString()}
            </span>{" "}
            / {monthlyTarget.toLocaleString()} 건
          </span>
          <span className="text-xs text-muted-foreground">
            잔여{" "}
            <span className="font-semibold text-foreground">
              {(monthlyTarget - monthlyActivations).toLocaleString()}
            </span>
            건
          </span>
        </div>
      </Card>

      {/* 2. 오늘의 개통 */}
      <Card className="p-7 glass relative overflow-hidden">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sun className="size-4 text-warning" />
          오늘의 개통
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-6xl font-bold text-foreground tabular-nums leading-none">
            {todayActivations}
          </span>
          <span className="text-xl text-muted-foreground">건</span>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Delta value={todayDelta} />
          <span className="text-xs text-muted-foreground">전일 대비</span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">실시간 동기화 중</div>
      </Card>

      {/* 3. 누적 개통 */}
      <Card className="p-7 glass relative overflow-hidden">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <TrendingUp className="size-4 text-success" />
          누적 개통 (당월)
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-6xl font-bold text-foreground tabular-nums leading-none">
            {monthlyActivations}
          </span>
          <span className="text-xl text-muted-foreground">건</span>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <Delta value={newRegularsDelta} />
          <span className="text-xs text-muted-foreground">전월 동기 대비</span>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">목표까지 {100 - achievement}% 남음</div>
      </Card>
    </section>
  );
};
