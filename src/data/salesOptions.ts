// 엑셀 '실적장표' 기준 입력 옵션
export const CHANNELS = ["모요", "유닥", "오프라인", "캠페인", "당근", "도그마루", "SEG활동", "기타"] as const;
export const PRODUCTS = ["모바일", "USIM MNP", "세컨", "인터넷", "TV프리", "IOT", "대명", "홈"] as const;
export const SALE_TYPES = ["MNP", "신규", "기변", "USIM MNP"] as const;
export const OPEN_METHODS = ["선개통", "후개통"] as const;
export const STATUSES = ["개통완료", "예약", "보류", "취소"] as const;
export const RATE_PLANS = [
  "프리미어 에센셜",
  "프리미어 레귤러",
  "프리미어 플러스",
  "5G 시그니처",
  "5G 스탠다드",
  "LTE 프리미엄",
  "wearable",
] as const;
export const DELIVERY_TYPES = ["택배발송", "퀵배송", "매장방문", "직접전달"] as const;
export const BANKS = ["국민", "신한", "우리", "하나", "농협", "기업", "카카오뱅크", "토스뱅크"] as const;
