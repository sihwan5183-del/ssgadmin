import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Smartphone, Sparkles, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useStrategyConfig } from "@/hooks/useStrategyConfig";

export const ActivationBreakdown = () => {
  const { startDate, endDate } = usePeriod();
  const { products } = useStrategyConfig();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("channel, sale_type, product, bundle, custom_fields")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(10000);
      if (!alive) return;
      setRows(data ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [startDate, endDate]);

  const mobileStats = useMemo(() => {
    const types = [
      { label: "MNP (번호이동)", key: "MNP", color: "hsl(195 90% 60%)" },
      { label: "신규", key: "신규", color: "hsl(160 80% 50%)" },
      { label: "기변", key: "기변", color: "hsl(270 90% 65%)" },
    ];
    return types.map((t) => ({
      ...t,
      count: rows.filter((r) => (r.product || "").includes("모바일") && r.sale_type === t.key).length,
    }));
  }, [rows]);

  const secondDeviceCount = useMemo(() => {
    return rows.filter((r) => {
      const p = (r.product || "").toLowerCase();
      const st = (r.sale_type || "").toLowerCase();
      return /2nd|세컨|워치|watch|태블릿|tablet/.test(p) || /2nd|세컨|워치|watch|태블릿|tablet/.test(st);
    }).length;
  }, [rows]);

  const strategyStats = useMemo(() => {
    return products.map((p) => ({
      name: p.name,
      color: p.color,
      count: rows.filter((r) => {
        const fields = [r.product, r.bundle, r.sale_type].filter(Boolean) as string[];
        return fields.some((f) => f.includes(p.name));
      }).length,
    }));
  }, [rows, products]);

  const bundleStats = useMemo(() => {
    const types = [
      { label: "MNP동판", key: "MNP", color: "hsl(195 90% 60%)" },
      { label: "기변동판", key: "기변", color: "hsl(270 90% 65%)" },
      { label: "신규동판", key: "신규", color: "hsl(160 80% 50%)" },
    ];
    const bundles = rows.filter((r) => r.bundle === "Y");
    return {
      total: bundles.length,
      items: types.map((t) => ({
        ...t,
        count: bundles.filter((r) => (r.custom_fields as any)?.bundle_type === t.key).length,
      })),
    };
  }, [rows]);

  const usimStats = useMemo(() => {
    const usim = rows.filter((r) => r.sale_type === "USIM MNP" || (r.product || "").includes("USIM"));
    const map = new Map<string, number>();
    usim.forEach((r) => {
      const ch = r.channel || "기타";
      map.set(ch, (map.get(ch) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const totalMobile = mobileStats.reduce((s, r) => s + r.count, 0);
  const totalStrategy = strategyStats.reduce((s, r) => s + r.count, 0);
  const maxStrategy = Math.max(1, ...strategyStats.map((s) => s.count));
  const totalUsim = usimStats.reduce((s, r) => s + r.count, 0);
  const maxUsim = Math.max(1, ...usimStats.map((r) => r.count));

  return (
    <>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-primary/10 grid place-items-center">
                <Smartphone className="size-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">모바일 유형별 건수</h3>
                <p className="text-[11px] text-muted-foreground">MNP · 신규 · 기변 · 2nd</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">합계</div>
              <div className="font-bold tabular-nums">{(totalMobile + secondDeviceCount).toLocaleString()}건</div>
            </div>
          </div>

          <div className="space-y-4">
            {mobileStats.map((row) => {
              const pct = totalMobile > 0 ? (row.count / totalMobile) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium">{row.label}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold tabular-nums">{row.count}</span>
                      <span className="text-[11px] text-muted-foreground">건</span>
                      <span className="text-xs text-primary tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 mt-1 border-t border-border/40">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: "hsl(35 95% 60%)" }} />
                  2nd 디바이스 <span className="text-[10px] text-muted-foreground font-normal">(워치·태블릿 등)</span>
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums">{secondDeviceCount}</span>
                  <span className="text-[11px] text-muted-foreground">건</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 glass">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-success/10 grid place-items-center">
                <Sparkles className="size-4 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">전략 상품 건수</h3>
                <p className="text-[11px] text-muted-foreground">{strategyStats.map((s) => s.name).join(" · ")}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">합계</div>
              <div className="font-bold tabular-nums">{totalStrategy}건</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {strategyStats.map((row) => {
              const ratio = (row.count / maxStrategy) * 100;
              return (
                <div key={row.name} className="p-3 rounded-xl border border-border/50 bg-background/40">
                  <div className="text-xs text-muted-foreground">{row.name}</div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold tabular-nums">{row.count}</span>
                    <span className="text-[11px] text-muted-foreground">건</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${ratio}%`, background: row.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {bundleStats.total > 0 && (
        <section className="mb-6">
          <Card className="p-6 glass">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-primary/10 grid place-items-center">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">동판/번들 유형별</h3>
                  <p className="text-[11px] text-muted-foreground">MNP · 기변 · 신규 동판</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">합계</div>
                <div className="font-bold tabular-nums">{bundleStats.total}건</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {bundleStats.items.map((row) => {
                const pct = bundleStats.total > 0 ? (row.count / bundleStats.total) * 100 : 0;
                return (
                  <div key={row.key} className="p-3 rounded-xl border border-border/50 bg-background/40">
                    <div className="text-xs text-muted-foreground">{row.label}</div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold tabular-nums">{row.count}</span>
                      <span className="text-[11px] text-muted-foreground">건</span>
                      <span className="text-[11px] text-primary tabular-nums ml-auto">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: row.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      {totalUsim > 0 && (
        <section className="mb-6">
          <Card className="p-6 glass">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="size-9 rounded-xl bg-warning/10 grid place-items-center">
                  <CreditCard className="size-4 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">USIM 단독개통 (USIM MNP) · 채널별</h3>
                  <p className="text-[11px] text-muted-foreground">유심만 개통한 건은 모두 USIM MNP — 인입 경로별 집계</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">합계</div>
                <div className="font-bold tabular-nums">{totalUsim}건</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {usimStats.map((r) => {
                const ratio = (r.count / maxUsim) * 100;
                return (
                  <div key={r.channel} className="p-3 rounded-xl border border-border/50 bg-background/40">
                    <div className="text-xs text-muted-foreground">{r.channel}</div>
                    <div className="text-2xl font-bold tabular-nums mt-1">{r.count}<span className="text-[11px] text-muted-foreground ml-1">건</span></div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      {loading && <div className="text-center text-xs text-muted-foreground -mt-2 mb-4">실적 데이터 동기화 중…</div>}
    </>
  );
};
