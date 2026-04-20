import { TrendingDown, TrendingUp } from "lucide-react";
import { useFinanceData } from "@/hooks/useFinanceData";
import { EmptyHint } from "./EmptyHint";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

/**
 * 채널별 "예상 수익(소매가 합) vs 실제 정산(net_fee 가 있다면 그 합, 없으면 unit_price)" 비교는
 * 현 스키마에 별도 정산 테이블이 없어 정확히 산출 불가.
 * → 대신 채널별 "수익(unit_price 합) vs 비용(광고비+오퍼)"의 갭으로 대체 표시.
 */
export const SettlementGap = () => {
  const { channels, loading, hasSales } = useFinanceData();

  const rows = channels
    .filter((c) => c.rebate > 0)
    .map((c) => ({
      item: c.channel,
      estimated: c.rebate,
      actual: Math.max(0, c.rebate - c.cost),
    }));

  const totalEst = rows.reduce((s, r) => s + r.estimated, 0);
  const totalAct = rows.reduce((s, r) => s + r.actual, 0);
  const totalDiff = totalAct - totalEst;
  const totalPct = totalEst > 0 ? ((totalDiff / totalEst) * 100).toFixed(1) : "0.0";

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight">채널별 수익 vs 실질 마진</h4>
          <p className="text-xs text-muted-foreground mt-0.5">수익에서 광고비·오퍼 제외 후 남는 금액</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">전체 차액</div>
          <div className={`text-lg font-bold tabular-nums ${totalDiff >= 0 ? "text-revenue" : "text-expense"}`}>
            {totalDiff >= 0 ? "+" : ""}{formatKRW(totalDiff)} ({totalPct}%)
          </div>
        </div>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyHint
          message={!hasSales ? "해당 기간 개통 실적이 없습니다." : "표시할 채널 데이터가 없습니다."}
          actionLabel="실적 입력"
          actionHref="/input"
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const diff = r.actual - r.estimated;
            const pct = r.estimated > 0 ? ((diff / r.estimated) * 100).toFixed(1) : "0.0";
            const positive = diff >= 0;
            const ratio = r.estimated > 0 ? (r.actual / r.estimated) * 100 : 0;
            return (
              <li key={r.item} className="rounded-xl bg-card/40 border border-border/40 p-3">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">{r.item}</span>
                  <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${positive ? "text-revenue" : "text-expense"}`}>
                    {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {positive ? "+" : ""}{formatKRW(diff)} · {pct}%
                  </span>
                </div>

                <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 w-full bg-muted-foreground/20" />
                  <div
                    className={positive ? "absolute inset-y-0 left-0 bg-gradient-revenue" : "absolute inset-y-0 left-0 bg-gradient-expense"}
                    style={{ width: `${Math.min(100, ratio)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                  <span>총수익 <span className="text-foreground">{formatKRW(r.estimated)}</span></span>
                  <span>실질마진 <span className={positive ? "text-revenue" : "text-expense"}>{formatKRW(r.actual)}</span></span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
