import { settlementGap, formatKRWShort } from "@/data/financeData";
import { TrendingDown, TrendingUp } from "lucide-react";

export const SettlementGap = () => {
  const totalEst = settlementGap.reduce((s, r) => s + r.estimated, 0);
  const totalAct = settlementGap.reduce((s, r) => s + r.actual, 0);
  const totalDiff = totalAct - totalEst;
  const totalPct = ((totalDiff / totalEst) * 100).toFixed(1);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight">단가표 vs 실제 정산</h4>
          <p className="text-xs text-muted-foreground mt-0.5">예상 수익과 실제 입금액 차이</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">전체 차액</div>
          <div className={`text-lg font-bold tabular-nums ${totalDiff >= 0 ? "text-revenue" : "text-expense"}`}>
            {totalDiff >= 0 ? "+" : ""}{formatKRWShort(totalDiff)} ({totalPct}%)
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {settlementGap.map((r) => {
          const diff = r.actual - r.estimated;
          const pct = ((diff / r.estimated) * 100).toFixed(1);
          const positive = diff >= 0;
          const ratio = (r.actual / r.estimated) * 100;
          return (
            <li key={r.item} className="rounded-xl bg-card/40 border border-border/40 p-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">{r.item}</span>
                <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${positive ? "text-revenue" : "text-expense"}`}>
                  {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {positive ? "+" : ""}{formatKRWShort(diff)} · {pct}%
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
                {/* 단가표(기준) — 연한 회색 */}
                <div className="absolute inset-y-0 left-0 w-full bg-muted-foreground/20" />
                {/* 실제 — 컬러 */}
                <div
                  className={positive ? "absolute inset-y-0 left-0 bg-gradient-revenue" : "absolute inset-y-0 left-0 bg-gradient-expense"}
                  style={{ width: `${Math.min(100, ratio)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                <span>단가표 기준 <span className="text-foreground">{formatKRWShort(r.estimated)}</span></span>
                <span>실제 정산 <span className={positive ? "text-revenue" : "text-expense"}>{formatKRWShort(r.actual)}</span></span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
