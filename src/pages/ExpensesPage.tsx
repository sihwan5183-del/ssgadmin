import { Header } from "@/components/layout/Header";
import { MediaSpendStack } from "@/components/finance/MediaSpendStack";
import { CpaChart } from "@/components/finance/CpaChart";
import { RevenueComposition } from "@/components/finance/RevenueComposition";
import { NetMarginCard } from "@/components/finance/NetMarginCard";
import { OfferTrendChart } from "@/components/finance/OfferTrendChart";
import { ChannelMarginRanking } from "@/components/finance/ChannelMarginRanking";
import { SettlementGap } from "@/components/finance/SettlementGap";
import { EmptyHint } from "@/components/finance/EmptyHint";
import { TrendingUp, TrendingDown, Sparkles, Target, Banknote, Wallet, HandCoins } from "lucide-react";
import { usePeriod } from "@/contexts/PeriodContext";
import { useFinanceData } from "@/hooks/useFinanceData";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

const ExpensesPage = () => {
  const { label } = usePeriod();
  const f = useFinanceData();

  return (
    <>
      <Header
        title="수익 · 지출 상세 분석"
        subtitle={`판매원장 + 지출장표 통합 뷰 · ${label}`}
      />

      {/* 데이터 검증 안내 */}
      {!f.loading && (f.hasSales !== f.hasSpend) && (
        <div className="mb-4">
          <EmptyHint
            message={
              f.hasSales && !f.hasSpend
                ? "수익 데이터는 있는데 매칭되는 지출(광고비)이 없습니다. 채널별 ROI/CPA 분석을 위해 지출을 입력해 주세요."
                : "지출 데이터는 있는데 매칭되는 개통 실적이 없습니다. 실적을 입력해 주세요."
            }
            actionLabel={f.hasSales && !f.hasSpend ? "지출 입력" : "실적 입력"}
            actionHref={f.hasSales && !f.hasSpend ? "/expense-input" : "/input"}
          />
        </div>
      )}

      {/* 상단 KPI — 모두 실데이터 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiTile label="총 수익(마진)" value={formatKRW(f.totalRevenue)} tone="revenue" Icon={TrendingUp} hint={`${f.totalSuccess}건 합산`} />
        <KpiTile label="총 지출 (광고+유통망+고객입금)" value={formatKRW(f.totalExpense)} tone="expense" Icon={TrendingDown}
          hint={`광고 ${formatKRW(f.totalAdSpend)} + 유통망 ${formatKRW(f.totalDistributor)} + 고객입금 ${formatKRW(f.totalCustomerDeposit)}`} />
        <KpiTile label="순이익 (Net Margin)" value={formatKRW(f.netMargin)} tone="primary" Icon={Sparkles}
          hint={`마진율 ${Math.round(f.marginRate)}% · ROI ${Math.round(f.roi)}%`} />
        <KpiTile label="평균 CPA" value={formatKRW(f.cpaAvg)} tone="expense" Icon={Target}
          hint={f.totalSuccess > 0 ? `광고비 ÷ ${f.totalSuccess}건` : "데이터 없음"} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiTile label="유통망 지원금 (지출)" value={formatKRW(f.totalDistributor)} tone="expense" Icon={HandCoins} hint="실적 자동 집계 · 총지출 반영" />
        <KpiTile label="고객입금 금액 (지출)" value={formatKRW(f.totalCustomerDeposit)} tone="expense" Icon={Wallet} hint="우리가 고객에게 지급 · 총지출 반영" />
        <KpiTile label="현금개통 금액 (시재 유입)" value={formatKRW(f.totalCashOpen)} tone="primary" Icon={Banknote} hint="고객 현금 완납 · 매장 시재" />
      </section>

      <SectionTitle index={1} title="지출 상세 분석" subtitle="매체별 광고비 집행 + 채널별 CPA" />
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
        <div className="lg:col-span-3"><MediaSpendStack /></div>
        <div className="lg:col-span-2"><CpaChart /></div>
      </section>

      <SectionTitle index={2} title="수익 상세 분석" subtitle="구성 + 순수익 + 오퍼 추이" />
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-2"><RevenueComposition /></div>
        <div className="lg:col-span-3"><NetMarginCard /></div>
      </section>
      <section className="mb-8">
        <OfferTrendChart />
      </section>

      <SectionTitle index={3} title="전략적 효율 지표 (ROI)" subtitle="채널 마진율 순위 + 정산 갭" />
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChannelMarginRanking />
        <SettlementGap />
      </section>
    </>
  );
};

const KpiTile = ({
  label, value, tone, Icon, hint,
}: {
  label: string;
  value: string;
  tone: "revenue" | "expense" | "primary";
  Icon: React.ElementType;
  hint?: string;
}) => {
  const toneCls = {
    revenue: "text-revenue border-revenue/30 bg-[hsl(var(--revenue-soft))]",
    expense: "text-expense border-expense/30 bg-[hsl(var(--expense-soft))]",
    primary: "text-primary-glow border-primary/30 bg-gradient-soft",
  }[tone];
  return (
    <div className="glass rounded-2xl p-5 shadow-card-elevated">
      <div className={`size-10 rounded-xl grid place-items-center border ${toneCls}`}>
        <Icon className="size-5" />
      </div>
      <div className="mt-4 text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl md:text-3xl font-bold tabular-nums ${tone === "revenue" ? "text-revenue" : tone === "expense" ? "text-expense" : "text-gradient"}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
};

const SectionTitle = ({ index, title, subtitle }: { index: number; title: string; subtitle: string }) => (
  <div className="flex items-baseline gap-3 mb-3">
    <span className="size-7 rounded-lg grid place-items-center bg-gradient-primary text-primary-foreground text-xs font-bold shadow-glow">
      {index}
    </span>
    <div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

export default ExpensesPage;
