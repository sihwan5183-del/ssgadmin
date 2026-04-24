import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Position {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("positions")
      .select("*")
      .order("sort_order");
    setPositions((data ?? []) as Position[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { positions, loading, refresh };
}
