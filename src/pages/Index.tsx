import { useMemo, useRef, type ReactNode } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";

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
import { InventoryWidget } from "@/components/dashboard/InventoryWidget";
import { StrategyModelGauges } from "@/components/dashboard/StrategyModelGauges";
import { PendingItemsCard } from "@/components/dashboard/PendingItemsCard";
import { CashTodayCard } from "@/components/dashboard/CashTodayCard";
import { MyReviewAlerts } from "@/components/dashboard/MyReviewAlerts";
import { summaryStats, formatShortKRW } from "@/data/mockData";
import { TrendingUp, Wallet, Megaphone, Target, GripVertical, X, Plus, RotateCcw, Pencil, Save, EyeOff } from "lucide-react";
import { useMarketingSpend } from "@/hooks/useMarketingSpend";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardLayout, WIDGET_DEFS } from "@/hooks/useDashboardLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/* ── widget content map ── */
function StatCardsBlock() {
  const marketing = useMarketingSpend();
  const liveRoi =
    marketing.current > 0
      ? Math.round((summaryStats.netProfit / marketing.current) * 100)
      : summaryStats.roi;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 h-full">
      <StatCard label="당월 순이익" value={formatShortKRW(summaryStats.netProfit)} delta={summaryStats.netProfitDelta} icon={Wallet} accent="primary" hint="리베이트 − 오퍼 − 마케팅비" />
      <StatCard label="총 리베이트" value={formatShortKRW(summaryStats.totalRebate)} delta={summaryStats.totalRebateDelta} icon={TrendingUp} accent="success" />
      <StatCard label="마케팅 비용" value={marketing.loading ? "…" : formatShortKRW(marketing.current)} delta={marketing.loading ? undefined : Number(marketing.delta.toFixed(1))} icon={Megaphone} accent="warning" hint="광고 캘린더 + 지출입력 합산 (실시간)" />
      <StatCard label="마케팅 ROI" value={`${liveRoi}%`} delta={summaryStats.roiDelta} icon={Target} accent="secondary" hint="순이익 ÷ 마케팅 비용" />
      <CashTodayCard />
      <PendingItemsCard />
    </div>
  );
}

const WIDGET_COMPONENTS: Record<string, ReactNode> = {
  reviewAlerts: <MyReviewAlerts />,
  radialGoal: <RadialGoalGauge />,
  heroPerf: <HeroPerformance />,
  channelAct: <ChannelActivationBreakdown />,
  activation: <ActivationBreakdown />,
  statCards: <StatCardsBlock />,
  perfChart: <PerformanceChart />,
  channelDonut: <ChannelDonut />,
  storeRevenue: <StoreRevenueRanking />,
  storeEfficiency: <StoreEfficiencyBubble />,
  perfLedger: <PerformanceLedger />,
  overallModel: <OverallModelAnalysis />,
  channelModel: <ChannelModelAnalysis />,
  liveFeed: <LiveActivityFeed />,
  plannerFeed: <PlannerFeed />,
  inventory: <InventoryWidget />,
  strategyGauges: <StrategyModelGauges />,
  adSchedule: <AdScheduleWidget />,
  ranking: <RankingPanel />,
};

const Index = () => {
  const { excludedLabels } = useBudgetCategories();
  const {
    layout,
    hiddenIds,
    editing,
    setEditing,
    onLayoutChange,
    saveLayout,
    resetLayout,
    hideWidget,
    showWidget,
  } = useDashboardLayout();

  const hiddenWidgets = useMemo(
    () => WIDGET_DEFS.filter((w) => hiddenIds.has(w.id)),
    [hiddenIds]
  );

  return (
    <>
      <Header
        title="영업기획팀 전략 대시보드"
        subtitle="2025년 11월 · 영업 성과 → 수익 분석 → 현장 활동 순으로 한눈에"
      />

      {excludedLabels.length > 0 && (
        <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 flex items-center gap-2 text-sm">
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

      {/* ── 편집 모드 컨트롤 ── */}
      <div className="flex items-center justify-end gap-2 mb-3">
        {editing ? (
          <>
            {hiddenWidgets.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Plus className="size-3.5" /> 위젯 추가 <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{hiddenWidgets.length}</Badge>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hiddenWidgets.map((w) => (
                    <DropdownMenuItem key={w.id} onClick={() => showWidget(w.id)}>
                      <Plus className="size-3.5 mr-2" /> {w.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" size="sm" onClick={resetLayout} className="gap-1.5 text-muted-foreground">
              <RotateCcw className="size-3.5" /> 초기화
            </Button>
            <Button size="sm" onClick={saveLayout} className="gap-1.5">
              <Save className="size-3.5" /> 저장
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
            <Pencil className="size-3.5" /> 레이아웃 편집
          </Button>
        )}
      </div>

      {/* ── 그리드 ── */}
      <DashboardGrid
        layout={layout}
        editing={editing}
        onLayoutChange={onLayoutChange}
        hideWidget={hideWidget}
      />
    </>
  );
};

export default Index;

/* ── Grid wrapper using hooks API ── */
function DashboardGrid({
  layout,
  editing,
  onLayoutChange,
  hideWidget,
}: {
  layout: import("react-grid-layout").LayoutItem[];
  editing: boolean;
  onLayoutChange: (l: import("react-grid-layout").LayoutItem[]) => void;
  hideWidget: (id: string) => void;
}) {
  const { width, containerRef, mounted } = useContainerWidth();

  return (
    <div ref={containerRef}>
      {mounted && (
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{ cols: 12, rowHeight: 60, margin: [8, 8] as [number, number] }}
          dragConfig={{ enabled: editing, handle: ".widget-drag-handle" }}
          resizeConfig={{ enabled: editing }}
          onLayoutChange={(newLayout) => onLayoutChange([...newLayout])}
        >
          {layout.map((item) => {
            const content = WIDGET_COMPONENTS[item.i];
            if (!content) return null;
            return (
              <div key={item.i} className="relative group">
                {editing && (
                  <>
                    <div className="widget-drag-handle absolute top-1 left-1 z-20 cursor-grab active:cursor-grabbing p-1 rounded-md bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="size-4 text-muted-foreground" />
                    </div>
                    <button
                      onClick={() => hideWidget(item.i)}
                      className="absolute top-1 right-1 z-20 p-1 rounded-md bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/20"
                    >
                      <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </>
                )}
                <div className={`h-full overflow-auto ${editing ? "ring-1 ring-primary/20 rounded-xl" : ""}`}>
                  {content}
                </div>
              </div>
            );
          })}
        </GridLayout>
      )}
    </div>
  );
}
