import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "./useAppSettings";

// ── 펫네임 매핑 (기기코드 → 소비자명) ──
const PET_NAME_MAP: Record<string, { pet: string; maker: string }> = {
  "S942": { pet: "갤럭시 S25 Ultra", maker: "삼성" },
  "S948": { pet: "갤럭시 S26 Ultra", maker: "삼성" },
  "S947": { pet: "갤럭시 S26+", maker: "삼성" },
  "S937": { pet: "갤럭시 S25+", maker: "삼성" },
  "S936": { pet: "갤럭시 S25", maker: "삼성" },
  "S928": { pet: "갤럭시 S24 Ultra", maker: "삼성" },
  "S926": { pet: "갤럭시 S24+", maker: "삼성" },
  "S921": { pet: "갤럭시 S24", maker: "삼성" },
  "S911": { pet: "갤럭시 S23", maker: "삼성" },
  "F966": { pet: "갤럭시 Z Fold6", maker: "삼성" },
  "F766": { pet: "갤럭시 Z Flip6", maker: "삼성" },
  "A566": { pet: "갤럭시 A56", maker: "삼성" },
  "A366": { pet: "갤럭시 A36", maker: "삼성" },
  "L325": { pet: "갤럭시 Buddy4", maker: "삼성" },
  "UIP17PR": { pet: "iPhone 17 Pro Max", maker: "애플" },
  "UIP17PM": { pet: "iPhone 17 Pro Max", maker: "애플" },
  "UIP17": { pet: "iPhone 17", maker: "애플" },
  "UIP16PR": { pet: "iPhone 16 Pro", maker: "애플" },
  "UIP16PM": { pet: "iPhone 16 Pro Max", maker: "애플" },
  "UIP16": { pet: "iPhone 16", maker: "애플" },
  "UIP15PR": { pet: "iPhone 15 Pro", maker: "애플" },
  "UIP15": { pet: "iPhone 15", maker: "애플" },
  "UIP": { pet: "iPhone (기타)", maker: "애플" },
};

export function resolvePetName(raw: string): { pet: string; maker: string } {
  let cleaned = raw.replace(/^SM-/i, "").replace(/N?\d*(GB|TB)?$/i, "");
  cleaned = cleaned.replace(/[-_]?(256|512|128|1T|1TB)$/i, "").trim();
  if (PET_NAME_MAP[cleaned]) return PET_NAME_MAP[cleaned];
  const upper = cleaned.toUpperCase();
  for (const [key, val] of Object.entries(PET_NAME_MAP)) {
    if (upper === key.toUpperCase()) return val;
  }
  const sorted = Object.keys(PET_NAME_MAP).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (upper.startsWith(key.toUpperCase())) return PET_NAME_MAP[key];
  }
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

export function useModelAnalysis() {
  const { startDate, endDate } = usePeriod();
  const { settings } = useAppSettings();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const strategyModelNames: string[] = useMemo(() => {
    const raw = settings["dashboard.strategy_models"];
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("device_model, channel, unit_price")
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

    const totalCount = rows.length;
    const allModels = Array.from(modelMap.keys()).sort(
      (a, b) => (modelMap.get(b)?.count ?? 0) - (modelMap.get(a)?.count ?? 0)
    );
    const colorMap = new Map<string, string>();
    allModels.forEach((m, i) => colorMap.set(m, MODEL_PALETTE[i % MODEL_PALETTE.length]));
    const strategySet = new Set(strategyModelNames.map(n => n.toLowerCase()));

    const overallStats: ModelStat[] = allModels.map((name) => {
      const stat = modelMap.get(name)!;
      const { pet, maker } = resolvePetName(name);
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

    // stacked chart data
    const stackedData = channelData.map((row) => {
      const flat: Record<string, number | string> = { channel: row.channel };
      row.models.forEach((m) => {
        const { pet } = resolvePetName(m.name);
        flat[pet] = ((flat[pet] as number) || 0) + m.count;
      });
      return flat;
    });

    // models info for stacked bar keys
    // Deduplicate by petName (multiple raw models can map to same pet)
    const petSeen = new Set<string>();
    const modelsInfo: { name: string; petName: string; isStrategy: boolean; color: string }[] = [];
    for (const name of allModels) {
      const { pet } = resolvePetName(name);
      if (petSeen.has(pet)) continue;
      petSeen.add(pet);
      modelsInfo.push({
        name: pet,
        petName: pet,
        isStrategy: strategySet.has(name.toLowerCase()),
        color: colorMap.get(name)!,
      });
    }

    // helpers
    const getTop5 = (channel: string) => {
      const row = channelData.find((r) => r.channel === channel);
      if (!row) return [];
      return [...row.models]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((m) => ({
          ...m,
          isStrategy: strategySet.has(m.name.toLowerCase()),
          color: colorMap.get(m.name) ?? "hsl(220 10% 50%)",
        }));
    };

    const policyShare: PolicyShare[] = channelData.map((row) => {
      let strategy = 0, general = 0;
      row.models.forEach((m) => {
        if (strategySet.has(m.name.toLowerCase())) strategy += m.count;
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
      modelsInfo,
      policyShare,
      getTop5,
      totalCount,
      hasData: totalCount > 0,
    };
  }, [rows, loading, strategyModelNames]);
}