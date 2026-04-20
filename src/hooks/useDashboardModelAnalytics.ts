import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "./useAppSettings";

const MODEL_PALETTE = [
  "hsl(330 100% 60%)",
  "hsl(280 90% 65%)",
  "hsl(195 90% 60%)",
  "hsl(158 70% 55%)",
  "hsl(38 95% 60%)",
  "hsl(220 90% 65%)",
  "hsl(310 90% 65%)",
  "hsl(12 90% 62%)",
];

type SalesModelRow = {
  channel: string | null;
  device_model: string | null;
  net_fee: number | null;
};

type ModelStat = {
  name: string;
  count: number;
  avgRebate: number;
  revenue: number;
  share: number;
  isStrategy: boolean;
  color: string;
};

type ChannelModelStat = {
  channel: string;
  total: number;
  models: Array<{
    name: string;
    count: number;
    avgRebate: number;
    isStrategy: boolean;
    color: string;
  }>;
};

export const useDashboardModelAnalytics = () => {
  const { startDate, endDate } = usePeriod();
  const { settings } = useAppSettings();
  const [rows, setRows] = useState<SalesModelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const strategySet = useMemo(() => {
    const raw = settings["dashboard.strategy_models"];
    return new Set(Array.isArray(raw) ? (raw as string[]) : []);
  }, [settings]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("channel, device_model, net_fee")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .not("device_model", "is", null)
        .limit(10000);

      if (!alive) return;
      setRows(
        ((data ?? []) as SalesModelRow[]).filter(
          (row) => typeof row.device_model === "string" && row.device_model.trim().length > 0,
        ),
      );
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const models = useMemo<ModelStat[]>(() => {
    const map = new Map<string, { count: number; revenue: number }>();

    rows.forEach((row) => {
      const name = row.device_model?.trim();
      if (!name) return;
      const current = map.get(name) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(row.net_fee ?? 0);
      map.set(name, current);
    });

    const totalCount = Array.from(map.values()).reduce((sum, value) => sum + value.count, 0);

    return Array.from(map.entries())
      .map(([name, value], idx) => ({
        name,
        count: value.count,
        avgRebate: value.count > 0 ? Math.round(value.revenue / value.count) : 0,
        revenue: value.revenue,
        share: totalCount > 0 ? (value.count / totalCount) * 100 : 0,
        isStrategy: strategySet.has(name),
        color: MODEL_PALETTE[idx % MODEL_PALETTE.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows, strategySet]);

  const colorMap = useMemo(
    () => Object.fromEntries(models.map((model) => [model.name, model.color])),
    [models],
  );

  const channelRows = useMemo<ChannelModelStat[]>(() => {
    const channels = new Map<string, Map<string, { count: number; revenue: number }>>();

    rows.forEach((row) => {
      const channel = row.channel?.trim() || "기타";
      const model = row.device_model?.trim();
      if (!model) return;

      const byModel = channels.get(channel) ?? new Map<string, { count: number; revenue: number }>();
      const current = byModel.get(model) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(row.net_fee ?? 0);
      byModel.set(model, current);
      channels.set(channel, byModel);
    });

    return Array.from(channels.entries())
      .map(([channel, byModel]) => {
        const channelModels = Array.from(byModel.entries())
          .map(([name, value]) => ({
            name,
            count: value.count,
            avgRebate: value.count > 0 ? Math.round(value.revenue / value.count) : 0,
            isStrategy: strategySet.has(name),
            color: colorMap[name] ?? "hsl(220 10% 55%)",
          }))
          .sort((a, b) => b.count - a.count);

        return {
          channel,
          total: channelModels.reduce((sum, model) => sum + model.count, 0),
          models: channelModels,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rows, strategySet, colorMap]);

  const policyShare = useMemo(
    () =>
      channelRows.map((row) => {
        const strategy = row.models.filter((model) => model.isStrategy).reduce((sum, model) => sum + model.count, 0);
        const general = row.total - strategy;
        return {
          channel: row.channel,
          strategy,
          general,
          total: row.total,
          strategyPct: row.total > 0 ? Math.round((strategy / row.total) * 100) : 0,
          generalPct: row.total > 0 ? Math.round((general / row.total) * 100) : 0,
        };
      }),
    [channelRows],
  );

  const stackedChannelData = useMemo(
    () =>
      channelRows.map((row) =>
        row.models.reduce<Record<string, string | number>>(
          (acc, model) => {
            acc[model.name] = model.count;
            return acc;
          },
          { channel: row.channel },
        ),
      ),
    [channelRows],
  );

  return {
    loading,
    models,
    modelKeys: models.map((model) => ({ name: model.name, color: model.color })),
    channelRows,
    policyShare,
    stackedChannelData,
  };
};