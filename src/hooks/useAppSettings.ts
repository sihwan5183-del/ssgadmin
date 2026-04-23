import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_LINKAGE, type LinkageRule } from "@/lib/incentiveEngine";

export type DashboardWidgets = {
  stat_cards: boolean;
  performance_chart: boolean;
  channel_donut: boolean;
  mobile_breakdown: boolean;
  strategy_gauges: boolean;
  channel_matrix: boolean;
  ranking_panel: boolean;
  recent_activities: boolean;
};

const DEFAULT_WIDGETS: DashboardWidgets = {
  stat_cards: true,
  performance_chart: true,
  channel_donut: true,
  mobile_breakdown: true,
  strategy_gauges: true,
  channel_matrix: true,
  ranking_panel: true,
  recent_activities: true,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("key, value");
    const map: Record<string, any> = {};
    (data ?? []).forEach((row: any) => {
      map[row.key] = row.value;
    });
    setSettings(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const widgets: DashboardWidgets = {
    ...DEFAULT_WIDGETS,
    ...(settings["dashboard.widgets"] ?? {}),
  };
  const strategyTarget = Number(settings["targets.strategy_product_share"] ?? 40);
  const monthlyTarget = Number(settings["targets.monthly_activations"] ?? 500);

  const linkageRule: LinkageRule = {
    ...DEFAULT_LINKAGE,
    ...(settings["incentive.linkage"] ?? {}),
  };

  const upsert = async (key: string, value: any) => {
    const { error } = await supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
    if (!error) await fetchAll();
    return { error };
  };

  return { settings, widgets, strategyTarget, monthlyTarget, linkageRule, loading, refresh: fetchAll, upsert };
}
