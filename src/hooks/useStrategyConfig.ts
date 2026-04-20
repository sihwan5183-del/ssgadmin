import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppSettings } from "./useAppSettings";

export interface StrategyProduct {
  name: string;
  target: number;
  color: string;
}

const DEFAULT_PRODUCTS: StrategyProduct[] = [
  { name: "인터넷", target: 80, color: "hsl(195 90% 60%)" },
  { name: "TV프리", target: 60, color: "hsl(270 90% 65%)" },
  { name: "IOT", target: 50, color: "hsl(320 90% 65%)" },
  { name: "대명", target: 30, color: "hsl(35 95% 60%)" },
];

const PALETTE = [
  "hsl(195 90% 60%)",
  "hsl(270 90% 65%)",
  "hsl(320 90% 65%)",
  "hsl(35 95% 60%)",
  "hsl(160 80% 50%)",
  "hsl(0 80% 60%)",
];

/**
 * 어드민 정의 전략상품/전략모델 + 실시간 sales 집계
 */
export const useStrategyConfig = () => {
  const { settings } = useAppSettings();

  const products: StrategyProduct[] = useMemo(() => {
    const raw = settings["dashboard.strategy_products"];
    if (Array.isArray(raw) && raw.length > 0) return raw as StrategyProduct[];
    return DEFAULT_PRODUCTS;
  }, [settings]);

  const modelNames: string[] = useMemo(() => {
    const raw = settings["dashboard.strategy_models"];
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [settings]);

  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const fromISO = monthStart.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("sales")
        .select("device_model, product, bundle, sale_type")
        .gte("open_date", fromISO)
        .limit(5000);
      const pc: Record<string, number> = {};
      const mc: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        const fields = [r.product, r.bundle, r.sale_type].filter(Boolean) as string[];
        products.forEach((p) => {
          if (fields.some((f) => f.includes(p.name))) pc[p.name] = (pc[p.name] ?? 0) + 1;
        });
        if (r.device_model) mc[r.device_model] = (mc[r.device_model] ?? 0) + 1;
      });
      setProductCounts(pc);
      setModelCounts(mc);
      setLoading(false);
    };
    load();
  }, [products]);

  const productData = products.map((p, i) => ({
    ...p,
    color: p.color || PALETTE[i % PALETTE.length],
    current: productCounts[p.name] ?? 0,
  }));

  const modelData = modelNames.map((name, i) => ({
    name,
    color: PALETTE[i % PALETTE.length],
    current: modelCounts[name] ?? 0,
  }));

  return { products: productData, models: modelData, loading };
};
