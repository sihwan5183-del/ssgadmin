import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { useFinanceData } from "@/hooks/useFinanceData";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

/**
 * 신규 수익/지출 정산 요약
 * 좌: 수익 항목별 / 우: 지출 항목별 / 하단: 순수익 강조
 */
export const NetMarginCard = () => {
  const { revenueBreakdown, expenseBreakdown, netMargin, marginRate } = useFinanceData();

  const totalRev = revenueBreakdown.reduce((s, r) => s + r.amount, 0);
  const totalExp = expenseBreakdown.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="glass rounded-2xl p-5 md:p-6 space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h4 className="text-base font-semibold tracking-tight">순수익 정산 요약</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            확정 데이터 기준 · 수급/반납 완료 항목만 합산 · 모요 미적용 토글 ON 건은 수수료 제외
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 수익 */}
        <div className="rounded-xl border border-revenue/30 bg-[hsl(var(--revenue-soft))] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-revenue font-semibold text-sm">
              <TrendingUp className="size-4" /> 수익 항목
            </div>
            <div className="text-revenue font-bold tabular-nums">{formatKRW(totalRev)}</div>
          </div>
          <ul className="space-y-1.5">
            {revenueBreakdown.map((r) => (
              <li key={r.key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="tabular-nums font-medium">{formatKRW(r.amount)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 지출 */}
        <div className="rounded-xl border border-expense/30 bg-[hsl(var(--expense-soft))] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-expense font-semibold text-sm">
              <TrendingDown className="size-4" /> 지출 항목
            </div>
            <div className="text-expense font-bold tabular-nums">{formatKRW(totalExp)}</div>
          </div>
          <ul className="space-y-1.5">
            {expenseBreakdown.map((r) => (
              <li key={r.key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="tabular-nums font-medium">{formatKRW(r.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 순수익 강조 */}
      <div className="rounded-2xl p-5 bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 opacity-90" />
          <div>
            <div className="text-[11px] opacity-80">최종 순수익 (수익 − 지출)</div>
            <div className="text-[10px] opacity-70 tabular-nums">마진율 {Math.round(marginRate)}%</div>
          </div>
        </div>
        <div className={`text-3xl md:text-4xl font-extrabold tabular-nums ${netMargin < 0 ? "text-rose-200" : ""}`}>
          {formatKRW(netMargin)}
        </div>
      </div>
    </div>
  );
};
