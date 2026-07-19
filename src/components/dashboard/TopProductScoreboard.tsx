import { useCallback, useEffect, useMemo, useState } from "react";
import { Smartphone, Wifi, Tv, Home, Star, Lightbulb, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { usePeriod } from "@/contexts/PeriodContext";
import {
  PRODUCT_SCOPE_ITEMS,
  matchProductScope,
  useProductScope,
  type ProductScope,
} from "@/contexts/ProductScopeContext";
import { applyActivationFilter } from "@/lib/salesFilter";
import { cn } from "@/lib/utils";

const ICONS: Record<Exclude<ProductScope, "all">, typeof Smartphone> = {
  "모바일": Smartphone,
  "인터넷": Wifi,
  "TV프리": Tv,
  "스마트홈": Home,
  "대명": Star,
  "업셀": Lightbulb,
};

const ACCENT: Record<Exclude<ProductScope, "all">, string> = {
  "모바일": "text-primary",
  "인터넷": "text-chart-1",
  "TV프리": "text-chart-4",
  "스마트홈": "text-chart-5",
  "대명": "text-warning",
  "업셀": "text-success",
};

type Row = { product: string | null; sale_type: string | null; open_date: string | null };

export const TopProductScoreboard = () => {
  const { startDate, endDate, label } = usePeriod();
  const { scope, setScope } = useProductScope();
  const [rows, setRows] = useState<Row[]>([]);
  const [todayRows, setTodayRows] = useState<Row[]>([]);
  const [ydayRows, setYdayRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const ydayISO = yDate.toISOString().slice(0, 10);
    const [a, b, c] = await Promise.all([
      fetchAllRows(({ from, to }) =>
        applyActivationFilter(
          supabase.from("sales").select("product, sale_type, open_date"),
          startDate,
          endDate,
        ).range(from, to)
      ).then((data) => ({ data, error: null })),
      fetchAllRows(({ from, to }) =>
        applyActivationFilter(
          supabase.from("sales").select("product, sale_type, open_date"),
          todayISO,
          todayISO,
        ).range(from, to)
      ).then((data) => ({ data, error: null })),
      fetchAllRows(({ from, to }) =>
        applyActivationFilter(
          supabase.from("sales").select("product, sale_type, open_date"),
          ydayISO,
          ydayISO,
        ).range(from, to)
      ).then((data) => ({ data, error: null })),
    ]);
    setRows((a.data ?? []) as Row[]);
    setTodayRows((b.data ?? []) as Row[]);
    setYdayRows((c.data ?? []) as Row[]);
  }, [startDate, endDate]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("top-product-scoreboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const stats = useMemo(
    () =>
      PRODUCT_SCOPE_ITEMS.map((it) => ({
        ...it,
        total: rows.filter((r) => matchProductScope(r.product, it.key, { saleType: r.sale_type })).length,
        today: todayRows.filter((r) => matchProductScope(r.product, it.key, { saleType: r.sale_type })).length,
        yday: ydayRows.filter((r) => matchProductScope(r.product, it.key, { saleType: r.sale_type })).length,
      })),
    [rows, todayRows, ydayRows],
  );

  return (
    <div className="relative h-full w-full flex flex-col premium-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold tracking-tight text-foreground">핵심 상품 성과 보드</h2>
          <span className="text-[10px] text-foreground/60">{label} 누적 · 카드 클릭 시 하단 위젯 필터</span>
        </div>
        {scope !== "all" && (
          <button
            onClick={() => setScope("all")}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
          >
            <RotateCcw className="size-3" />
            필터 해제
          </button>
        )}
      </div>

      {/* 컨테이너 가로폭에 맞춰 자동 리플로우되는 반응형 그리드 (auto-fit, 모바일 2열) */}
      <div className="-mx-1 px-1 flex-1 min-h-0">
        <div
          className="grid gap-2 h-full"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 45%), 1fr))" }}
        >
          {stats.map((s) => {
            const Icon = ICONS[s.key];
            const active = scope === s.key;
            const delta = s.today - s.yday;
            const deltaSign = delta > 0 ? "+" : "";
            return (
              <button
                key={s.key}
                onClick={() => setScope(active ? "all" : s.key)}
                className={cn(
                  "text-left px-2.5 py-2 rounded-xl border bg-card transition-all duration-300 ease-in-out group",
                  active
                    ? "border-slate-300 bg-slate-50 shadow-sm ring-1 ring-slate-200"
                    : "border-slate-100 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-md",
                )}
              >
                <div className={cn("flex items-center gap-1.5 text-[11px] font-bold", ACCENT[s.key])}>
                  <Icon className="size-3.5" />
                  <span className="truncate">{s.label}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl xl:text-3xl font-black tabular-nums leading-none text-slate-900">
                    {s.total.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">건</span>
                </div>
                <div
                  className={cn(
                    "mt-1.5 text-[11px] font-bold tabular-nums",
                    delta > 0
                      ? "text-[hsl(0_85%_55%)]"
                      : delta < 0
                        ? "text-[hsl(215_90%_55%)]"
                        : "text-foreground/50",
                  )}
                >
                  {s.today === 0 && s.yday === 0
                    ? "오늘 0건"
                    : `${deltaSign}${delta} 오늘 (${s.today}건)`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};