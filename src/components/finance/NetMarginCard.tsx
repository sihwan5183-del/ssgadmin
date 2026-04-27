import { TrendingUp, TrendingDown, Sparkles, ArrowDownRight } from "lucide-react";
import { useFinanceData } from "@/hooks/useFinanceData";
import { Link } from "react-router-dom";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

// 수익 항목 ↔ 판매원장 정렬 키 매핑 (클릭 시 판매원장으로 이동)
const REVENUE_LINK: Record<string, string> = {
  commission: "/sales-ledger?focus=unit_price",
  vas: "/sales-ledger?focus=vas_fee",
  receivable: "/sales-ledger?focus=receivable_amount",
  voucher: "/sales-ledger?focus=voucher_amount",
  trade_in: "/sales-ledger?focus=trade_in_confirmed",
};

const EXPENSE_LINK: Record<string, string> = {
  distributor: "/sales-ledger?focus=distributor_amount",
  cash_open: "/sales-ledger?focus=cash_support_amount",
  extra_subsidy: "/sales-ledger?focus=extra_subsidy",
  customer_support: "/sales-ledger?focus=customer_support_amount",
  corp_card: "/sales-ledger?focus=corp_card_amount",
  ad_spend: "/expense-input",
  moyo_fee: "/sales-ledger?focus=moyo",
};

/**
 * 순수익 정산 요약
 * - 수익 5대 항목(파랑) + 지출 항목(빨강) + 실질 순수익
 * - 0원 항목도 표기 (데이터 정합성 검증)
 * - 각 행은 판매원장으로 이동
 */
export const NetMarginCard = () => {
  const { revenueBreakdown, expenseBreakdown, marginRate } = useFinanceData();

  const totalRev = revenueBreakdown.reduce((s, r) => s + r.amount, 0);
  const totalExp = expenseBreakdown.reduce((s, r) => s + r.amount, 0);
  const netMargin = totalRev - totalExp;

  return (
    <div className="glass rounded-2xl p-5 md:p-6 space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h4 className="text-base font-semibold tracking-tight">순수익 정산 요약</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            공식: (5대 수익 항목 총합) − (실질 지출 항목 총합) · 0원 항목도 표기 · 모요 미적용 토글 ON 건은 수수료 제외
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 수익 — 파란색 계열 */}
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-sky-500/20">
            <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold text-sm">
              <TrendingUp className="size-4" /> 수익 항목 (5)
            </div>
            <div className="text-sky-600 dark:text-sky-400 font-bold tabular-nums text-sm">
              {formatKRW(totalRev)}
            </div>
          </div>
          <ul className="space-y-1">
            {revenueBreakdown.map((r) => (
              <li key={r.key}>
                <Link
                  to={REVENUE_LINK[r.key] ?? "/sales-ledger"}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-sky-500/10 transition-colors"
                  title={`${r.label} 상세보기`}
                >
                  <span className="text-muted-foreground group-hover:text-foreground">
                    {r.label}
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      r.amount === 0 ? "text-muted-foreground/50" : "text-sky-700 dark:text-sky-300"
                    }`}
                  >
                    {formatKRW(r.amount)}
                  </span>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between text-xs px-2 pt-2 mt-1 border-t border-sky-500/20">
              <span className="font-semibold text-sky-700 dark:text-sky-300">총 수익 합계</span>
              <span className="tabular-nums font-bold text-sky-700 dark:text-sky-300">
                {formatKRW(totalRev)}
              </span>
            </li>
          </ul>
        </div>

        {/* 지출 — 빨간색 계열 */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-rose-500/20">
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-semibold text-sm">
              <TrendingDown className="size-4" /> 지출 항목
            </div>
            <div className="text-rose-600 dark:text-rose-400 font-bold tabular-nums text-sm">
              {formatKRW(totalExp)}
            </div>
          </div>
          <ul className="space-y-1">
            {expenseBreakdown.map((r) => (
              <li key={r.key}>
                <Link
                  to={EXPENSE_LINK[r.key] ?? "/sales-ledger"}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-rose-500/10 transition-colors"
                  title={`${r.label} 상세보기`}
                >
                  <span className="text-muted-foreground">{r.label}</span>
                  <span
                    className={`tabular-nums font-medium ${
                      r.amount === 0 ? "text-muted-foreground/50" : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {formatKRW(r.amount)}
                  </span>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between text-xs px-2 pt-2 mt-1 border-t border-rose-500/20">
              <span className="font-semibold text-rose-700 dark:text-rose-300">총 지출 합계</span>
              <span className="tabular-nums font-bold text-rose-700 dark:text-rose-300">
                {formatKRW(totalExp)}
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* 실질 순수익 */}
      <div className="rounded-2xl p-5 bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 opacity-90" />
          <div>
            <div className="text-[11px] opacity-80 flex items-center gap-1">
              실질 순수익 <ArrowDownRight className="size-3" /> (수익 − 지출)
            </div>
            <div className="text-[10px] opacity-70 tabular-nums">
              마진율 {Math.round(marginRate)}% · 1원 단위 정합성
            </div>
          </div>
        </div>
        <div className={`text-3xl md:text-4xl font-extrabold tabular-nums ${netMargin < 0 ? "text-rose-200" : ""}`}>
          {formatKRW(netMargin)}
        </div>
      </div>
    </div>
  );
};
