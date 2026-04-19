// 매체별 색상 — 다크모드 친화 HSL
export interface MediaPalette {
  bg: string; // 막대 배경 (반투명)
  border: string; // 테두리
  dot: string; // 도트 강조
  text: string; // 글자 색
  label: string;
}

const palettes: Record<string, MediaPalette> = {
  당근: {
    bg: "bg-[hsl(28_95%_55%/0.18)]",
    border: "border-[hsl(28_95%_55%/0.55)]",
    dot: "bg-[hsl(28_95%_60%)]",
    text: "text-[hsl(28_95%_75%)]",
    label: "당근",
  },
  네이버: {
    bg: "bg-[hsl(140_70%_45%/0.18)]",
    border: "border-[hsl(140_70%_45%/0.55)]",
    dot: "bg-[hsl(140_70%_55%)]",
    text: "text-[hsl(140_70%_70%)]",
    label: "네이버",
  },
  메타: {
    bg: "bg-[hsl(220_90%_60%/0.18)]",
    border: "border-[hsl(220_90%_60%/0.55)]",
    dot: "bg-[hsl(220_90%_65%)]",
    text: "text-[hsl(220_90%_78%)]",
    label: "메타",
  },
  카카오: {
    bg: "bg-[hsl(50_95%_55%/0.18)]",
    border: "border-[hsl(50_95%_55%/0.55)]",
    dot: "bg-[hsl(50_95%_60%)]",
    text: "text-[hsl(50_95%_75%)]",
    label: "카카오",
  },
  구글: {
    bg: "bg-[hsl(0_75%_60%/0.18)]",
    border: "border-[hsl(0_75%_60%/0.55)]",
    dot: "bg-[hsl(0_75%_65%)]",
    text: "text-[hsl(0_75%_78%)]",
    label: "구글",
  },
  유튜브: {
    bg: "bg-[hsl(355_85%_55%/0.18)]",
    border: "border-[hsl(355_85%_55%/0.55)]",
    dot: "bg-[hsl(355_85%_60%)]",
    text: "text-[hsl(355_85%_75%)]",
    label: "유튜브",
  },
  인스타그램: {
    bg: "bg-[hsl(320_80%_60%/0.18)]",
    border: "border-[hsl(320_80%_60%/0.55)]",
    dot: "bg-[hsl(320_80%_65%)]",
    text: "text-[hsl(320_80%_78%)]",
    label: "인스타그램",
  },
  기타: {
    bg: "bg-[hsl(260_60%_60%/0.18)]",
    border: "border-[hsl(260_60%_60%/0.55)]",
    dot: "bg-[hsl(260_60%_65%)]",
    text: "text-[hsl(260_60%_78%)]",
    label: "기타",
  },
};

export const getMediaPalette = (media?: string | null): MediaPalette => {
  if (!media) return palettes["기타"];
  // 부분 매칭 (예: "당근마켓" → "당근")
  for (const key of Object.keys(palettes)) {
    if (media.includes(key)) return palettes[key];
  }
  return palettes["기타"];
};

export const MEDIA_OPTIONS = ["당근", "네이버", "메타", "카카오", "구글", "유튜브", "인스타그램", "기타"];
