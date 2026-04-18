import { Header } from "@/components/layout/Header";
import { MediaSpendStack } from "@/components/finance/MediaSpendStack";
import { CpaChart } from "@/components/finance/CpaChart";
import { RevenueComposition } from "@/components/finance/RevenueComposition";
import { NetMarginCard } from "@/components/finance/NetMarginCard";
import { OfferTrendChart } from "@/components/finance/OfferTrendChart";
import { ChannelMarginRanking } from "@/components/finance/ChannelMarginRanking";
import { SettlementGap } from "@/components/finance/SettlementGap";
import { totals, netMargin, formatKRWShort } from "@/data/financeData";
import { TrendingUp, TrendingDown, Sparkles, Target } from "lucide-react";

const ExpensesPage = () => {
  const roi = Math.round(((totals.totalRebate - totals.totalSpend - totals.totalOffer) / totals.totalSpend) * 100);
  const cpaAvg = Math.round(totals.totalSpend / totals.totalSuccess);

  return (
    <>
      <Header
        title="수익 · 지출 상세 분석"
        subtitle="실적장표(금액) + 지출장표 통합 뷰"
      />

      {/* 상단 KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiTile label="총 수익(리베이트)" value={formatKRWShort(totals.totalRebate)} tone="revenue" Icon={TrendingUp} hint="당월 누적" />
        <KpiTile label="총 지출(광고+오퍼)" value={formatKRWShort(totals.totalSpend + totals.totalOffer)} tone="expense" Icon={TrendingDown} hint="마케팅비 + 지원금" />
        <KpiTile label="순수익 (Net)" value={formatKRWShort(netMargin)} tone="primary" Icon={Sparkles} hint="리베이트 − 지원금 − 광고비" />
        <KpiTile label="평균 CPA" value={formatKRWShort(cpaAvg)} tone="expense" Icon={Target} hint={`ROI ${roi}%`} />
      </section>

      {/* 1. 지출 상세 */}
      <SectionTitle index={1} title="지출 상세 분석" subtitle="채널별 광고비 집행 + CPA" />
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
        <div className="lg:col-span-3"><MediaSpendStack /></div>
        <div className="lg:col-span-2"><CpaChart /></div>
      </section>

      {/* 2. 수익 상세 */}
      <SectionTitle index={2} title="수익 상세 분석" subtitle="구성 + 순수익 + 오퍼 추이" />
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-2"><RevenueComposition /></div>
        <div className="lg:col-span-3"><NetMarginCard /></div>
      </section>
      <section className="mb-8">
        <OfferTrendChart />
      </section>

      {/* 3. 전략적 효율 ROI */}
      <SectionTitle index={3} title="전략적 효율 지표 (ROI)" subtitle="채널 마진율 순위 + 정산 차이" />
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
