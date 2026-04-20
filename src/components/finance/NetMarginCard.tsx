import { ArrowRight, Minus, Equal } from "lucide-react";
import { useFinanceData } from "@/hooks/useFinanceData";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

export const NetMarginCard = () => {
  const { totalRevenue, totalOffer, totalAdSpend, totalDistributor, totalCustomerDeposit, netMargin, marginRate } =
    useFinanceData();

  const items = [
    { label: "총 수익(리베이트)", value: totalRevenue, tone: "revenue" as const },
    { label: "고객 지원금(오퍼)", value: totalOffer, tone: "expense" as const },
    { label: "유통망 지원금", value: totalDistributor, tone: "expense" as const },
    { label: "마케팅비", value: totalAdSpend, tone: "expense" as const },
    { label: "고객입금", value: totalCustomerDeposit, tone: "expense" as const },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight">순수익 (Net Margin) 계산</h4>
          <p className="text-xs text-muted-foreground mt-0.5">총 수익 − (오퍼 + 유통망 + 마케팅비 + 고객입금)</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-gradient tabular-nums">{formatKRW(netMargin)}</div>
          <div className="text-[11px] text-muted-foreground tabular-nums">마진율 {Math.round(marginRate)}%</div>
        </div>
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {items.map((it, i) => (
          <div key={it.label} className="flex items-center gap-2 flex-1 min-w-[140px]">
            {i > 0 && (
              <div className="grid place-items-center size-7 rounded-lg bg-muted/50 text-muted-foreground shrink-0">
                <Minus className="size-3.5" />
              </div>
            )}
            <div
              className={`flex-1 rounded-xl p-3 border ${
                it.tone === "revenue"
                  ? "border-revenue/30 bg-[hsl(var(--revenue-soft))]"
                  : "border-expense/30 bg-[hsl(var(--expense-soft))]"
              }`}
            >
              <div className="text-[11px] text-muted-foreground">{it.label}</div>
              <div
                className={`mt-1 text-base font-bold tabular-nums ${
                  it.tone === "revenue" ? "text-revenue" : "text-expense"
                }`}
              >
                {formatKRW(it.value)}
              </div>
            </div>
          </div>
        ))}
        <div className="grid place-items-center size-7 rounded-lg bg-muted/50 text-muted-foreground shrink-0 self-center">
          <Equal className="size-3.5" />
        </div>
        <div className="flex-1 min-w-[140px] rounded-xl p-3 bg-gradient-primary text-primary-foreground shadow-glow">
          <div className="text-[11px] opacity-80 flex items-center gap-1">
            순수익 <ArrowRight className="size-3" />
          </div>
          <div className="mt-1 text-base font-bold tabular-nums">{formatKRW(netMargin)}</div>
        </div>
      </div>
    </div>
  );
};
