// === 실적장표(금액) + 지출장표 ===

// 1) 매체별 광고비 — 주차별 스택용
export const mediaWeekly = [
  { week: "11/W1", 네이버: 3_200_000, 메타: 2_400_000, 유튜브: 1_800_000, 인스타: 1_400_000, 당근: 1_600_000, 토스: 900_000 },
  { week: "11/W2", 네이버: 3_400_000, 메타: 2_600_000, 유튜브: 2_100_000, 인스타: 1_500_000, 당근: 1_700_000, 토스: 1_000_000 },
  { week: "11/W3", 네이버: 3_100_000, 메타: 2_500_000, 유튜브: 2_400_000, 인스타: 1_700_000, 당근: 1_800_000, 토스: 1_100_000 },
  { week: "11/W4", 네이버: 2_700_000, 메타: 2_300_000, 유튜브: 1_900_000, 인스타: 1_600_000, 당근: 1_500_000, 토스: 850_000 },
];

export const mediaPalette: Record<string, string> = {
  네이버: "hsl(155 70% 50%)",
  메타:   "hsl(220 85% 60%)",
  유튜브: "hsl(0 85% 60%)",
  인스타: "hsl(320 85% 60%)",
  당근:   "hsl(25 95% 60%)",
  토스:   "hsl(210 90% 60%)",
};

export const mediaList = ["네이버", "메타", "유튜브", "인스타", "당근", "토스"] as const;

// 2) 채널 × CPA / 마진 — '채널'은 매체와 동일 의미로 사용
export interface ChannelEconomics {
  channel: string;
  spend: number;       // 광고비
  successCount: number; // 성공(개통) 건수
  rebate: number;      // 발생 리베이트
  offer: number;       // 고객 지원금(오퍼)
  avgOffer: number;    // 건당 지원금
}

export const channelEconomics: ChannelEconomics[] = [
  { channel: "네이버", spend: 12_400_000, successCount: 168, rebate: 56_800_000, offer: 21_400_000, avgOffer: 127_380 },
  { channel: "메타",   spend:  9_800_000, successCount: 142, rebate: 44_200_000, offer: 17_900_000, avgOffer: 126_056 },
  { channel: "당근",   spend:  6_600_000, successCount: 156, rebate: 48_500_000, offer: 16_800_000, avgOffer: 107_692 },
  { channel: "유튜브", spend:  8_200_000, successCount: 104, rebate: 31_200_000, offer: 12_900_000, avgOffer: 124_038 },
  { channel: "인스타", spend:  6_200_000, successCount:  88, rebate: 25_800_000, offer: 11_200_000, avgOffer: 127_272 },
  { channel: "토스",   spend:  3_850_000, successCount:  62, rebate: 18_400_000, offer:  7_400_000, avgOffer: 119_354 },
];

// 3) 항목별 수익 구성
export const revenueComposition = [
  { item: "모바일 리베이트", amount: 224_900_000, color: "hsl(152 76% 50%)" },
  { item: "USIM MNP 수익",   amount:  18_400_000, color: "hsl(168 75% 55%)" },
  { item: "인터넷/홈 수익",  amount:  69_500_000, color: "hsl(180 70% 55%)" },
];

// 4) 단가표 vs 실제 정산 (당월 누적)
export const settlementGap = [
  { item: "모바일 리베이트",  estimated: 232_000_000, actual: 224_900_000 },
  { item: "USIM MNP 수익",    estimated:  20_000_000, actual:  18_400_000 },
  { item: "인터넷/홈 수익",   estimated:  72_000_000, actual:  69_500_000 },
  { item: "전략상품(2ND)",    estimated:  41_000_000, actual:  38_200_000 },
];

// === 헬퍼 ===
export const formatM = (n: number) => "₩" + n.toLocaleString("ko-KR");
export const formatKRW = (n: number) => "₩" + n.toLocaleString("ko-KR");
// 모든 금액을 원 단위 풀표기로 통일 (축약 없음)
export const formatKRWShort = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

// 종합 계산
export const totals = {
  totalSpend: channelEconomics.reduce((s, c) => s + c.spend, 0),
  totalRebate: revenueComposition.reduce((s, r) => s + r.amount, 0),
  totalOffer: channelEconomics.reduce((s, c) => s + c.offer, 0),
  totalSuccess: channelEconomics.reduce((s, c) => s + c.successCount, 0),
};
export const netMargin = totals.totalRebate - (totals.totalOffer + totals.totalSpend);
