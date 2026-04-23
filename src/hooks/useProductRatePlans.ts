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
}

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

  return { mappings, loading, refresh, getPlansForProduct, getDefaultsForProduct, getAllowedSaleTypes };
};
