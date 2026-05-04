import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductRatePlan {
  id: string;
  product: string;
  rate_plan: string;
  sort_order: number;
  active: boolean;
  default_sale_type: string | null;
  default_vas1: string | null;
  default_vas2: string | null;
  vas1_duration: number | null;
  vas2_duration: number | null;
  allowed_sale_types: string[];
  vas_required: boolean;
  vas1_locked: boolean;
  vas2_locked: boolean;
  /** 이 상품-요금제 조합과 함께 사용 가능한 부가서비스 명단 (모바일/2nd 전용) */
  linked_vas: string[];
}

/**
 * 부가서비스 매핑 활성화 대상 상품군: 모바일 / 2nd 만 허용.
 * (요구사항: 인터넷·TV 등은 부가서비스 매핑 미노출)
 */
export const isVasEligibleProduct = (product: string | null | undefined): boolean => {
  if (!product) return false;
  const p = String(product).trim();
  if (!p) return false;
  const upper = p.toUpperCase();
  if (p.includes("모바일")) return true;
  if (upper === "2ND" || p.includes("2nd") || p.includes("세컨")) return true;
  return false;
};

/**
 * Returns the full mapping list. Use `getPlansForProduct(product)` to filter
 * rate plans available for a specific product. If no mappings exist for the
 * given product, returns an empty array — the caller can decide on a fallback.
 */
export const useProductRatePlans = () => {
  const [mappings, setMappings] = useState<ProductRatePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("product_rate_plans")
      .select("*")
      .order("product", { ascending: true })
      .order("sort_order", { ascending: true });
    setMappings((data ?? []) as ProductRatePlan[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getPlansForProduct = useCallback(
    (product: string | null | undefined): string[] => {
      if (!product) return [];
      return mappings
        .filter((m) => m.active && m.product === product)
        .map((m) => m.rate_plan);
    },
    [mappings]
  );

  /** Get the first mapping row for a product to read defaults */
  const getDefaultsForProduct = useCallback(
    (product: string | null | undefined) => {
      if (!product) return null;
      return mappings.find((m) => m.active && m.product === product) ?? null;
    },
    [mappings]
  );

  /** Get allowed sale types for a product (empty = all allowed) */
  const getAllowedSaleTypes = useCallback(
    (product: string | null | undefined): string[] => {
      if (!product) return [];
      const row = mappings.find((m) => m.active && m.product === product);
      return row?.allowed_sale_types ?? [];
    },
    [mappings]
  );

  /** 특정 상품의 특정 요금제에 매핑된 부가서비스 목록 (모바일/2nd 전용) */
  const getLinkedVasForPlan = useCallback(
    (product: string | null | undefined, ratePlan: string | null | undefined): string[] => {
      if (!isVasEligibleProduct(product) || !ratePlan) return [];
      const row = mappings.find(
        (m) => m.active && m.product === product && m.rate_plan === ratePlan,
      );
      return Array.isArray(row?.linked_vas) ? (row!.linked_vas as string[]) : [];
    },
    [mappings],
  );

  /** 특정 상품에 매핑된 모든 부가서비스 (요금제 무관 합집합) */
  const getAllLinkedVasForProduct = useCallback(
    (product: string | null | undefined): string[] => {
      if (!isVasEligibleProduct(product)) return [];
      const set = new Set<string>();
      mappings
        .filter((m) => m.active && m.product === product)
        .forEach((m) => (m.linked_vas ?? []).forEach((v) => v && set.add(v)));
      return Array.from(set);
    },
    [mappings],
  );

  return {
    mappings, loading, refresh,
    getPlansForProduct, getDefaultsForProduct, getAllowedSaleTypes,
    getLinkedVasForPlan, getAllLinkedVasForProduct,
  };
};
