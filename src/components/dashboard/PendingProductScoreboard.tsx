import { useCallback, useEffect, useMemo, useState } from "react";
import { Smartphone, Wifi, Tv, Home, Star, Lightbulb, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import {
  PRODUCT_SCOPE_ITEMS,
  matchProductScope,
  type ProductScope,
} from "@/contexts/ProductScopeContext";
import { applyPendingActivationFilter } from "@/lib/salesFilter";
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

type Row = { product: string | null; sale_type: string | null; status: string | null };

/**
 * 미개통 대기 상품 보드
 * - 상태 [택배발송] / [청약완료] 데이터만 카테고리별 집계 (실적 미인정 분류)
 * - TopProductScoreboard 와 동일한 레이아웃/그리드/카드 규격 유지
 */
export const PendingProductScoreboard = () => {
  const { startDate, endDate, label } = usePeriod();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await applyPendingActivationFilter(
      supabase.from("sales").select("product, sale_type, status"),
      startDate,
      endDate,
    ).limit(10000);
    setRows((res.data ?? []) as Row[]);
  }, [startDate, endDate]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("pending-product-scoreboard-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const stats = useMemo(
    () =>
      PRODUCT_SCOPE_ITEMS.map((it) => {
        const filtered = rows.filter((r) =>
          matchProductScope(r.product, it.key, { saleType: r.sale_type }),
        );
        const shipping = filtered.filter((r) => (r.status ?? "").trim() === "택배발송").length;
        const subscribed = filtered.filter((r) => (r.status ?? "").trim() === "청약완료").length;
        return { ...it, total: filtered.length, shipping, subscribed };
      }),
    [rows],
  );

  const grandTotal = useMemo(() => stats.reduce((s, x) => s + x.total, 0), [stats]);

  return (
    <div className="relative h-full w-full flex flex-col bg-card border border-border/60 shadow-sm rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold tracking-tight text-foreground inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-warning" />
            미개통 대기 상품 보드
          </h2>
          <span className="text-[10px] text-foreground/60">
            {label} · 택배발송 + 청약완료 (실적 미인정)
          </span>
        </div>
        <span className="text-[11px] font-bold tabular-nums text-warning">
          총 {grandTotal.toLocaleString()}건 대기
        </span>
      </div>

      <div className="-mx-1 px-1 flex-1 min-h-0">
        <div
          className="grid gap-2 md:gap-3 h-full"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 45%), 1fr))" }}
        >
          {stats.map((s) => {
            const Icon = ICONS[s.key];
            return (
              <div
                key={s.key}
                className={cn(
                  "text-left px-3 py-2.5 rounded-xl border bg-card transition-all",
                  "border-border/60",
                  s.total > 0 && "border-warning/40 bg-warning/5",
                )}
              >
                <div className={cn("flex items-center gap-1.5 text-[11px] font-bold", ACCENT[s.key])}>
                  <Icon className="size-3.5" />
                  <span className="truncate">{s.label}</span>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1">
                  <span className="text-2xl xl:text-3xl font-black tabular-nums leading-none text-foreground">
                    {s.total.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-foreground/60">건</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold tabular-nums text-foreground/70">
                  <span className="inline-flex items-center gap-0.5">
                    <span className="size-1.5 rounded-full bg-[hsl(215_90%_55%)]" />
                    청약 {s.subscribed}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <span className="size-1.5 rounded-full bg-[hsl(38_92%_50%)]" />
                    택배 {s.shipping}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};