import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useDeviceModels } from "./useDeviceModels";

/** Strip capacity / color suffixes to get the series name (e.g. "S942-256" → "S942") */
export function seriesName(pet: string): string {
  // Remove trailing -NNN (capacity like 256, 512, 1T, 1TB) and colour words
  return pet
    .replace(/[-\s]+([\d]+G?B?|1T[B]?|[A-Z]+\d+[A-Z]*)?$/i, "")
    .replace(/[-\s]+(블랙|화이트|블루|그린|핑크|크림|옐로우|실버|그레이|퍼플|레드|골드)$/i, "")
    .trim() || pet;
}

/** device_models DB 기반 펫네임 해석 — matchModel 함수를 받아서 사용 */
export function resolvePetName(raw: string, matchModel?: (s: string) => any): { pet: string; maker: string } {
  if (matchModel) {
    const hit = matchModel(raw);
    if (hit) return { pet: hit.model_name, maker: hit.manufacturer || "기타" };
  }
  // fallback
  if (/^(UIP|IP)/i.test(raw)) return { pet: raw, maker: "애플" };
  if (/^(SM-|S|F|A|L|N)/i.test(raw)) return { pet: raw, maker: "삼성" };
  return { pet: raw, maker: "기타" };
}

const MODEL_PALETTE = [
  "hsl(152 76% 50%)", "hsl(195 75% 55%)", "hsl(270 70% 60%)",
  "hsl(35 90% 55%)", "hsl(320 80% 60%)", "hsl(200 70% 55%)",
  "hsl(45 80% 55%)", "hsl(0 70% 60%)", "hsl(160 60% 50%)",
  "hsl(210 70% 55%)", "hsl(280 60% 55%)", "hsl(100 60% 50%)",
];

export interface ModelStat {
  name: string;
  petName: string;
  maker: string;
  count: number;
  avgRebate: number;
  revenue: number;
  share: number;
  isStrategy: boolean;
  color: string;
}

export interface ChannelModelStat {
  channel: string;
  models: { name: string; count: number; avgRebate: number }[];
}

export interface PolicyShare {
  channel: string;
  strategy: number;
  general: number;
  strategyPct: number;
  generalPct: number;
  total: number;
}

export interface ChannelStackSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function useModelAnalysis() {
  const { startDate, endDate } = usePeriod();
  const { matchModel } = useDeviceModels();
  const { models: deviceModelsList } = useDeviceModels();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const strategyModelNames: string[] = useMemo(() => {
    return deviceModelsList
      .filter((m) => (m as any).is_strategy)
      .map((m) => m.model_name);
  }, [deviceModelsList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("device_model, channel, unit_price, product")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(10000);
      if (!cancelled) {
        setRows(data ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  return useMemo(() => {
    // ---- overall model stats ----
    const modelMap = new Map<string, { count: number; rebateSum: number }>();
    const channelModelMap = new Map<string, Map<string, { count: number; rebateSum: number }>>();

    for (const r of rows) {
      // 모바일 상품만 집계
      const product = (r.product ?? "").toString().trim();
      if (product && product !== "모바일") continue;

      const model = (r.device_model ?? "기타").toString().trim() || "기타";
      const channel = (r.channel ?? "기타").toString().trim() || "기타";
      const price = Number(r.unit_price ?? 0);

      // overall
      const cur = modelMap.get(model) ?? { count: 0, rebateSum: 0 };
      cur.count += 1;
      cur.rebateSum += price;
      modelMap.set(model, cur);

      // channel × model
      if (!channelModelMap.has(channel)) channelModelMap.set(channel, new Map());
      const chMap = channelModelMap.get(channel)!;
      const chCur = chMap.get(model) ?? { count: 0, rebateSum: 0 };
      chCur.count += 1;
      chCur.rebateSum += price;
      chMap.set(model, chCur);
    }

    // totalCount = 모바일 필터링 후 실제 집계 건수
    const totalCount = Array.from(modelMap.values()).reduce((s, v) => s + v.count, 0);
    const allModels = Array.from(modelMap.keys()).sort(
      (a, b) => (modelMap.get(b)?.count ?? 0) - (modelMap.get(a)?.count ?? 0)
    );
    const colorMap = new Map<string, string>();
    allModels.forEach((m, i) => colorMap.set(m, MODEL_PALETTE[i % MODEL_PALETTE.length]));
    const strategySet = new Set(strategyModelNames.map(n => n.toLowerCase()));

    const overallStats: ModelStat[] = allModels.map((name) => {
      const stat = modelMap.get(name)!;
      const { pet, maker } = resolvePetName(name, matchModel);
      return {
        name,
        petName: pet,
        maker,
        count: stat.count,
        avgRebate: stat.count > 0 ? Math.round(stat.rebateSum / stat.count) : 0,
        revenue: stat.rebateSum,
        share: totalCount > 0 ? (stat.count / totalCount) * 100 : 0,
        isStrategy: strategySet.has(name.toLowerCase()),
        color: colorMap.get(name)!,
      };
    });

    // ---- channel model data ----
    const channelData: ChannelModelStat[] = Array.from(channelModelMap.entries())
      .map(([channel, mMap]) => ({
        channel,
        models: Array.from(mMap.entries()).map(([name, v]) => ({
          name,
          count: v.count,
          avgRebate: v.count > 0 ? Math.round(v.rebateSum / v.count) : 0,
        })),
      }))
      .sort((a, b) => {
        const ta = a.models.reduce((s, m) => s + m.count, 0);
        const tb = b.models.reduce((s, m) => s + m.count, 0);
        return tb - ta;
      });

    // ---- Group by SERIES name (strip capacity/colour) ----
    // Build global series totals for ranking
    const seriesTotals = new Map<string, number>();
    for (const [name, stat] of modelMap.entries()) {
      const { pet } = resolvePetName(name, matchModel);
      const series = seriesName(pet);
      seriesTotals.set(series, (seriesTotals.get(series) ?? 0) + stat.count);
    }
    const globalTop5Series = [...seriesTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);
    const top5Set = new Set(globalTop5Series);

    // Assign stable colours to top 5 series + "기타"
    const SERIES_PALETTE = [
      "hsl(152 76% 50%)", "hsl(195 75% 55%)", "hsl(270 70% 60%)",
      "hsl(35 90% 55%)", "hsl(320 80% 60%)",
    ];
    const seriesColorMap = new Map<string, string>();
    globalTop5Series.forEach((s, i) => seriesColorMap.set(s, SERIES_PALETTE[i]));
    seriesColorMap.set("기타", "hsl(220 10% 45%)");

    // stacked chart data — Top 5 series + 기타
    const stackedData = channelData.map((row) => {
      const flat: Record<string, number | string> = { channel: row.channel };
      row.models.forEach((m) => {
        const { pet } = resolvePetName(m.name, matchModel);
        const series = seriesName(pet);
        const key = top5Set.has(series) ? series : "기타";
        flat[key] = ((flat[key] as number) || 0) + m.count;
      });
      return flat;
    });

    const stackedSegmentsByChannel = new Map<string, ChannelStackSegment[]>();
    stackedData.forEach((row) => {
      const segments = modelsInfo
        .map((info) => ({
          key: info.name,
          label: info.petName,
          value: Number(row[info.name] ?? 0),
          color: info.color,
        }))
        .filter((segment) => segment.value > 0);
      stackedSegmentsByChannel.set(String(row.channel), segments);
    });

    // modelsInfo — only top 5 + 기타 (max 6 entries for the chart)
    const modelsInfo = [
      ...globalTop5Series.map((s) => ({
        name: s,
        petName: s,
        isStrategy: false,
        color: seriesColorMap.get(s)!,
      })),
      { name: "기타", petName: "기타", isStrategy: false, color: seriesColorMap.get("기타")! },
    ];

    // helpers
    const getTop5 = (channel: string) => {
      const row = channelData.find((r) => r.channel === channel);
      if (!row) return [];
      // Group by series within this channel
      const seriesMap = new Map<string, { count: number; rebateSum: number; rawModels: string[] }>();
      for (const m of row.models) {
        const { pet } = resolvePetName(m.name, matchModel);
        const series = seriesName(pet);
        const cur = seriesMap.get(series) ?? { count: 0, rebateSum: 0, rawModels: [] };
        cur.count += m.count;
        cur.rebateSum += m.avgRebate * m.count;
        cur.rawModels.push(m.name);
        seriesMap.set(series, cur);
      }
      return [...seriesMap.entries()]
        .map(([name, v]) => ({
          name,
          count: v.count,
          avgRebate: v.count > 0 ? Math.round(v.rebateSum / v.count) : 0,
          rawModels: v.rawModels,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((m) => ({
          ...m,
          isStrategy: strategySet.has(m.name.toLowerCase()) || m.rawModels?.some(r => strategySet.has(r.toLowerCase())),
          color: seriesColorMap.get(m.name) ?? colorMap.get(m.name) ?? "hsl(220 10% 50%)",
        }));
    };

    const policyShare: PolicyShare[] = channelData.map((row) => {
      let strategy = 0, general = 0;
      row.models.forEach((m) => {
        const { pet } = resolvePetName(m.name, matchModel);
        if (strategySet.has(m.name.toLowerCase()) || strategySet.has(pet.toLowerCase())) strategy += m.count;
        else general += m.count;
      });
      const total = strategy + general;
      return {
        channel: row.channel,
        strategy, general,
        strategyPct: total > 0 ? Math.round((strategy / total) * 100) : 0,
        generalPct: total > 0 ? Math.round((general / total) * 100) : 0,
        total,
      };
    });

    return {
      loading,
      overallStats,
      channelData,
      stackedData,
      stackedSegmentsByChannel,
      modelsInfo,
      policyShare,
      getTop5,
      totalCount,
      hasData: totalCount > 0,
      matchModel,
    };
  }, [rows, loading, strategyModelNames, matchModel, deviceModelsList]);
}