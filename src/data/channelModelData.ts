// === 채널별 판매 모델 데이터 — 초기 빈 상태 ===

export interface ModelInfo {
  name: string;
  isStrategy: boolean;
  color: string;
}

export const models: ModelInfo[] = [];

export interface ChannelModelRow {
  channel: string;
  models: { name: string; count: number; avgRebate: number }[];
}

export const channelModelData: ChannelModelRow[] = [];

export const stackedChannelData = channelModelData.map((row) => {
  const flat: Record<string, number | string> = { channel: row.channel };
  row.models.forEach((m) => {
    flat[m.name] = m.count;
  });
  return flat;
});

export const getChannelTop5 = (channel: string) => {
  const row = channelModelData.find((r) => r.channel === channel);
  if (!row) return [];
  return [...row.models]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((m) => ({
      ...m,
      isStrategy: models.find((mm) => mm.name === m.name)?.isStrategy ?? false,
      color: models.find((mm) => mm.name === m.name)?.color ?? "hsl(220 10% 50%)",
    }));
};

export const getOverallModelStats = () => {
  const map = new Map<string, { count: number; rebateSum: number }>();
  channelModelData.forEach((row) => {
    row.models.forEach((m) => {
      const cur = map.get(m.name) ?? { count: 0, rebateSum: 0 };
      cur.count += m.count;
      cur.rebateSum += m.avgRebate * m.count;
      map.set(m.name, cur);
    });
  });
  const totalCount = Array.from(map.values()).reduce((s, v) => s + v.count, 0);
  return models
    .map((m) => {
      const stat = map.get(m.name) ?? { count: 0, rebateSum: 0 };
      const avgRebate = stat.count > 0 ? Math.round(stat.rebateSum / stat.count) : 0;
      return {
        name: m.name,
        count: stat.count,
        avgRebate,
        revenue: stat.rebateSum,
        share: totalCount > 0 ? (stat.count / totalCount) * 100 : 0,
        isStrategy: m.isStrategy,
        color: m.color,
      };
    })
    .sort((a, b) => b.count - a.count);
};

export const getChannelPolicyShare = () =>
  channelModelData.map((row) => {
    let strategy = 0;
    let general = 0;
    row.models.forEach((m) => {
      const isStrategy = models.find((mm) => mm.name === m.name)?.isStrategy;
      if (isStrategy) strategy += m.count;
      else general += m.count;
    });
    const total = strategy + general;
    return {
      channel: row.channel,
      strategy,
      general,
      strategyPct: total > 0 ? Math.round((strategy / total) * 100) : 0,
      generalPct: total > 0 ? Math.round((general / total) * 100) : 0,
      total,
    };
  });
