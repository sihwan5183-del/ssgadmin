import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeviceModel {
  id: string;
  manufacturer: string;
  model_name: string;
  retail_price: number;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export const useDeviceModels = (activeOnly = true) => {
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("device_models").select("*").order("sort_order").order("model_name");
    if (activeOnly) q = q.eq("active", true);
    const { data } = await q;
    setModels((data ?? []) as DeviceModel[]);
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("device-models-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_models" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return { models, loading, reload: load };
};
