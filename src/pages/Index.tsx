import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { HeroPerformance } from "@/components/dashboard/HeroPerformance";
import { RadialGoalGauge } from "@/components/dashboard/RadialGoalGauge";
import { StoreRevenueRanking } from "@/components/dashboard/StoreRevenueRanking";
import { StoreEfficiencyBubble } from "@/components/dashboard/StoreEfficiencyBubble";
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed";
import { ActivationBreakdown } from "@/components/dashboard/ActivationBreakdown";
import { ChannelActivationBreakdown } from "@/components/dashboard/ChannelActivationBreakdown";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { ChannelDonut } from "@/components/dashboard/ChannelDonut";
import { RankingPanel } from "@/components/dashboard/RankingPanel";
import { PerformanceLedger } from "@/components/dashboard/PerformanceLedger";
import { ChannelModelAnalysis } from "@/components/dashboard/ChannelModelAnalysis";
import { OverallModelAnalysis } from "@/components/dashboard/OverallModelAnalysis";
import { AdScheduleWidget } from "@/components/dashboard/AdScheduleWidget";
import { InventoryWidget } from "@/components/dashboard/InventoryWidget";
import { StrategyModelGauges } from "@/components/dashboard/StrategyModelGauges";
import { PendingItemsCard } from "@/components/dashboard/PendingItemsCard";
import { CashTodayCard } from "@/components/dashboard/CashTodayCard";
import { MyReviewAlerts } from "@/components/dashboard/MyReviewAlerts";
import { summaryStats, formatShortKRW } from "@/data/mockData";
import { TrendingUp, Wallet, Megaphone, Target } from "lucide-react";
import { useMarketingSpend } from "@/hooks/useMarketingSpend";

const Index = () => {
  const marketing = useMarketingSpend();
  const liveRoi =
    marketing.current > 0
      ? Math.round((summaryStats.netProfit / marketing.current) * 100)
      : summaryStats.roi;
  return (
    <>
      <Header
        title="영업기획팀 전략 대시보드"
        subtitle="2025년 11월 · 영업 성과 → 수익 분석 → 현장 활동 순으로 한눈에"
      />

      {/* === 본인 검수 피드백 (반려/수정요청) === */}
      <MyReviewAlerts />

      {/* ============================================
          [1] 최상단 — 영업 성과 (반원 게이지 + 오늘/누적)
          ============================================ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <RadialGoalGauge />
        <div className="lg:col-span-2">
          <HeroPerformance />
        </div>
      </section>

      <ChannelActivationBreakdown />
      <ActivationBreakdown />

      {/* ============================================
          [2] 중간 — 수익 및 효율
          ============================================ */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
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
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2">
          <PerformanceChart />
        </div>
        <ChannelDonut />
      </section>

      {/* === 매장 비교 시각화 (드릴다운) === */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <StoreRevenueRanking />
        <StoreEfficiencyBubble />
      </section>

      <section className="mb-6">
        <PerformanceLedger />
      </section>

      <section className="mb-6">
        <OverallModelAnalysis />
      </section>

      <section className="mb-6">
        <ChannelModelAnalysis />
      </section>

      {/* ============================================
          [3] 하단 — 라이브 활동 피드 + 사이드 위젯
          ============================================ */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <LiveActivityFeed />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <InventoryWidget />
          <StrategyModelGauges />
          <AdScheduleWidget />
          <RankingPanel />
        </div>
      </section>
    </>
  );
};

export default Index;
