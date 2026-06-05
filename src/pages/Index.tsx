import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/dashboard/StatCard";
import { HeroPerformance } from "@/components/dashboard/HeroPerformance";
import { RadialGoalGauge } from "@/components/dashboard/RadialGoalGauge";
import { StoreRevenueRanking } from "@/components/dashboard/StoreRevenueRanking";
import { StoreEfficiencyBubble } from "@/components/dashboard/StoreEfficiencyBubble";
import { StaffPerformanceMatrix } from "@/components/dashboard/StaffPerformanceMatrix";
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
import { TodayCareWidget } from "@/components/dashboard/TodayCareWidget";
import { UntreatedLeadsCard } from "@/components/dashboard/UntreatedLeadsCard";
import { MyIncentiveWidget } from "@/components/dashboard/MyIncentiveWidget";
import { UnifiedCalendarWidget } from "@/components/dashboard/UnifiedCalendarWidget";
import { TopProductScoreboard } from "@/components/dashboard/TopProductScoreboard";
import { PendingProductScoreboard } from "@/components/dashboard/PendingProductScoreboard";
import { ProductScopeProvider } from "@/contexts/ProductScopeContext";
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
import { CalendarDays, Calendar as CalendarIcon, CalendarRange } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { DashboardGrid, type GridWidget } from "@/components/dashboard/DashboardGrid";

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
  const { mode, setMode, setSingleDay, customStart } = usePeriod();
  const isDayMode = mode === "day";
  const isMonthMode = mode === "month";
  const items = [
    { key: "month" as const, label: "월간 현황", icon: CalendarDays, hint: "선택한 월 1일~말일 누적" },
    { key: "day" as const, label: "일간 현황", icon: CalendarIcon, hint: "선택한 하루 단일 실적" },
  ];
  return (
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
  );
};

const Index = () => {
  return (
    <ProductScopeProvider>
      <IndexInner />
    </ProductScopeProvider>
  );
};

const IndexInner = () => {
  const finance = useFinanceData();
  const { excludedLabels } = useBudgetCategories();
  const { isAdmin } = useRole();
  const { isSuperAdmin } = useSuperAdmin();
  const canSeeAdminWidgets = isAdmin || isSuperAdmin;
  const { widgets, isVisible, toggle, move, resetToDefault } = useDashboardLayout(isSuperAdmin);
  const liveRoi = Math.round(finance.roi);

  const { mode, year, month, startDate, label: periodLabel, setMode, setYear, setMonth } = usePeriod();

  // ── 대시보드는 기본 [이번 달] 강제. 다른 페이지에서 임의 기간을 설정한 채 들어와도
  //    진입 즉시 현재 월로 리셋해서 모든 위젯이 동일 기준(이번 달)으로 집계되도록 한다.
  useEffect(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    if (mode !== "month" || year !== curY || month !== curM) {
      setMode("month");
      setYear(curY);
      setMonth(curM);
    }
    // mount 시점 한 번만 강제 — 이후 사용자가 토글로 [전체 기간] 등 바꾸는 건 존중
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이번 달인지 / 전체 기간(연 단위)인지 판정
  const now = new Date();
  const isThisMonth = mode === "month" && year === now.getFullYear() && month === now.getMonth() + 1;
  const isAllYear = mode === "month" && month === 0;

  const setThisMonth = () => {
    setMode("month");
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };
  const setAllYear = () => {
    setMode("month");
    setYear(now.getFullYear());
    setMonth(0);
  };

  // 헤더 부제: 현재 어떤 기간을 보고 있는지 명시
  const headerSubtitle = isThisMonth
    ? `${now.getFullYear()}년 ${now.getMonth() + 1}월 현황 · 1일 ~ 오늘까지 누적`
    : isAllYear
      ? `${year}년 전체 기간 · 누적 데이터`
      : `${periodLabel} 기준 · 사용자 지정 기간`;

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

  // === 7-card KPI block (rendered as a single grid widget) ===
  const StatCardsBlock = (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 md:gap-4">
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
  );

  const SettlementChartsBlock = (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      <RevenueComposition />
      <CategoryBreakdownChart type="지출" />
    </section>
  );

  // Widget registry — id, node, default lg position. Visibility filtered via
  // existing useDashboardLayout toggles; grid auto-compacts hidden gaps.
  const widgetDefs: Array<{ id: string; node: React.ReactNode; lg: GridWidget["lg"]; always?: boolean; adminOnly?: boolean }> = [
    // Compact tile grid (12 cols). Widgets default to half-width or smaller
    // so the dashboard reads as tiled cards, not a stack of full-width rows.
    { id: "review_alerts",        node: <MyReviewAlerts />,                lg: { x: 0,  y: 0,   w: 8,  h: 4 } },
    { id: "quick_links",          node: <QuickLinksWidget />,              lg: { x: 8,  y: 0,   w: 4,  h: 4 }, adminOnly: true },
    { id: "today_care",           node: <TodayCareWidget />,               lg: { x: 0,  y: 4,   w: 4,  h: 6 } },
    { id: "top_product",          node: <TopProductScoreboard />,          lg: { x: 4,  y: 4,   w: 4,  h: 5 } },
    { id: "pending_product",      node: <PendingProductScoreboard />,      lg: { x: 8,  y: 4,   w: 4,  h: 5 } },
    { id: "unified_calendar",     node: <UnifiedCalendarWidget />,         lg: { x: 0,  y: 10,  w: 8,  h: 12 } },
    { id: "goal_gauge",           node: <RadialGoalGauge />,               lg: { x: 8,  y: 10,  w: 4,  h: 9 } },
    { id: "hero_performance",     node: <HeroPerformance />,               lg: { x: 0,  y: 22,  w: 8,  h: 9 } },
    { id: "channel_donut",        node: <ChannelDonut />,                  lg: { x: 8,  y: 19,  w: 4,  h: 10 } },
    { id: "stat_cards",           node: StatCardsBlock,                    lg: { x: 0,  y: 31,  w: 12, h: 8 } },
    { id: "channel_activation",   node: <ChannelActivationBreakdown />,    lg: { x: 0,  y: 39,  w: 6,  h: 9 }, adminOnly: true },
    { id: "activation_breakdown", node: <ActivationBreakdown />,           lg: { x: 6,  y: 39,  w: 6,  h: 9 } },
    { id: "performance_chart",    node: <PerformanceChart />,              lg: { x: 0,  y: 48,  w: 8,  h: 10 } },
    { id: "my_incentive",         node: <MyIncentiveWidget />,             lg: { x: 8,  y: 48,  w: 4,  h: 6 } },
    { id: "settlement_charts",    node: SettlementChartsBlock,             lg: { x: 0,  y: 58,  w: 12, h: 10 } },
    { id: "store_ranking",        node: <StoreRevenueRanking />,           lg: { x: 0,  y: 68,  w: 6,  h: 12 } },
    { id: "store_efficiency",     node: <StoreEfficiencyBubble />,         lg: { x: 6,  y: 68,  w: 6,  h: 12 } },
    { id: "staff_matrix",         node: <StaffPerformanceMatrix />,        lg: { x: 0,  y: 80,  w: 12, h: 14 } },
    { id: "performance_ledger",   node: <PerformanceLedger />,             lg: { x: 0,  y: 94,  w: 12, h: 14 } },
    { id: "overall_model",        node: <OverallModelAnalysis />,          lg: { x: 0,  y: 108, w: 6,  h: 12 } },
    { id: "channel_model",        node: <ChannelModelAnalysis />,          lg: { x: 6,  y: 108, w: 6,  h: 12 } },
    { id: "live_feed",            node: <LiveActivityFeed />,              lg: { x: 0,  y: 120, w: 6,  h: 12 } },
    { id: "planner_feed",         node: <PlannerFeed />,                   lg: { x: 6,  y: 120, w: 6,  h: 12 } },
    { id: "inventory_widget",     node: <InventoryWidget />,               lg: { x: 0,  y: 132, w: 6,  h: 10 } },
    { id: "strategy_gauges",      node: <StrategyModelGauges />,           lg: { x: 6,  y: 132, w: 6,  h: 10 } },
    { id: "ad_schedule",          node: <AdScheduleWidget />,              lg: { x: 0,  y: 142, w: 6,  h: 10 } },
    { id: "ranking_panel",        node: <RankingPanel />,                  lg: { x: 6,  y: 142, w: 6,  h: 10 } },
  ];

  const gridItems: GridWidget[] = widgetDefs
    .filter((w) => {
      if (w.adminOnly && !canSeeAdminWidgets) return false;
      if (w.always) return true;
      return isVisible(w.id);
    })
    .map((w) => ({ id: w.id, node: w.node, lg: w.lg }));


  return (
    <>
      <Header
        title="영업기획팀 전략 대시보드"
        subtitle={headerSubtitle}
        rightSlot={isSuperAdmin ? (
          <DashboardLayoutManager
            widgets={widgets}
            toggle={toggle}
            move={move}
            resetToDefault={resetToDefault}
          />
        ) : undefined}
      />

      {/* 대시보드 기간 범위: [이번 달 / 전체 기간] + [월간 현황 / 일간 현황] 한 줄 */}
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <div className="inline-flex p-1 rounded-2xl bg-muted/40 border border-border/40">
          <button
            onClick={setThisMonth}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 whitespace-nowrap",
              isThisMonth
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground",
            )}
            title={`${now.getFullYear()}년 ${now.getMonth() + 1}월 1일 ~ 오늘`}
          >
            <CalendarDays className="size-3.5" /> 이번 달 ({now.getMonth() + 1}월)
          </button>
          <button
            onClick={setAllYear}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 whitespace-nowrap",
              isAllYear
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground",
            )}
            title={`${year}년 전체 누적`}
          >
            <CalendarRange className="size-3.5" /> 전체 기간 ({year}년)
          </button>
        </div>

        <ScopeBigToggle />

        <span className="text-xs text-muted-foreground">
          기준: <span className="font-semibold text-foreground">{periodLabel}</span>
          {!isThisMonth && (
            <button
              onClick={setThisMonth}
              className="ml-2 text-primary hover:underline"
              title="이번 달로 되돌리기"
            >
              [이번 달로 초기화]
            </button>
          )}
        </span>
      </div>

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

      <DashboardGrid
        items={gridItems}
        editable={isSuperAdmin}
        storageKey="dashboard.grid.v2"
        onRemove={isSuperAdmin ? toggle : undefined}
      />
    </>
  );
};

export default Index;
