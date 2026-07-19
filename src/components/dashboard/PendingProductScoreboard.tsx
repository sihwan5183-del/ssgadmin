import { useCallback, useEffect, useMemo, useState } from "react";
import { Smartphone, Wifi, Tv, Home, Star, Lightbulb, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { usePeriod } from "@/contexts/PeriodContext";
import {
  PRODUCT_SCOPE_ITEMS,
  matchProductScope,
  type ProductScope,
} from "@/contexts/ProductScopeContext";
import { applyPendingActivationFilter } from "@/lib/salesFilter";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const gotoLedger = (productLabel?: string) => {
    const params = new URLSearchParams();
    params.set("status", "택배발송,청약완료");
    params.set("from_dashboard", "1");
    if (productLabel) params.set("product", productLabel);
    navigate(`/sales-ledger?${params.toString()}`);
  };

  const load = useCallback(async () => {
    const data = await fetchAllRows<Row>(({ from, to }) =>
      applyPendingActivationFilter(
        supabase.from("sales").select("product, sale_type, status"),
        startDate,
        endDate,
      ).range(from, to)
    );
    setRows(data);
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
    <div className="relative h-full w-full flex flex-col premium-card p-3 md:p-4">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-warning" />
            미개통 대기 상품 보드
          </h2>
          <span className="text-[10px] text-slate-600">
            {label} · 택배발송 + 청약완료 (실적 미인정)
          </span>
        </div>
        <button
          type="button"
          onClick={() => gotoLedger()}
          className="text-[11px] font-bold tabular-nums text-warning hover:underline"
          title="판매실적장표에서 보기"
        >
          총 {grandTotal.toLocaleString()}건 대기 →
        </button>
      </div>

      <div className="-mx-1 px-1 flex-1 min-h-0">
        <div
          className="grid gap-2 h-full"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 45%), 1fr))" }}
        >
          {stats.map((s) => {
            const Icon = ICONS[s.key];
            return (
              <button
                type="button"
                key={s.key}
                onClick={() => gotoLedger(s.label)}
                className={cn(
                  "text-left px-2.5 py-2 rounded-xl border bg-card transition-all duration-300 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-300",
                  "border-slate-100 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-md",
                  s.total > 0 && "border-amber-200 bg-amber-50/40",
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
                  <span className="text-[10px] font-bold text-slate-700">건</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2.5 text-[11px] font-semibold tabular-nums text-slate-800">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-slate-400" />
                    청약 {s.subscribed}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-slate-300" />
                    택배 {s.shipping}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};