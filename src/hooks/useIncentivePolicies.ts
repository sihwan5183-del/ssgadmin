import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IncentivePolicy, PolicyTier } from "@/lib/incentiveEngine";

export function useIncentivePolicies() {
  const [policies, setPolicies] = useState<IncentivePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("incentive_policies")
      .select("*")
      .order("created_at", { ascending: false });
    setPolicies(
      (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        target_sale_types: r.target_sale_types ?? [],
        target_products: r.target_products ?? [],
        tiers: Array.isArray(r.tiers) ? r.tiers as PolicyTier[] : [],
        active: r.active,
        valid_from: r.valid_from,
        valid_to: r.valid_to,
        note: r.note,
        calc_method: (r as any).calc_method ?? "tiered",
        fixed_amount: Number((r as any).fixed_amount ?? 0),
        match_model: (r as any).match_model ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { policies, loading, refresh };
}