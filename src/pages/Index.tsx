import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { HeroPerformance } from "@/components/dashboard/HeroPerformance";
import { RadialGoalGauge } from "@/components/dashboard/RadialGoalGauge";
import { StoreRevenueRanking } from "@/components/dashboard/StoreRevenueRanking";
import { StoreEfficiencyBubble } from "@/components/dashboard/StoreEfficiencyBubble";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { PlannerFeed } from "@/components/dashboard/PlannerFeed";
import { ActivationBreakdown } from "@/components/dashboard/ActivationBreakdown";
import { ChannelActivationBreakdown } from "@/components/dashboard/ChannelActivationBreakdown";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ChannelDonut } from "@/components/dashboard/ChannelDonut";
import { RankingPanel } from "@/components/dashboard/RankingPanel";
import { PerformanceLedger } from "@/components/dashboard/PerformanceLedger";
import { ChannelModelAnalysis } from "@/components/dashboard/ChannelModelAnalysis";
import { OverallModelAnalysis } from "@/components/dashboard/OverallModelAnalysis";
import { AdScheduleWidget } from "@/components/dashboard/AdScheduleWidget";
import { QuickLinksWidget } from "@/components/dashboard/QuickLinksWidget";
import { InventoryWidget } from "@/components/dashboard/InventoryWidget";
import { StrategyModelGauges } from "@/components/dashboard/StrategyModelGauges";
import { PendingItemsCard } from "@/components/dashboard/PendingItemsCard";
import { CashTodayCard } from "@/components/dashboard/CashTodayCard";
import { MyReviewAlerts } from "@/components/dashboard/MyReviewAlerts";
import { UntreatedLeadsCard } from "@/components/dashboard/UntreatedLeadsCard";
import { MyIncentiveWidget } from "@/components/dashboard/MyIncentiveWidget";
import { formatShortKRW } from "@/data/mockData";
import { TrendingUp, TrendingDown, Sparkles, Target } from "lucide-react";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { DashboardLayoutManager } from "@/components/dashboard/DashboardLayoutManager";
import { useRole } from "@/hooks/useRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useFinanceData } from "@/hooks/useFinanceData";
import { RevenueComposition } from "@/components/finance/RevenueComposition";
import { CategoryBreakdownChart } from "@/components/finance/CategoryBreakdownChart";
import { usePeriod } from "@/contexts/PeriodContext";
import { CalendarDays, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const isoToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const pctChange = (cur: number, prev: number): number | undefined => {
  if (!isFinite(cur) || !isFinite(prev)) return undefined;
  if (prev === 0) {
    if (cur === 0) return 0;
    return undefined; // 직전이 0이면 비교 의미 없음 — 표시 생략
  }
  return ((cur - prev) / Math.abs(prev)) * 100;
};

/** 대시보드 상단의 [월간 현황 / 일간 현황] 큰 전환 토글 */
const ScopeBigToggle = () => {
  const { mode, setMode, setSingleDay, customStart, label } = usePeriod();
  const isDayMode = mode === "day";
  const isMonthMode = mode === "month";
  const items = [
    { key: "month" as const, label: "월간 현황", icon: CalendarDays, hint: "선택한 월 1일~말일 누적" },
    { key: "day" as const, label: "일간 현황", icon: CalendarIcon, hint: "선택한 하루 단일 실적" },
  ];
  return (
    <div className="mb-2 flex items-center gap-2 flex-wrap">
      <div className="inline-flex p-1 rounded-2xl bg-muted/40 border border-border/40">
        {items.map((it) => {
          const Icon = it.icon;
          const active =
            (it.key === "month" && isMonthMode) || (it.key === "day" && isDayMode);
          return (
            <button
              key={it.key}
              onClick={() => {
                if (it.key === "month") setMode("month");
                else setSingleDay(customStart ?? isoToday());
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 whitespace-nowrap",
                active
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={it.hint}
            >
              <Icon className="size-3.5" />
              {it.label}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">
        기준: <span className="font-semibold text-foreground">{label}</span>
      </span>
    </div>
  );
};

const Index = () => {
  const finance = useFinanceData();
  const { excludedLabels } = useBudgetCategories();
  const { isAdmin } = useRole();
  const { isSuperAdmin } = useSuperAdmin();
  const canSeeAdminWidgets = isAdmin || isSuperAdmin;
  const { widgets, isVisible, toggle, move, resetToDefault } = useDashboardLayout();
  const liveRoi = Math.round(finance.roi);

  const { mode, year, month, startDate, label: periodLabel } = usePeriod();
  // 카드 상단에 표시할 짧은 기준 시점 라벨
  const cardPeriodLabel = (() => {
    if (mode === "month") return `${month || year}월 누적`;
    if (mode === "day") {
      const d = new Date(startDate + "T00:00:00");
      const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
      return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")} (${weekday}) 당일`;
    }
    return periodLabel;
  })();

  const dRevenue = pctChange(finance.totalRevenue, finance.prev.totalRevenue);
  const dExpense = pctChange(finance.totalExpense, finance.prev.totalExpense);
  const dNet = pctChange(finance.netMargin, finance.prev.netMargin);
  const dRoi = pctChange(finance.roi, finance.prev.roi);

  return (
    <>
      <Header
        title="영업기획팀 전략 대시보드"
        subtitle="2025년 11월 · 영업 성과 → 수익 분석 → 현장 활동 순으로 한눈에"
        rightSlot={isAdmin ? (
          <DashboardLayoutManager
            widgets={widgets}
            toggle={toggle}
            move={move}
            resetToDefault={resetToDefault}
          />
        ) : undefined}
      />

      {/* 상단 [월간 현황 / 일간 현황] 큰 토글 — 모든 카드/차트의 기준 동기화 */}
      <ScopeBigToggle />

      {/* === 본인 검수 피드백 (반려/수정요청) === */}
      {isVisible("review_alerts") && <MyReviewAlerts />}

      {/* 업무 바로가기 */}
      {canSeeAdminWidgets && isVisible("quick_links") && (
        <section className="mb-1.5">
          <QuickLinksWidget />
        </section>
      )}

      {excludedLabels.length > 0 && (
        <div className="mb-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-center gap-2 text-xs">
          <EyeOff className="size-4 text-destructive shrink-0" />
          <span className="text-muted-foreground">
            합산 제외 항목:{" "}
            <span className="font-semibold text-foreground">
              {excludedLabels.slice(0, 3).join(", ")}
              {excludedLabels.length > 3 && ` 외 ${excludedLabels.length - 3}건`}
            </span>
          </span>
          <Link to="/budget-categories" className="ml-auto text-xs text-primary hover:underline shrink-0">
            항목 관리 →
          </Link>
        </div>
      )}

      {/* [1] 최상단 — 영업 성과 */}
      {(isVisible("goal_gauge") || isVisible("hero_performance")) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 mb-1.5">
          {isVisible("goal_gauge") && <RadialGoalGauge />}
          {isVisible("hero_performance") && (
            <div className={isVisible("goal_gauge") ? "lg:col-span-2" : "lg:col-span-3"}>
              <HeroPerformance />
            </div>
          )}
        </section>
      )}

      {canSeeAdminWidgets && isVisible("channel_activation") && <ChannelActivationBreakdown />}
      {isVisible("activation_breakdown") && <ActivationBreakdown />}

      {isVisible("settlement_charts") && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 mb-1.5">
          <RevenueComposition />
          <CategoryBreakdownChart type="지출" />
        </section>
      )}

      {/* 나의 예상 인센티브 */}
      {isVisible("my_incentive") && (
        <section className="mb-1.5">
          <MyIncentiveWidget />
        </section>
      )}

      {/* [2] 중간 — 수익 및 효율 */}
      {isVisible("stat_cards") && (
      <section className="grid grid-cols-2 lg:grid-cols-7 gap-1.5 mb-1.5">
        <StatCard
          label="총 수익"
          value={finance.loading ? "…" : formatShortKRW(finance.totalRevenue)}
          periodLabel={cardPeriodLabel}
          delta={dRevenue}
          icon={TrendingUp}
          accent="primary"
          hint="단가표 수수료 + 부가서비스 + 수급완료 미수금 + 반납완료 상품권 + 확정 중고폰"
        />
        <StatCard
          label="총 지출"
          value={finance.loading ? "…" : formatShortKRW(finance.totalExpense)}
          periodLabel={cardPeriodLabel}
          delta={dExpense}
          icon={TrendingDown}
          accent="warning"
          hint="지원금 + 5번 법인카드 + 광고비/기타지출 + 모요 수수료"
        />
        <StatCard
          label="순수익"
          value={finance.loading ? "…" : formatShortKRW(finance.netMargin)}
          periodLabel={cardPeriodLabel}
          delta={dNet}
          icon={Sparkles}
          accent="success"
          hint="총 수익 − 총 지출"
        />
        <StatCard
          label="정산 ROI"
          value={`${liveRoi}%`}
          periodLabel={cardPeriodLabel}
          delta={dRoi}
          icon={Target}
          accent="secondary"
          hint="순수익 ÷ 총 지출"
        />
        <CashTodayCard />
        <PendingItemsCard />
        {isVisible("untreated_leads") && <UntreatedLeadsCard />}
      </section>
      )}

      {(isVisible("performance_chart") || isVisible("channel_donut")) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 mb-1.5">
          {isVisible("performance_chart") && (
            <div className={isVisible("channel_donut") ? "lg:col-span-2" : "lg:col-span-3"}>
              <PerformanceChart />
            </div>
          )}
          {isVisible("channel_donut") && <ChannelDonut />}
        </section>
      )}

      {(isVisible("store_ranking") || isVisible("store_efficiency")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 mb-1.5">
          {isVisible("store_ranking") && <StoreRevenueRanking />}
          {isVisible("store_efficiency") && <StoreEfficiencyBubble />}
        </section>
      )}

      {isVisible("performance_ledger") && (
        <section className="mb-1.5">
          <PerformanceLedger />
        </section>
      )}

      {isVisible("overall_model") && (
        <section className="mb-1.5">
          <OverallModelAnalysis />
        </section>
      )}

      {isVisible("channel_model") && (
        <section className="mb-1.5">
          <ChannelModelAnalysis />
        </section>
      )}

      {/* [3] 하단 — 라이브 활동 피드 + 사이드 위젯 (좌우 균형 배치) */}
      {(isVisible("live_feed") || isVisible("planner_feed")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 mb-1.5">
          {isVisible("live_feed") && <LiveActivityFeed />}
          {isVisible("planner_feed") && <PlannerFeed />}
        </section>
      )}

      {(isVisible("inventory_widget") || isVisible("strategy_gauges")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-1.5 mb-1.5">
          {isVisible("inventory_widget") && <InventoryWidget />}
          {isVisible("strategy_gauges") && <StrategyModelGauges />}
        </section>
      )}

      {(isVisible("ad_schedule") || isVisible("ranking_panel")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
          {isVisible("ad_schedule") && <AdScheduleWidget />}
          {isVisible("ranking_panel") && <RankingPanel />}
        </section>
      )}
    </>
  );
};

export default Index;
