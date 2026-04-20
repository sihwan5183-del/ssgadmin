import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "./useAppSettings";

/**
 * 모델별 보유 수량 ≤ 임계값(app_settings.inventory.low_stock_threshold) 인 모델 리스트
 * '재고/판매중'만 카운트 (개통완료/반품 제외)
 */
export const useLowStock = () => {
  const { settings } = useAppSettings();
  const threshold = Number(settings["inventory.low_stock_threshold"] ?? 3);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("device_inventory")
        .select("model, status")
        .in("status", ["재고", "판매중"])
        .limit(2000);
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        if (!r.model) return;
        map[r.model] = (map[r.model] ?? 0) + 1;
      });
      setCounts(map);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("low-stock-" + Math.random().toString(36).slice(2))
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

  const low = useMemo(
    () =>
      Object.entries(counts)
        .filter(([, n]) => n <= threshold)
        .sort((a, b) => a[1] - b[1]),
    [counts, threshold],
  );

  const isLow = (model: string) => (counts[model] ?? 0) <= threshold;

  return { threshold, counts, low, isLow, loading };
};
