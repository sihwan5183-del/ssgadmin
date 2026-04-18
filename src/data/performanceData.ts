// === 실적장표(건) 기반 데이터 ===

// 1) 가입 유형별 (모바일)
export const subscriptionTypes = [
  { type: "번호이동(MNP)", count: 142, color: "hsl(270 90% 65%)", desc: "타사 → 자사 전환" },
  { type: "신규", count: 86, color: "hsl(320 90% 65%)", desc: "신규 회선 개통" },
  { type: "기기변경", count: 213, color: "hsl(195 90% 60%)", desc: "기존 고객 단말 교체" },
];

// 2) 정책 모델 vs 일반 모델
export const modelPolicyShare = [
  { name: "정책 모델", value: 287, color: "hsl(270 90% 65%)" },
  { name: "일반 모델", value: 154, color: "hsl(240 10% 40%)" },
];

// 3) USIM 단독
export const usimStats = {
  usimMnp: 38,
  usimNew: 17,
  total: 55,
  delta: 14.2,
};

// 4) 전략상품(2ND) — 목표 대비 달성률
export const strategyProductsDetail = [
  { name: "인터넷", current: 62, target: 80, color: "hsl(195 90% 60%)" },
  { name: "TV프리", current: 41, target: 60, color: "hsl(270 90% 65%)" },
  { name: "IOT", current: 28, target: 50, color: "hsl(320 90% 65%)" },
  { name: "대명", current: 19, target: 30, color: "hsl(35 95% 60%)" },
];

// 5) 인입 경로별 매트릭스
export interface ChannelMatrixRow {
  channel: string;
  inflow: number;     // 인입건수
  success: number;    // 성공건수
  mobile: number;     // 모바일 건수
  strategy: number;   // 전략상품 건수
}

export const channelMatrix: ChannelMatrixRow[] = [
  { channel: "마케팅",  inflow: 312, success: 184, mobile: 162, strategy: 78 },
  { channel: "모요",    inflow: 248, success: 142, mobile: 128, strategy: 54 },
  { channel: "오프라인", inflow: 196, success: 138, mobile: 124, strategy: 61 },
  { channel: "도그마루", inflow: 174, success:  96, mobile:  84, strategy: 38 },
  { channel: "SEG활동", inflow: 142, success:  82, mobile:  71, strategy: 29 },
  { channel: "당근",    inflow: 287, success: 156, mobile: 138, strategy: 47 },
];
