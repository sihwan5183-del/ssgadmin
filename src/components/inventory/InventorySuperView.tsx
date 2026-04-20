import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, Smartphone, Wallet } from "lucide-react";
import { useInventoryAging } from "@/hooks/useInventoryAging";
import { useStores } from "@/hooks/useStores";
import { formatShortKRW } from "@/data/mockData";

interface Device {
  id: string;
  model: string;
  device_kind: string | null;
  status: string;
  stock_in_date: string | null;
  purchase_price: number | null;
  current_store_id: string | null;
}

const ACTIVE_STATUSES = new Set(["입고", "재고", "판매중", "이동중"]);

/**
 * 매장 × 유형(휴대폰/IoT) 매트릭스 + 장기재고/총자산 요약
 * - admin/ceo 슈퍼뷰 전용
 */
export const InventorySuperView = () => {
  const [rows, setRows] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const { agingDays, fallbackPrice, isAged } = useInventoryAging();
  const { stores } = useStores();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("device_inventory")
        .select("id, model, device_kind, status, stock_in_date, purchase_price, current_store_id");
      setRows((data ?? []) as Device[]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("inventory-superview-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "device_inventory" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const active = useMemo(() => rows.filter((r) => ACTIVE_STATUSES.has(r.status)), [rows]);

  const totals = useMemo(() => {
    let phone = 0, iot = 0, agedN = 0, asset = 0;
    active.forEach((r) => {
      const kind = (r.device_kind ?? "휴대폰") === "IoT(도그마루)" ? "iot" : "phone";
      if (kind === "iot") iot += 1; else phone += 1;
      if (isAged(r.stock_in_date)) agedN += 1;
      asset += Number(r.purchase_price) > 0 ? Number(r.purchase_price) : fallbackPrice;
    });
    return { phone, iot, agedN, asset };
  }, [active, isAged, fallbackPrice]);

  // 매트릭스: storeId -> { phone, iot, aged, asset }
  const matrix = useMemo(() => {
    const m = new Map<string | null, { phone: number; iot: number; aged: number; asset: number }>();
    active.forEach((r) => {
      const sid = r.current_store_id ?? null;
      const cur = m.get(sid) ?? { phone: 0, iot: 0, aged: 0, asset: 0 };
      const isIoT = (r.device_kind ?? "휴대폰") === "IoT(도그마루)";
      if (isIoT) cur.iot += 1; else cur.phone += 1;
      if (isAged(r.stock_in_date)) cur.aged += 1;
      cur.asset += Number(r.purchase_price) > 0 ? Number(r.purchase_price) : fallbackPrice;
      m.set(sid, cur);
    });
    return m;
  }, [active, isAged, fallbackPrice]);

  const storeName = (id: string | null) => {
    if (!id) return "(미지정)";
    return stores.find((s) => s.id === id)?.name ?? "(알 수 없음)";
  };

  const storeIds = useMemo(
    () => Array.from(matrix.keys()).sort((a, b) => storeName(a).localeCompare(storeName(b), "ko")),
    [matrix, stores],
  );

  return (
    <div className="space-y-5">
      {/* 요약 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 glass border-primary/30">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Smartphone className="size-3 text-primary" /> 휴대폰
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-primary">{totals.phone}</div>
        </Card>
        <Card className="p-4 glass border-purple-500/30">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-purple-400" /> IoT(도그마루)
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-purple-300">{totals.iot}</div>
        </Card>
        <Card className="p-4 glass border-destructive/40">
          <div className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="size-3" /> 장기({agingDays}일+)
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1 text-destructive">{totals.agedN}</div>
        </Card>
        <Card className="p-4 glass border-border/40">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Wallet className="size-3" /> 총 재고 자산
          </div>
          <div className="text-xl font-bold tabular-nums mt-1">{formatShortKRW(totals.asset)}</div>
        </Card>
      </div>

      {/* 매장 × 유형 매트릭스 */}
      <Card className="glass border-border/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
          <Building2 className="size-4 text-primary-glow" />
          <h3 className="font-semibold text-sm">매장 × 유형 재고 매트릭스</h3>
          <span className="text-xs text-muted-foreground ml-auto">활성 재고 기준 (입고/재고/판매중/이동중)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">매장</th>
                <th className="text-right px-3 py-2.5">휴대폰</th>
                <th className="text-right px-3 py-2.5">IoT(도그마루)</th>
                <th className="text-right px-3 py-2.5">합계</th>
                <th className="text-right px-3 py-2.5">장기재고</th>
                <th className="text-right px-3 py-2.5">자산(추정)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
              ) : storeIds.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">활성 재고가 없습니다</td></tr>
              ) : (
                storeIds.map((sid) => {
                  const v = matrix.get(sid)!;
                  const total = v.phone + v.iot;
                  return (
                    <tr key={sid ?? "none"} className="border-t border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-2.5 font-medium">{storeName(sid)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <Badge className="bg-primary/15 text-primary border-primary/30">{v.phone}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/40">{v.iot}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{total}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {v.aged > 0 ? (
                          <Badge variant="destructive">{v.aged}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                        {formatShortKRW(v.asset)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {storeIds.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border/60 bg-muted/30 font-semibold">
                  <td className="px-3 py-2.5">합계</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totals.phone}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totals.iot}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{totals.phone + totals.iot}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-destructive">{totals.agedN}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatShortKRW(totals.asset)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
};
