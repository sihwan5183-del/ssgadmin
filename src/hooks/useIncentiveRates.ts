import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IncentiveRate } from "@/lib/incentiveEngine";

export function useIncentiveRates() {
  const [rates, setRates] = useState<IncentiveRate[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("incentive_rates")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setRates((data ?? []) as IncentiveRate[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rates, loading, refresh };
}
