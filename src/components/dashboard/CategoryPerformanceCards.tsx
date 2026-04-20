import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Smartphone, Home, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortKRW } from "@/data/mockData";
import { classifySale, pureProfit, upsellExtraRevenue, DEFAULT_CATEGORY_META, SalesCategory } from "@/lib/salesCategory";

type TabKey = "all" | SalesCategory;

interface Bucket {
  count: number; // 개통 건수 (업셀은 제외)
  profit: number; // 순수 수익
  extra: number; // 업셀 부가 수익
}

const tabs: { key: TabKey; label: string; icon: any; color: string }[] = [
  { key: "all", label: "전체", icon: Layers, color: "hsl(var(--primary))" },
  { key: "mobile", label: "모바일", icon: Smartphone, color: DEFAULT_CATEGORY_META.mobile.color },
  { key: "home", label: "홈", icon: Home, color: DEFAULT_CATEGORY_META.home.color },
  { key: "upsell", label: "업셀", icon: Sparkles, color: DEFAULT_CATEGORY_META.upsell.color },
];

/**
 * 카테고리별 실적 카드 — 탭 전환식
 * 업셀은 '개통 건수'에 포함되지 않고 '부가 수익'으로 별도 집계
 */
export const CategoryPerformanceCards = () => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("product, vas1, vas2, vas_fee, net_fee, distributor_amount, cash_support_amount, extra_subsidy")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(20000);
      if (!alive) return;
      setRows(data ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const buckets = useMemo(() => {
    const b: Record<SalesCategory, Bucket> = {
      mobile: { count: 0, profit: 0, extra: 0 },
      home: { count: 0, profit: 0, extra: 0 },
      upsell: { count: 0, profit: 0, extra: 0 },
    };
    rows.forEach((r) => {
      const cat = classifySale(r);
      if (cat === "upsell") {
        b.upsell.extra += upsellExtraRevenue(r);
        b.upsell.profit += pureProfit(r);
      } else {
        b[cat].count += 1;
        b[cat].profit += pureProfit(r);
      }
    });
    const all: Bucket = {
      count: b.mobile.count + b.home.count, // 업셀은 개통 건수에서 제외
      profit: b.mobile.profit + b.home.profit + b.upsell.profit,
      extra: b.upsell.extra,
    };
    const avgPrice = (bk: Bucket) => (bk.count > 0 ? bk.profit / bk.count : 0);
    return { all, ...b, avgPrice };
  }, [rows]);

  const active: Bucket =
    tab === "all"
      ? buckets.all
      : tab === "mobile"
      ? buckets.mobile
      : tab === "home"
      ? buckets.home
      : buckets.upsell;
  const isUpsell = tab === "upsell";
  const avgPrice = buckets.avgPrice(active);

  return (
    <div className="glass-strong rounded-2xl p-5 shadow-card-elevated col-span-2 lg:col-span-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-secondary animate-pulse" />
            카테고리별 누적 실적 · 실시간
          </div>
          <h3 className="mt-1 text-lg md:text-xl font-bold tracking-tight">
            모바일 / 홈 / 업셀 분리 분석
          </h3>
        </div>

        <div className="flex p-1 rounded-xl bg-muted/50 border border-border/40 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-sm text-muted-foreground text-center">불러오는 중…</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label={isUpsell ? "업셀 건수" : "개통 건수"} value={`${active.count.toLocaleString()}건`} hint={isUpsell ? "참고용 (개통합계 제외)" : "업셀 제외"} />
          <Tile label="순수 수익" value={formatShortKRW(active.profit)} hint="net − 지원/출고" highlight />
          {isUpsell ? (
            <Tile label="부가 수익(VAS+net)" value={formatShortKRW(active.extra)} hint="업셀 전용 별도 집계" highlight />
          ) : (
            <Tile label="평균 단가" value={formatShortKRW(avgPrice)} hint="순수 수익 ÷ 건수" />
          )}
          <Tile
            label="비중"
            value={
              buckets.all.profit > 0
                ? `${Math.round((active.profit / buckets.all.profit) * 1000) / 10}%`
                : "—"
            }
            hint="전체 순수 수익 대비"
          />
        </div>
      )}
    </div>
  );
};

const Tile = ({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) => (
  <div className="rounded-xl p-3 bg-muted/30 border border-border/40">
    <div className="text-[11px] text-muted-foreground font-medium">{label}</div>
    <div
      className={cn(
        "mt-1.5 text-xl font-bold tabular-nums",
        highlight ? "text-gradient" : "text-foreground"
      )}
    >
      {value}
    </div>
    {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
  </div>
);
