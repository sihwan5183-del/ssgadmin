// 가짜 데이터 — 1차 버전 시각화용
export const summaryStats = {
  netProfit: 128_450_000,
  netProfitDelta: 12.4,
  totalRebate: 312_800_000,
  totalRebateDelta: 8.1,
  marketingCost: 37_540_000,
  marketingCostDelta: -4.8,
  roi: 342,
  roiDelta: -3.2,
  newRegulars: 87,
  newRegularsDelta: 24.5,
  // 영업 성과 KPI
  monthlyTarget: 500,
  monthlyActivations: 387,
  todayActivations: 24,
  todayDelta: 18.2,
};

// 모바일 유형별 건수 (당월 누적) — 신규는 USIM 단독개통이라 별도 섹션으로 분리
export const mobileBreakdownStats = [
  { label: "MNP (번호이동)", count: 168, share: 54.2 },
  { label: "기변", count: 142, share: 45.8 },
];

// USIM 단독개통(=USIM MNP) — 채널별 건수
export const usimChannelStats = [
  { channel: "당근", count: 28, color: "hsl(35 95% 60%)" },
  { channel: "모요", count: 19, color: "hsl(270 90% 65%)" },
  { channel: "도그마루", count: 12, color: "hsl(320 90% 65%)" },
  { channel: "오프라인", count: 9, color: "hsl(195 90% 60%)" },
  { channel: "캠페인", count: 6, color: "hsl(150 70% 55%)" },
  { channel: "기타", count: 3, color: "hsl(220 15% 55%)" },
];

// 채널별 개통 현황 (당월 누적 / 오늘)
export const channelActivationStats = [
  { channel: "당근", monthly: 124, today: 9, color: "hsl(35 95% 60%)" },
  { channel: "모요", monthly: 93, today: 6, color: "hsl(270 90% 65%)" },
  { channel: "도그마루", monthly: 70, today: 4, color: "hsl(320 90% 65%)" },
  { channel: "오프라인", monthly: 62, today: 3, color: "hsl(195 90% 60%)" },
  { channel: "캠페인", monthly: 24, today: 1, color: "hsl(150 70% 55%)" },
  { channel: "기타", monthly: 14, today: 1, color: "hsl(220 15% 55%)" },
];

// 전략 상품별 건수 (당월 누적)
export const strategyProductStats = [
  { label: "인터넷", count: 92 },
  { label: "TV프리", count: 64 },
  { label: "IOT", count: 38 },
  { label: "대명", count: 21 },
];

export const dailyPerformance = [
  { day: "11/01", 실적: 38, 순이익: 4.2 },
  { day: "11/02", 실적: 42, 순이익: 5.1 },
  { day: "11/03", 실적: 35, 순이익: 3.8 },
  { day: "11/04", 실적: 51, 순이익: 6.4 },
  { day: "11/05", 실적: 48, 순이익: 5.9 },
  { day: "11/06", 실적: 62, 순이익: 7.8 },
  { day: "11/07", 실적: 58, 순이익: 7.1 },
  { day: "11/08", 실적: 71, 순이익: 9.2 },
  { day: "11/09", 실적: 66, 순이익: 8.4 },
  { day: "11/10", 실적: 79, 순이익: 10.5 },
  { day: "11/11", 실적: 84, 순이익: 11.2 },
  { day: "11/12", 실적: 73, 순이익: 9.6 },
  { day: "11/13", 실적: 91, 순이익: 12.8 },
  { day: "11/14", 실적: 88, 순이익: 12.1 },
];

export const channelShare = [
  { name: "당근", value: 32, color: "hsl(35 95% 60%)" },
  { name: "모요", value: 24, color: "hsl(270 90% 65%)" },
  { name: "도그마루", value: 18, color: "hsl(320 90% 65%)" },
  { name: "오프라인", value: 16, color: "hsl(195 90% 60%)" },
  { name: "기타", value: 10, color: "hsl(220 15% 55%)" },
];

export const recentActivities = [
  { id: 1, name: "김민준", action: "신규 개통 — 갤럭시 S25 / 5G 프리미어", channel: "당근", time: "방금 전", profit: 184_000 },
  { id: 2, name: "이서연", action: "단골 등록 + 쿠폰 발송 (오프라인)", channel: "오프라인", time: "3분 전", profit: 0 },
  { id: 3, name: "박지호", action: "전략상품 — TV프리 결합 가입", channel: "모요", time: "8분 전", profit: 256_000 },
  { id: 4, name: "정유진", action: "신규 개통 — 아이폰 17 Pro", channel: "도그마루", time: "14분 전", profit: 312_000 },
  { id: 5, name: "최도윤", action: "자사 전환 완료 (KT → 자사)", channel: "당근", time: "21분 전", profit: 198_000 },
  { id: 6, name: "한소율", action: "IOT 부가서비스 추가 가입", channel: "오프라인", time: "33분 전", profit: 89_000 },
];

export const employeeRanking = [
  { rank: 1, name: "이서연", team: "1팀", profit: 18_420_000, count: 47 },
  { rank: 2, name: "박지호", team: "3팀", profit: 16_180_000, count: 41 },
  { rank: 3, name: "김민준", team: "1팀", profit: 14_950_000, count: 38 },
  { rank: 4, name: "정유진", team: "2팀", profit: 12_340_000, count: 34 },
  { rank: 5, name: "최도윤", team: "2팀", profit: 11_280_000, count: 31 },
  { rank: 6, name: "한소율", team: "3팀", profit: 10_550_000, count: 29 },
  { rank: 7, name: "윤재희", team: "1팀", profit: 9_820_000, count: 27 },
  { rank: 8, name: "강하늘", team: "2팀", profit: 9_140_000, count: 25 },
];

export const teamRanking = [
  { rank: 1, team: "1팀", profit: 48_920_000, members: 24, avg: 2_038_000 },
  { rank: 2, team: "3팀", profit: 42_180_000, members: 22, avg: 1_917_000 },
  { rank: 3, team: "2팀", profit: 37_350_000, members: 21, avg: 1_778_000 },
  { rank: 4, team: "4팀", profit: 31_200_000, members: 20, avg: 1_560_000 },
];

export const inflowChannels = ["당근", "모요", "도그마루", "오프라인", "지인소개", "기타"] as const;
export const planTiers = ["5G 시그니처", "5G 프리미어", "5G 스탠다드", "LTE 프리미엄", "LTE 베이직"] as const;
export const strategyProducts = ["TV프리", "IOT", "대명"] as const;
export const addonServices = ["넷플릭스팩", "디즈니+팩", "유튜브 프리미엄", "AI케어", "보험"] as const;

export const formatKRW = (n: number) => "₩" + n.toLocaleString("ko-KR");
export const formatShortKRW = (n: number) => {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString("ko-KR");
};
