import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryAging } from "@/hooks/useInventoryAging";
import { useLowStock } from "@/hooks/useLowStock";
import { Link } from "react-router-dom";
import { formatShortKRW } from "@/data/mockData";

interface Device {
  id: string;
  model: string;
  status: string;
  stock_in_date: string | null;
  purchase_price: number | null;
}

export const InventoryWidget = () => {
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const { agingDays, fallbackPrice, isAged, daysSince } = useInventoryAging();
  const { threshold: lowThreshold, low: lowModels } = useLowStock();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("device_inventory")
        .select("id, model, status, stock_in_date, purchase_price")
        .neq("status", "개통완료")
        .neq("status", "판매완료")
        .order("stock_in_date", { ascending: true })
        .limit(1000);
      setRows((data ?? []) as Device[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("inventory-widget")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_inventory" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const totalAsset = useMemo(
    () =>
      rows.reduce(
        (s, r) => s + (Number(r.purchase_price) > 0 ? Number(r.purchase_price) : fallbackPrice),
        0,
      ),
    [rows, fallbackPrice],
  );

  const top5 = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.model, (m.get(r.model) ?? 0) + 1));
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [rows]);

  const aged = useMemo(() => rows.filter((r) => isAged(r.stock_in_date)), [rows, isAged]);
  const maxCount = top5[0]?.[1] ?? 1;

  return (
    <Card className="p-5 glass border-border/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-primary-glow" />
          <h3 className="font-semibold">단말기 재고</h3>
        </div>
        <Link to="/device-inventory" className="text-xs text-primary-glow hover:underline">
          전체보기 →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-[11px] text-muted-foreground">총 재고 자산</div>
          <div className="text-lg font-bold tabular-nums mt-0.5">
            {loading ? "…" : formatShortKRW(totalAsset)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            보유 {rows.length}대
            {fallbackPrice === 0 && rows.some((r) => !r.purchase_price) && (
              <span className="ml-1 text-warning">· 매입가 미입력 일부</span>
            )}
          </div>
        </div>
        <div
          className={`p-3 rounded-lg ${
            aged.length > 0 ? "bg-destructive/15 border border-destructive/40" : "bg-muted/30"
          }`}
        >
          <div className="text-[11px] flex items-center gap-1 text-muted-foreground">
            {aged.length > 0 && <AlertTriangle className="size-3 text-destructive" />}
            장기재고 ({agingDays}일+)
          </div>
          <div className={`text-lg font-bold tabular-nums mt-0.5 ${aged.length > 0 ? "text-destructive" : ""}`}>
            {loading ? "…" : `${aged.length}대`}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">우선 판매 권장</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <TrendingUp className="size-3" /> 모델별 재고 Top 5
        </div>
        {top5.length === 0 && !loading ? (
          <div className="text-xs text-muted-foreground py-2">재고 데이터가 없습니다</div>
        ) : (
          top5.map(([model, count]) => (
            <div key={model} className="flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="truncate font-medium">{model}</span>
                  <span className="tabular-nums text-muted-foreground text-xs">{count}대</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-gradient-primary"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {aged.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/40">
          <div className="text-[11px] font-semibold text-destructive mb-1.5">우선 판매 모델</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(new Set(aged.map((a) => a.model)))
              .slice(0, 6)
              .map((m) => {
                const oldest = aged
                  .filter((a) => a.model === m)
                  .reduce((d, a) => Math.max(d, daysSince(a.stock_in_date)), 0);
                return (
                  <Badge key={m} variant="destructive" className="text-[10px]">
                    {m} · {oldest}일
                  </Badge>
                );
              })}
          </div>
        </div>
      )}
    </Card>
  );
};
