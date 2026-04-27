import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, TrendingUp } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";

/**
 * 오늘의 현금 시재 — 당일 cash_support_amount + 입금완료 receivable_amount 합계
 */
export const CashTodayCard = () => {
  const [today, setToday] = useState({ cash: 0, receivable: 0, count: 0, loading: true });

  useEffect(() => {
    (async () => {
      const todayISO = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("sales")
        .select("cash_support_amount, receivable_amount, receivable_paid, voucher, voucher_returned")
        .eq("open_date", todayISO);
      const all = data ?? [];
      // 상품권 미반납 건은 정산 합계에서 제외
      const rows = all.filter(
        (r: any) => !(r.voucher && String(r.voucher).trim() !== "" && r.voucher_returned !== "유"),
      );
      const cash = rows.reduce((s, r: any) => s + Number(r.cash_support_amount ?? 0), 0);
      const receivable = rows
        .filter((r: any) => r.receivable_paid === "입금완료")
        .reduce((s, r: any) => s + Number(r.receivable_amount ?? 0), 0);
      setToday({ cash, receivable, count: rows.length, loading: false });
    })();
  }, []);

  const total = today.cash + today.receivable;

  return (
    <div
      className="group relative glass rounded-xl p-3 overflow-hidden shadow-card-elevated hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5"
      title={`현금개통 ${formatShortKRW(today.cash)} · 입금완료 ${formatShortKRW(today.receivable)} · ${today.count}건`}
    >
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-400/5 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="size-8 rounded-lg grid place-items-center bg-gradient-to-br from-emerald-500/30 to-emerald-400/5 text-emerald-300">
            <Banknote className="size-4" />
          </div>
          <div className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
            <TrendingUp className="size-2.5" /> 오늘
          </div>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground truncate">오늘의 현금 입금 합계</div>
        <div className="mt-0.5 text-lg md:text-xl font-bold tracking-tight tabular-nums">
          {today.loading ? "…" : formatShortKRW(total)}
        </div>
      </div>
    </div>
  );
};
