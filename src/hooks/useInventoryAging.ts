import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_DAYS = 60;
const DEFAULT_FALLBACK_PRICE = 0;

/** 관리자 설정값(장기재고 일수, 자산 폴백 단가)을 실시간으로 가져온다 */
export const useInventoryAging = () => {
  const [agingDays, setAgingDays] = useState<number>(DEFAULT_DAYS);
  const [fallbackPrice, setFallbackPrice] = useState<number>(DEFAULT_FALLBACK_PRICE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["inventory.aging_days", "inventory.fallback_unit_price"]);
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => (map[r.key] = r.value));
      if (typeof map["inventory.aging_days"] === "number")
        setAgingDays(map["inventory.aging_days"]);
      if (typeof map["inventory.fallback_unit_price"] === "number")
        setFallbackPrice(map["inventory.fallback_unit_price"]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel("inventory-aging-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  /** 입고일로부터 경과 일수 */
  const daysSince = (stockInDate: string | null | undefined) => {
    if (!stockInDate) return 0;
    const d = new Date(stockInDate).getTime();
    if (Number.isNaN(d)) return 0;
    return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
  };

  const isAged = (stockInDate: string | null | undefined) =>
    daysSince(stockInDate) >= agingDays;

  return { agingDays, fallbackPrice, isAged, daysSince, loading };
};
