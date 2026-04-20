// === 실적장표(건) 기반 데이터 — 초기 빈 상태 ===

export const subscriptionTypes = [
  { type: "번호이동(MNP)", count: 0, color: "hsl(270 90% 65%)", desc: "타사 → 자사 전환" },
  { type: "신규", count: 0, color: "hsl(320 90% 65%)", desc: "신규 회선 개통" },
  { type: "기기변경", count: 0, color: "hsl(195 90% 60%)", desc: "기존 고객 단말 교체" },
];

export const modelPolicyShare = [
  { name: "정책 모델", value: 0, color: "hsl(270 90% 65%)" },
  { name: "일반 모델", value: 0, color: "hsl(240 10% 40%)" },
];

export const usimStats = {
  usimMnp: 0,
  usimNew: 0,
  total: 0,
  delta: 0,
};

export const strategyProductsDetail = [
  { name: "인터넷", current: 0, target: 80, color: "hsl(195 90% 60%)" },
  { name: "TV프리", current: 0, target: 60, color: "hsl(270 90% 65%)" },
  { name: "IOT", current: 0, target: 50, color: "hsl(320 90% 65%)" },
  { name: "대명", current: 0, target: 30, color: "hsl(35 95% 60%)" },
];

export interface ChannelMatrixRow {
  channel: string;
  inflow: number;
  success: number;
  mobile: number;
  strategy: number;
}

export const channelMatrix: ChannelMatrixRow[] = [
  { channel: "마케팅",  inflow: 0, success: 0, mobile: 0, strategy: 0 },
  { channel: "모요",    inflow: 0, success: 0, mobile: 0, strategy: 0 },
  { channel: "오프라인", inflow: 0, success: 0, mobile: 0, strategy: 0 },
  { channel: "도그마루", inflow: 0, success: 0, mobile: 0, strategy: 0 },
  { channel: "SEG활동", inflow: 0, success: 0, mobile: 0, strategy: 0 },
  { channel: "당근",    inflow: 0, success: 0, mobile: 0, strategy: 0 },
];
