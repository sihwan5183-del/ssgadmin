import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { MediaSpendStack } from "@/components/finance/MediaSpendStack";
import { CpaChart } from "@/components/finance/CpaChart";
import { RevenueComposition } from "@/components/finance/RevenueComposition";
import { NetMarginCard } from "@/components/finance/NetMarginCard";
import { OfferTrendChart } from "@/components/finance/OfferTrendChart";
import { ChannelMarginRanking } from "@/components/finance/ChannelMarginRanking";
import { SettlementGap } from "@/components/finance/SettlementGap";
import { totals, netMargin, formatKRWShort } from "@/data/financeData";
import { TrendingUp, TrendingDown, Sparkles, Target, Banknote, Wallet, HandCoins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";

interface SalesAgg {
  distributor: number;
  cashOpen: number;
  customerDeposit: number;
  adSpend: number;
}

const ExpensesPage = () => {
  const { startDate, endDate, label } = usePeriod();
  const [agg, setAgg] = useState<SalesAgg>({ distributor: 0, cashOpen: 0, customerDeposit: 0, adSpend: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: salesRows }, { data: spendRows }] = await Promise.all([
        supabase
          .from("sales")
          .select("distributor_amount, cash_support_amount, receivable_amount, receivable_paid")
          .gte("open_date", startDate)
          .lte("open_date", endDate),
        supabase
          .from("ad_spend")
          .select("amount")
          .gte("spend_date", startDate)
          .lte("spend_date", endDate),
      ]);
      const distributor = (salesRows ?? []).reduce((s, r: any) => s + Number(r.distributor_amount ?? 0), 0);
      const cashOpen = (salesRows ?? []).reduce((s, r: any) => s + Number(r.cash_support_amount ?? 0), 0);
      const customerDeposit = (salesRows ?? []).reduce(
        (s, r: any) => s + Number(r.receivable_amount ?? 0),
        0,
      );
      const adSpend = (spendRows ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      setAgg({ distributor, cashOpen, customerDeposit, adSpend });
    })();
  }, [startDate, endDate]);

  // 실측 KPI
  // 총지출 = 광고비 + 유통망지원금 + 고객입금(우리가 고객에게 지급)
  // 실질마진 = 리베이트 − 유통망 − 고객입금 − 광고비
  // 현금개통은 매장 시재 유입(별도 지표)
  const totalExpense = agg.adSpend + agg.distributor + agg.customerDeposit;
  const realNetMargin = totals.totalRebate - agg.distributor - agg.customerDeposit - agg.adSpend;
  const roi = totalExpense > 0 ? Math.round((realNetMargin / totalExpense) * 100) : 0;
  const cpaAvg = Math.round(totals.totalSpend / totals.totalSuccess);

  return (
    <>
      <Header
        title="수익 · 지출 상세 분석"
        subtitle={`실적장표(금액) + 지출장표 통합 뷰 · ${label}`}
      />

      {/* 상단 KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KpiTile label="총 수익(리베이트)" value={formatKRWShort(totals.totalRebate)} tone="revenue" Icon={TrendingUp} hint="당월 누적" />
        <KpiTile label="총 지출 (광고+유통망+고객입금)" value={formatKRWShort(totalExpense)} tone="expense" Icon={TrendingDown} hint={`광고 ${formatKRWShort(agg.adSpend)} + 유통망 ${formatKRWShort(agg.distributor)} + 고객입금 ${formatKRWShort(agg.customerDeposit)}`} />
        <KpiTile label="실질 마진" value={formatKRWShort(realNetMargin)} tone="primary" Icon={Sparkles} hint="리베이트 − 유통망 − 고객입금 − 광고" />
        <KpiTile label="평균 CPA" value={formatKRWShort(cpaAvg)} tone="expense" Icon={Target} hint={`ROI ${roi}%`} />
      </section>

      {/* 오퍼/현금 ROI 항목 — 지출 분류 카드 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiTile label="유통망 지원금 (지출)" value={formatKRWShort(agg.distributor)} tone="expense" Icon={HandCoins} hint="실적 자동 집계 · 총지출 반영" />
        <KpiTile label="고객입금 금액 (지출)" value={formatKRWShort(agg.customerDeposit)} tone="expense" Icon={Wallet} hint="우리가 고객에게 지급 · 총지출 반영" />
        <KpiTile label="현금개통 금액 (시재 유입)" value={formatKRWShort(agg.cashOpen)} tone="primary" Icon={Banknote} hint="고객 현금 완납 · 매장 시재" />
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
