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
import { UntreatedLeadsCard } from "@/components/dashboard/UntreatedLeadsCard";
import { MyIncentiveWidget } from "@/components/dashboard/MyIncentiveWidget";
import { UnifiedCalendarWidget } from "@/components/dashboard/UnifiedCalendarWidget";
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

  return (
    <>
      <Header
        title="영업기획팀 전략 대시보드"
        subtitle={headerSubtitle}
        rightSlot={isAdmin ? (
          <DashboardLayoutManager
            widgets={widgets}
            toggle={toggle}
            move={move}
            resetToDefault={resetToDefault}
          />
        ) : undefined}
      />

      {/* 대시보드 기간 범위: 기본 [이번 달] · 필요 시 [전체 기간] 토글 */}
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

      {/* 상단 [월간 현황 / 일간 현황] 큰 토글 — 모든 카드/차트의 기준 동기화 */}
      <ScopeBigToggle />

      {/* === 본인 검수 피드백 (반려/수정요청) === */}
      {isVisible("review_alerts") && <MyReviewAlerts />}

      {/* 통합 캘린더 (판매실적 / 영업 / 아파트게시 / 광고) */}
      <section className="mb-4">
        <UnifiedCalendarWidget />
      </section>

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

      {/* ========================================================
          [1] 최상단 — 핵심 요약 (목표 달성률 + 오늘/실적 KPI)
         ======================================================== */}
      {(isVisible("goal_gauge") || isVisible("hero_performance")) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
          {isVisible("goal_gauge") && <RadialGoalGauge />}
          {isVisible("hero_performance") && (
            <div className={isVisible("goal_gauge") ? "lg:col-span-2" : "lg:col-span-3"}>
              <HeroPerformance />
            </div>
          )}
        </section>
      )}

      {/* 핵심 KPI (PC 4열 / 태블릿 2열 / 모바일 1열) */}
      {isVisible("stat_cards") && (
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 md:gap-4 mb-4">
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

      {canSeeAdminWidgets && isVisible("channel_activation") && (
        <section className="mb-4"><ChannelActivationBreakdown /></section>
      )}
      {isVisible("activation_breakdown") && (
        <section className="mb-4"><ActivationBreakdown /></section>
      )}

      {/* ========================================================
          [2] 중단 — 추세 / 정산 차트
         ======================================================== */}
      {(isVisible("performance_chart") || isVisible("channel_donut")) && (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-4">
          {isVisible("performance_chart") && (
            <div className={isVisible("channel_donut") ? "lg:col-span-2" : "lg:col-span-3"}>
              <PerformanceChart />
            </div>
          )}
          {isVisible("channel_donut") && <ChannelDonut />}
        </section>
      )}

      {isVisible("settlement_charts") && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-4">
          <RevenueComposition />
          <CategoryBreakdownChart type="지출" />
        </section>
      )}

      {isVisible("my_incentive") && (
        <section className="mb-4">
          <MyIncentiveWidget />
        </section>
      )}

      {/* ========================================================
          [3] 하단 — 팀 랭킹 / 상세 매트릭스
         ======================================================== */}
      {(isVisible("store_ranking") || isVisible("store_efficiency")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-4">
          {isVisible("store_ranking") && <StoreRevenueRanking />}
          {isVisible("store_efficiency") && <StoreEfficiencyBubble />}
        </section>
      )}

      {isVisible("staff_matrix") && (
        <section className="mb-4">
          <StaffPerformanceMatrix />
        </section>
      )}

      {isVisible("performance_ledger") && (
        <section className="mb-4">
          <PerformanceLedger />
        </section>
      )}

      {isVisible("overall_model") && (
        <section className="mb-4">
          <OverallModelAnalysis />
        </section>
      )}

      {isVisible("channel_model") && (
        <section className="mb-4">
          <ChannelModelAnalysis />
        </section>
      )}

      {(isVisible("live_feed") || isVisible("planner_feed")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-4">
          {isVisible("live_feed") && <LiveActivityFeed />}
          {isVisible("planner_feed") && <PlannerFeed />}
        </section>
      )}

      {(isVisible("inventory_widget") || isVisible("strategy_gauges")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mb-4">
          {isVisible("inventory_widget") && <InventoryWidget />}
          {isVisible("strategy_gauges") && <StrategyModelGauges />}
        </section>
      )}

      {(isVisible("ad_schedule") || isVisible("ranking_panel")) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {isVisible("ad_schedule") && <AdScheduleWidget />}
          {isVisible("ranking_panel") && <RankingPanel />}
        </section>
      )}
    </>
  );
};

export default Index;
