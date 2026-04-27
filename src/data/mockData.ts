// 빈 데이터 — 실제 데이터 입력 전 초기 상태
export const summaryStats = {
  netProfit: 0,
  netProfitDelta: 0,
  totalRebate: 0,
  totalRebateDelta: 0,
  marketingCost: 0,
  marketingCostDelta: 0,
  roi: 0,
  roiDelta: 0,
  newRegulars: 0,
  newRegularsDelta: 0,
  monthlyTarget: 500,
  monthlyActivations: 0,
  todayActivations: 0,
  todayDelta: 0,
};

export const mobileBreakdownStats = [
  { label: "MNP (번호이동)", count: 0, share: 0 },
  { label: "기변", count: 0, share: 0 },
];

export const usimChannelStats = [
  { channel: "당근", count: 0, color: "hsl(35 95% 60%)" },
  { channel: "모요", count: 0, color: "hsl(270 90% 65%)" },
  { channel: "도그마루", count: 0, color: "hsl(320 90% 65%)" },
  { channel: "오프라인", count: 0, color: "hsl(195 90% 60%)" },
  { channel: "캠페인", count: 0, color: "hsl(150 70% 55%)" },
  { channel: "기타", count: 0, color: "hsl(220 15% 55%)" },
];

export const channelActivationStats = [
  { channel: "당근", monthly: 0, today: 0, color: "hsl(35 95% 60%)" },
  { channel: "모요", monthly: 0, today: 0, color: "hsl(270 90% 65%)" },
  { channel: "도그마루", monthly: 0, today: 0, color: "hsl(320 90% 65%)" },
  { channel: "오프라인", monthly: 0, today: 0, color: "hsl(195 90% 60%)" },
  { channel: "캠페인", monthly: 0, today: 0, color: "hsl(150 70% 55%)" },
  { channel: "기타", monthly: 0, today: 0, color: "hsl(220 15% 55%)" },
];

export const strategyProductStats = [
  { label: "인터넷", count: 0 },
  { label: "TV프리", count: 0 },
  { label: "스마트홈", count: 0 },
  { label: "대명", count: 0 },
];

export const dailyPerformance: { day: string; 실적: number; 순이익: number }[] = [];

export const channelShare = [
  { name: "당근", value: 0, color: "hsl(35 95% 60%)" },
  { name: "모요", value: 0, color: "hsl(270 90% 65%)" },
  { name: "도그마루", value: 0, color: "hsl(320 90% 65%)" },
  { name: "오프라인", value: 0, color: "hsl(195 90% 60%)" },
  { name: "기타", value: 0, color: "hsl(220 15% 55%)" },
];

export const recentActivities: {
  id: number;
  name: string;
  action: string;
  channel: string;
  time: string;
  profit: number;
}[] = [];

export const employeeRanking: {
  rank: number;
  name: string;
  team: string;
  profit: number;
  count: number;
}[] = [];

export const teamRanking: {
  rank: number;
  team: string;
  profit: number;
  members: number;
  avg: number;
}[] = [];

export const inflowChannels = ["당근", "모요", "도그마루", "오프라인", "지인소개", "기타"] as const;
export const planTiers = ["5G 시그니처", "5G 프리미어", "5G 스탠다드", "LTE 프리미엄", "LTE 베이직"] as const;
export const strategyProducts = ["TV프리", "스마트홈", "대명"] as const;
export const addonServices = ["넷플릭스팩", "디즈니+팩", "유튜브 프리미엄", "AI케어", "보험"] as const;

export const formatKRW = (n: number) => "₩" + n.toLocaleString("ko-KR");
export const formatShortKRW = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
};
