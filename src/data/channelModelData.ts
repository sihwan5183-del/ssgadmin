// === 채널별 판매 모델 데이터 ===

export interface ModelInfo {
  name: string;
  isStrategy: boolean; // 전략 모델 여부
  color: string;
}

export const models: ModelInfo[] = [
  { name: "갤럭시 S25 Ultra",  isStrategy: true,  color: "hsl(270 90% 65%)" },
  { name: "갤럭시 S25",        isStrategy: true,  color: "hsl(290 85% 65%)" },
  { name: "아이폰 17 Pro",     isStrategy: true,  color: "hsl(320 90% 65%)" },
  { name: "아이폰 17",         isStrategy: false, color: "hsl(195 90% 60%)" },
  { name: "갤럭시 Z 플립7",    isStrategy: true,  color: "hsl(35 95% 60%)" },
  { name: "갤럭시 A56",        isStrategy: false, color: "hsl(220 15% 55%)" },
  { name: "기타",              isStrategy: false, color: "hsl(220 10% 35%)" },
];

// 채널 × 모델 판매 건수 + 건당 평균 리베이트
export interface ChannelModelRow {
  channel: string;
  models: { name: string; count: number; avgRebate: number }[];
}

export const channelModelData: ChannelModelRow[] = [
  {
    channel: "당근",
    models: [
      { name: "갤럭시 S25 Ultra",  count: 38, avgRebate: 285_000 },
      { name: "갤럭시 S25",        count: 42, avgRebate: 224_000 },
      { name: "아이폰 17 Pro",     count: 22, avgRebate: 312_000 },
      { name: "아이폰 17",         count: 18, avgRebate: 198_000 },
      { name: "갤럭시 Z 플립7",    count: 12, avgRebate: 268_000 },
      { name: "갤럭시 A56",        count: 14, avgRebate: 142_000 },
      { name: "기타",              count: 10, avgRebate: 110_000 },
    ],
  },
  {
    channel: "모요",
    models: [
      { name: "갤럭시 S25 Ultra",  count: 28, avgRebate: 274_000 },
      { name: "갤럭시 S25",        count: 34, avgRebate: 218_000 },
      { name: "아이폰 17 Pro",     count: 31, avgRebate: 318_000 },
      { name: "아이폰 17",         count: 20, avgRebate: 192_000 },
      { name: "갤럭시 Z 플립7",    count:  8, avgRebate: 261_000 },
      { name: "갤럭시 A56",        count: 12, avgRebate: 138_000 },
      { name: "기타",              count:  9, avgRebate: 105_000 },
    ],
  },
  {
    channel: "도그마루",
    models: [
      { name: "갤럭시 S25 Ultra",  count: 18, avgRebate: 268_000 },
      { name: "갤럭시 S25",        count: 24, avgRebate: 215_000 },
      { name: "아이폰 17 Pro",     count: 14, avgRebate: 305_000 },
      { name: "아이폰 17",         count: 11, avgRebate: 188_000 },
      { name: "갤럭시 Z 플립7",    count:  6, avgRebate: 254_000 },
      { name: "갤럭시 A56",        count: 16, avgRebate: 135_000 },
      { name: "기타",              count:  7, avgRebate: 102_000 },
    ],
  },
  {
    channel: "SEG활동",
    models: [
      { name: "갤럭시 S25 Ultra",  count: 14, avgRebate: 262_000 },
      { name: "갤럭시 S25",        count: 18, avgRebate: 208_000 },
      { name: "아이폰 17 Pro",     count:  9, avgRebate: 298_000 },
      { name: "아이폰 17",         count:  8, avgRebate: 184_000 },
      { name: "갤럭시 Z 플립7",    count:  4, avgRebate: 248_000 },
      { name: "갤럭시 A56",        count: 21, avgRebate: 132_000 },
      { name: "기타",              count:  8, avgRebate: 100_000 },
    ],
  },
  {
    channel: "오프라인",
    models: [
      { name: "갤럭시 S25 Ultra",  count: 32, avgRebate: 292_000 },
      { name: "갤럭시 S25",        count: 38, avgRebate: 232_000 },
      { name: "아이폰 17 Pro",     count: 26, avgRebate: 326_000 },
      { name: "아이폰 17",         count: 19, avgRebate: 204_000 },
      { name: "갤럭시 Z 플립7",    count: 11, avgRebate: 275_000 },
      { name: "갤럭시 A56",        count: 18, avgRebate: 148_000 },
      { name: "기타",              count: 12, avgRebate: 118_000 },
    ],
  },
];

// Recharts용으로 평탄화
export const stackedChannelData = channelModelData.map((row) => {
  const flat: Record<string, number | string> = { channel: row.channel };
  row.models.forEach((m) => { flat[m.name] = m.count; });
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

// 채널별 정책/일반 모델 비중
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
      strategyPct: Math.round((strategy / total) * 100),
      generalPct: Math.round((general / total) * 100),
      total,
    };
  });
