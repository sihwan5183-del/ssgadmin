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
        .select("cash_support_amount, receivable_amount, receivable_paid")
        .eq("open_date", todayISO);
      const rows = data ?? [];
      const cash = rows.reduce((s, r: any) => s + Number(r.cash_support_amount ?? 0), 0);
      const receivable = rows
        .filter((r: any) => r.receivable_paid === "입금완료")
        .reduce((s, r: any) => s + Number(r.receivable_amount ?? 0), 0);
      setToday({ cash, receivable, count: rows.length, loading: false });
    })();
  }, []);

  const total = today.cash + today.receivable;

  return (
    <div className="group relative glass rounded-2xl p-5 overflow-hidden shadow-card-elevated hover:shadow-elevated transition-all duration-500 hover:-translate-y-0.5">
      <div className="absolute -top-12 -right-12 size-40 rounded-full bg-gradient-to-br from-emerald-500/30 to-emerald-400/5 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="size-10 rounded-xl grid place-items-center bg-gradient-to-br from-emerald-500/30 to-emerald-400/5 text-emerald-300">
            <Banknote className="size-5" />
          </div>
          <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300">
            <TrendingUp className="size-3" /> 오늘
          </div>
        </div>
        <div className="mt-5 text-sm text-muted-foreground">오늘의 현금 입금 합계</div>
        <div className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
          {today.loading ? "…" : formatShortKRW(total)}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
          <span>현금개통 {formatShortKRW(today.cash)}</span>
          <span className="text-border">·</span>
          <span>입금완료 {formatShortKRW(today.receivable)}</span>
          <span className="text-border">·</span>
          <span>{today.count}건</span>
        </div>
      </div>
    </div>
  );
};
