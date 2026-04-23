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
import { summaryStats, formatShortKRW } from "@/data/mockData";
import { TrendingUp, Wallet, Megaphone, Target } from "lucide-react";
import { useMarketingSpend } from "@/hooks/useMarketingSpend";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { DashboardLayoutManager } from "@/components/dashboard/DashboardLayoutManager";
import { useRole } from "@/hooks/useRole";

const Index = () => {
  const marketing = useMarketingSpend();
  const { excludedLabels } = useBudgetCategories();
  const { isAdmin } = useRole();
  const { widgets, isVisible, toggle, move, resetToDefault } = useDashboardLayout();
  const liveRoi =
    marketing.current > 0
      ? Math.round((summaryStats.netProfit / marketing.current) * 100)
      : summaryStats.roi;
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

      {/* === 본인 검수 피드백 (반려/수정요청) === */}
      {isVisible("review_alerts") && <MyReviewAlerts />}

      {/* 업무 바로가기 */}
      {isVisible("quick_links") && (
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

      {isVisible("channel_activation") && <ChannelActivationBreakdown />}
      {isVisible("activation_breakdown") && <ActivationBreakdown />}

      {/* [2] 중간 — 수익 및 효율 */}
      {isVisible("stat_cards") && (
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-1.5 mb-1.5">
        <StatCard
          label="당월 순이익"
          value={formatShortKRW(summaryStats.netProfit)}
          delta={summaryStats.netProfitDelta}
          icon={Wallet}
          accent="primary"
          hint="리베이트 − 오퍼 − 마케팅비"
        />
        <StatCard
          label="총 리베이트"
          value={formatShortKRW(summaryStats.totalRebate)}
          delta={summaryStats.totalRebateDelta}
          icon={TrendingUp}
          accent="success"
        />
        <StatCard
          label="마케팅 비용"
          value={marketing.loading ? "…" : formatShortKRW(marketing.current)}
          delta={marketing.loading ? undefined : Number(marketing.delta.toFixed(1))}
          icon={Megaphone}
          accent="warning"
          hint="광고 캘린더 + 지출입력 합산 (실시간)"
        />
        <StatCard
          label="마케팅 ROI"
          value={`${liveRoi}%`}
          delta={summaryStats.roiDelta}
          icon={Target}
          accent="secondary"
          hint="순이익 ÷ 마케팅 비용"
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
