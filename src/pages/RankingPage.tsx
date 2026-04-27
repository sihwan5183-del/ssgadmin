import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Crown, Medal, Trophy, Star, TrendingUp, Flame, Zap,
  Award, BarChart3, Smartphone, Gift, ChevronDown, CheckCircle2, Sparkles,
  Wifi, Tv, ArrowUp, ArrowDown, Minus, UserX, Target, ShieldCheck,
  Home, CreditCard, Monitor,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import confetti from "canvas-confetti";

/* ─── types ─── */
type ProfileMap = Record<string, { display_name: string; store: string | null }>;
type RankedUser = {
  user_id: string;
  name: string;
  store: string | null;
  count: number;
  profit: number;
  strategyCount: number;
  voucherReturned: number;
  streak: number;
  yesterdayDelta: number;        // count delta vs yesterday
  rankDelta: number;             // rank position change vs yesterday (positive = climbed)
  productCounts: { 모바일: number; 인터넷: number; TV프리: number; 부가서비스: number };
  isClean: boolean;
  cleanDays: number;
  excluded?: boolean;
  achievement: number;           // 평균 목표 달성률 (%)
  goalCount: number;             // 설정된 목표 개수
  vasAttach: number;             // 부가서비스/모바일 *100
  cleanScore: number;            // 0~100, 누락/미해결 적을수록 높음
  cleanPenalty: number;          // 누락+미해결 합계 (낮을수록 좋음)
  internetCount: number;         // 인터넷 가입 건수
  tvfreeCount: number;           // TV프리 가입 건수
  iotCount: number;              // 홈IOT/스마트홈 건수
  partnerCardCount: number;      // 제휴카드 결제 건수
};
type ModelRank = { model: string; count: number; isStrategy: boolean };

/* ─── Clean Master Badge ─── */
const CleanBadge = ({ size = "sm", days }: { size?: "sm" | "lg"; days?: number }) => (
  <span className={cn(
    "inline-flex items-center gap-0.5 font-semibold rounded-full border",
    "bg-gradient-to-r from-amber-100 to-emerald-400/15 text-amber-700 border-amber-400",
    "animate-[pulse_3s_ease-in-out_infinite]",
    size === "lg" ? "text-[10px] px-2 py-0.5 gap-1" : "text-[8px] px-1.5 py-0"
  )}>
    <CheckCircle2 className={size === "lg" ? "size-3" : "size-2.5"} />
    <Sparkles className={size === "lg" ? "size-2.5" : "size-2"} />
    클린 마스터{days && days > 1 ? ` ${days}일` : ""}
  </span>
);

/* ─── helpers ─── */
const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtKRW = (n: number) => {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
  return fmt(n);
};

const TIERS = [
  { min: 0,   label: "브론즈",     color: "from-orange-200 to-orange-100 text-orange-900 border-orange-500", sub: "text-orange-900/80",  icon: "🥉" },
  { min: 10,  label: "실버",       color: "from-slate-300  to-slate-200  text-slate-900  border-slate-500",  sub: "text-slate-900/80",   icon: "🥈" },
  { min: 25,  label: "골드",       color: "from-amber-200  to-amber-100  text-amber-900  border-amber-500",  sub: "text-amber-900/80",   icon: "🥇" },
  { min: 50,  label: "플래티넘",   color: "from-cyan-200   to-cyan-100   text-cyan-900   border-cyan-500",   sub: "text-cyan-900/80",    icon: "💎" },
  { min: 100, label: "다이아몬드", color: "from-violet-200 to-violet-100 text-violet-900 border-violet-500", sub: "text-violet-900/80",  icon: "👑" },
];
const getTier = (count: number) => {
  for (let i = TIERS.length - 1; i >= 0; i--) if (count >= TIERS[i].min) return TIERS[i];
  return TIERS[0];
};
const nextTier = (count: number) => {
  const idx = TIERS.findIndex((t) => count < t.min);
  return idx >= 0 ? TIERS[idx] : null;
};

const PERIOD_OPTIONS = [
  { value: "today", label: "오늘" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
  { value: "quarter", label: "이번 분기" },
];

const dateRange = (period: string) => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const toISO = (dt: Date) => dt.toISOString().slice(0, 10);
  if (period === "today") return { start: toISO(now), end: toISO(now) };
  if (period === "week") {
    const day = now.getDay();
    const mon = new Date(y, m, d - (day === 0 ? 6 : day - 1));
    return { start: toISO(mon), end: toISO(now) };
  }
  if (period === "quarter") {
    const qStartMonth = Math.floor(m / 3) * 3;
    return { start: `${y}-${String(qStartMonth + 1).padStart(2, "0")}-01`, end: toISO(now) };
  }
  return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: toISO(now) };
};
const yesterdayRange = () => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const s = y.toISOString().slice(0, 10);
  return { start: s, end: s };
};
/** 어제까지 누적된 같은 기간 (period 시작 ~ 어제) — 어제 시점 순위 계산용 */
const periodUpToYesterday = (period: string) => {
  const { start } = dateRange(period);
  const today = new Date();
  const yest = new Date(today.getTime() - 86400000);
  const yISO = yest.toISOString().slice(0, 10);
  // start might be after yISO if period=today — return null then
  if (yISO < start) return null;
  return { start, end: yISO };
};

/** 개통완료만 집계 — 취소·반납·반려는 실시간 차감 */
const COUNTED_STATUSES = ["개통완료"];
/** 집계에서 제외할 승인 상태 */
const EXCLUDED_APPROVAL = ["취소", "반려"];

/** 상품 버킷 — staff 페이지와 동일 규칙 */
const productBucket = (p: string | null): "모바일" | "인터넷" | "TV프리" | "스마트홈" | "기타" => {
  const s = (p ?? "").toLowerCase();
  if (!s) return "기타";
  // TV프리 우선 매칭 (일반 TV는 기타)
  if (/tv\s*프리|프리tv|tv프리/i.test(p ?? "") || (p ?? "").includes("TV프리")) return "TV프리";
  // 스마트홈 / 홈IOT / IOT / 홈안심 등
  if (/스마트홈|smart\s*home|홈\s*iot|^iot$|홈안심|허브|구글홈|애플홈/i.test(p ?? "")) return "스마트홈";
  if (/인터넷|기가|wifi/i.test(p ?? "")) return "인터넷";
  if (/모바일|mobile|usim|mnp|재약정|업셀/i.test(p ?? "")) return "모바일";
  return "기타";
};

/* ─── TABS ─── */
type TabKey =
  | "sales" | "profit" | "strategy" | "voucher" | "achievement"
  | "internet" | "tvfree" | "iot" | "partnerCard"
  | "vas" | "clean";
const TABS: { key: TabKey; label: string; icon: typeof Crown; sortFn: (a: RankedUser, b: RankedUser) => number }[] = [
  { key: "sales", label: "판매 왕", icon: Crown, sortFn: (a, b) => b.count - a.count },
  { key: "profit", label: "수익 왕", icon: TrendingUp, sortFn: (a, b) => b.profit - a.profit },
  { key: "strategy", label: "전략 모델 마스터", icon: Zap, sortFn: (a, b) => b.strategyCount - a.strategyCount },
  { key: "voucher", label: "상품권 킬러", icon: Gift, sortFn: (a, b) => b.voucherReturned - a.voucherReturned },
  { key: "achievement", label: "달성률 챔피언", icon: Target, sortFn: (a, b) => b.achievement - a.achievement || b.count - a.count },
  { key: "internet", label: "인터넷 판매왕", icon: Wifi, sortFn: (a, b) => b.internetCount - a.internetCount },
  { key: "tvfree", label: "TV프리 판매왕", icon: Monitor, sortFn: (a, b) => b.tvfreeCount - a.tvfreeCount },
  { key: "iot", label: "홈IOT 판매왕", icon: Home, sortFn: (a, b) => b.iotCount - a.iotCount },
  { key: "partnerCard", label: "제휴카드 판매왕", icon: CreditCard, sortFn: (a, b) => b.partnerCardCount - a.partnerCardCount },
  { key: "vas", label: "부가서비스 사냥꾼", icon: Sparkles, sortFn: (a, b) => b.vasAttach - a.vasAttach || b.count - a.count },
  { key: "clean", label: "클린 검수왕", icon: ShieldCheck, sortFn: (a, b) => b.cleanScore - a.cleanScore || a.cleanPenalty - b.cleanPenalty },
];

const PODIUM_STYLES = [
  {
    bg: "bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-200",
    ring: "ring-2 ring-amber-400 shadow-[0_0_24px_-4px_hsl(45_100%_60%/0.6)]",
    icon: Crown,
    color: "text-amber-700",
    halo: "from-amber-300/40 via-yellow-300/30 to-transparent",
  },
  {
    bg: "bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300",
    ring: "ring-2 ring-slate-400 shadow-[0_0_18px_-4px_hsl(220_15%_70%/0.5)]",
    icon: Trophy,
    color: "text-slate-700",
    halo: "from-slate-300/40 to-transparent",
  },
  {
    bg: "bg-gradient-to-br from-orange-200 via-amber-100 to-orange-300",
    ring: "ring-2 ring-orange-400 shadow-[0_0_18px_-4px_hsl(25_95%_60%/0.5)]",
    icon: Medal,
    color: "text-orange-700",
    halo: "from-orange-300/40 to-transparent",
  },
];

/** 미니 게이지 색상 */
const PRODUCT_COLORS = {
  모바일: "from-cyan-400 to-cyan-500",
  인터넷: "from-violet-400 to-violet-500",
  TV프리: "from-pink-400 to-pink-500",
  부가서비스: "from-amber-400 to-amber-500",
} as const;

const ProductMiniGauges = ({ counts, big = false }: { counts: RankedUser["productCounts"]; big?: boolean }) => {
  const max = Math.max(1, counts.모바일, counts.인터넷, counts.TV프리, counts.부가서비스);
  const items: { key: keyof typeof PRODUCT_COLORS; icon: any }[] = [
    { key: "모바일", icon: Smartphone },
    { key: "인터넷", icon: Wifi },
    { key: "TV프리", icon: Tv },
    { key: "부가서비스", icon: Gift },
  ];
  return (
    <div className={cn("space-y-1", big && "space-y-1.5")}>
      {items.map(({ key, icon: Icon }) => {
        const v = counts[key];
        const pct = Math.round((v / max) * 100);
        return (
          <div key={key} className="flex items-center gap-1.5">
            <Icon className={cn("text-muted-foreground shrink-0", big ? "size-3" : "size-2.5")} />
            <div className={cn("flex-1 rounded-full bg-muted/50 overflow-hidden", big ? "h-1.5" : "h-1")}>
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-all", PRODUCT_COLORS[key])}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={cn("text-muted-foreground tabular-nums shrink-0 text-right", big ? "text-[10px] w-6" : "text-[9px] w-5")}>{v}</span>
          </div>
        );
      })}
    </div>
  );
};

const RankDeltaPill = ({ delta }: { delta: number }) => {
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground bg-muted/30 border border-border/40 px-1.5 py-0.5 rounded-full">
        <Minus className="size-2.5" /> 동률
      </span>
    );
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9px] tabular-nums px-1.5 py-0.5 rounded-full border",
        up ? "text-emerald-700 bg-emerald-100 border-emerald-300" : "text-red-600 bg-red-100 border-red-300"
      )}
    >
      {up ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />}
      {Math.abs(delta)}
    </span>
  );
};

/* ─── Component ─── */
const RankingPage = () => {
  const { user } = useAuth();
  const confettiFired = useRef(false);
  const firstPlaceFiredFor = useRef<string>("");
  const [period, setPeriod] = useState("month");
  const [storeFilter, setStoreFilter] = useState("all");
  const [tab, setTab] = useState<TabKey>("sales");
  const [users, setUsers] = useState<RankedUser[]>([]);
  const [modelRanks, setModelRanks] = useState<ModelRank[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [stores, setStores] = useState<string[]>([]);
  const [cleanMap, setCleanMap] = useState<Map<string, { isClean: boolean; cleanDays: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [hideExcluded, setHideExcluded] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load ranking config from app_settings (default period + excluded users)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "ranking.config")
        .maybeSingle();
      if (data?.value) {
        const cfg: any = data.value;
        if (cfg.default_period && ["today", "week", "month", "quarter"].includes(cfg.default_period)) {
          setPeriod(cfg.default_period);
        }
        if (Array.isArray(cfg.excluded_user_ids)) setExcludedIds(new Set(cfg.excluded_user_ids));
        if (typeof cfg.hide_excluded === "boolean") setHideExcluded(cfg.hide_excluded);
      }
      setConfigLoaded(true);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = dateRange(period);
    const yd = yesterdayRange();
    const yPeriod = periodUpToYesterday(period);

    // Fetch profiles
    const { data: profs } = await supabase.from("profiles").select("user_id, display_name, store").eq("status", "active");
    const pMap: ProfileMap = {};
    const storeSet = new Set<string>();
    (profs ?? []).forEach((p) => {
      pMap[p.user_id] = { display_name: p.display_name, store: p.store };
      if (p.store) storeSet.add(p.store);
    });
    setProfiles(pMap);
    setStores(Array.from(storeSet).sort());

    // === user_id 통합 매칭: manager(이름) → user_id 우선, 없으면 created_by ===
    const nameToUid = new Map<string, string>();
    (profs ?? []).forEach((p) => {
      if (p.display_name) nameToUid.set(p.display_name.trim().toLowerCase(), p.user_id);
    });
    const ownerOf = (s: { manager?: string | null; created_by: string }) => {
      const m = (s.manager ?? "").trim().toLowerCase();
      if (m && nameToUid.has(m)) return nameToUid.get(m)!;
      return s.created_by;
    };

    // Fetch strategy model names
    const { data: stratModels } = await supabase.from("device_models").select("model_name").eq("is_strategy", true).eq("active", true);
    const stratSet = new Set((stratModels ?? []).map((m) => m.model_name));

    // 개통완료/반납완료 실적 (취소·반려 제외) — 판매원장 실시간 반영
    const { data: sales } = await supabase
      .from("sales")
      .select("id, created_by, manager, device_model, product, sale_type, status, approval_status, unit_price, distributor_amount, extra_subsidy, cash_support_amount, voucher, voucher_returned, vas1, vas2, open_date, custom_fields")
      .in("status", COUNTED_STATUSES)
      .not("approval_status", "in", `(${EXCLUDED_APPROVAL.join(",")})`)
      .gte("open_date", start)
      .lte("open_date", end)
      .limit(20000);

    // Yesterday daily delta (count change)
    const { data: ySales } = await supabase
      .from("sales")
      .select("created_by, manager")
      .in("status", COUNTED_STATUSES)
      .not("approval_status", "in", `(${EXCLUDED_APPROVAL.join(",")})`)
      .gte("open_date", yd.start)
      .lte("open_date", yd.end);

    // Period-up-to-yesterday sales for rank-delta snapshot
    let yPeriodSales: any[] = [];
    if (yPeriod) {
      const { data: yps } = await supabase
        .from("sales")
        .select("created_by, manager, device_model, unit_price, distributor_amount, extra_subsidy, cash_support_amount, voucher, voucher_returned")
        .in("status", COUNTED_STATUSES)
        .not("approval_status", "in", `(${EXCLUDED_APPROVAL.join(",")})`)
        .gte("open_date", yPeriod.start)
        .lte("open_date", yPeriod.end)
        .limit(20000);
      yPeriodSales = yps ?? [];
    }

    // Build per-user aggregates
    const uMap = new Map<string, {
      count: number; profit: number; strategyCount: number; voucherReturned: number;
      dateCounts: Map<string, number>;
      productCounts: { 모바일: number; 인터넷: number; TV프리: number; 부가서비스: number };
      iotCount: number;
      partnerCardCount: number;
    }>();
    const mMap = new Map<string, { count: number; isStrategy: boolean }>();
    const seenSaleIds = new Set<string>();

    (sales ?? []).forEach((s) => {
      // 중복 집계 방지
      if (seenSaleIds.has(s.id)) return;
      seenSaleIds.add(s.id);
      const uid = ownerOf(s as any);
      if (!uMap.has(uid)) uMap.set(uid, {
        count: 0, profit: 0, strategyCount: 0, voucherReturned: 0,
        dateCounts: new Map(),
        productCounts: { 모바일: 0, 인터넷: 0, TV프리: 0, 부가서비스: 0 },
        iotCount: 0,
        partnerCardCount: 0,
      });
      const u = uMap.get(uid)!;
      u.count++;
      const offer = (s.distributor_amount ?? 0) + (s.extra_subsidy ?? 0) + (s.cash_support_amount ?? 0);
      u.profit += (s.unit_price ?? 0) - offer;
      if (s.device_model && stratSet.has(s.device_model)) u.strategyCount++;
      if (s.voucher && s.voucher_returned === "유") u.voucherReturned++;
      if (s.open_date) u.dateCounts.set(s.open_date, (u.dateCounts.get(s.open_date) ?? 0) + 1);

      // 상품별 카운트 (product 필드 매핑된 행만 정확히 합산)
      const b = productBucket(s.product);
      if (b !== "기타") u.productCounts[b]++;
      // 스마트홈/홈IOT는 별도 카운트
      if (b === "스마트홈") u.iotCount++;
      if ((s.vas1 && String(s.vas1).trim() && s.vas1 !== "없음") || (s.vas2 && String(s.vas2).trim() && s.vas2 !== "없음")) {
        u.productCounts.부가서비스++;
      }

      // 제휴카드: custom_fields.partner_card_enabled === true
      const cf = (s as any).custom_fields ?? {};
      if (cf && cf.partner_card_enabled) u.partnerCardCount++;

      // Model ranking
      if (s.device_model) {
        if (!mMap.has(s.device_model)) mMap.set(s.device_model, { count: 0, isStrategy: stratSet.has(s.device_model) });
        mMap.get(s.device_model)!.count++;
      }
    });

    // Yesterday per-user counts
    const yMap = new Map<string, number>();
    (ySales ?? []).forEach((s: any) => {
      const uid = ownerOf(s);
      yMap.set(uid, (yMap.get(uid) ?? 0) + 1);
    });

    // === 목표 달성률 (당월 staff_product_goals 기준) ===
    const yearMonth = new Date().toISOString().slice(0, 7);
    const { data: goalRows } = await supabase
      .from("staff_product_goals")
      .select("user_id, product, sale_type, goal_type, goal_count, goal_value")
      .eq("year_month", yearMonth);

    const productBucketLoose = (p?: string | null): "모바일" | "인터넷" | "TV프리" | "스마트홈" | "부가서비스" | "기타" => {
      const v = (p ?? "").toString();
      if (/TV ?프리|티비프리|tvfree|tv free/i.test(v)) return "TV프리";
      if (/스마트홈|smart ?home|허브|구글홈|애플홈/i.test(v)) return "스마트홈";
      if (/인터넷|기가|wifi/i.test(v)) return "인터넷";
      if (/모바일|mobile|usim|mnp|재약정|업셀/i.test(v)) return "모바일";
      if (/부가|vas/i.test(v)) return "부가서비스";
      return "기타";
    };

    // per-user 실측 집계 (목표 달성률 계산용)
    const realByUser = new Map<string, {
      mobile: number; internet: number; tvfree: number; smarthome: number; vas: number;
      mobileBySaleType: Record<string, number>;
    }>();
    (sales ?? []).forEach((s: any) => {
      const uid = ownerOf(s);
      if (!realByUser.has(uid)) realByUser.set(uid, {
        mobile: 0, internet: 0, tvfree: 0, smarthome: 0, vas: 0,
        mobileBySaleType: {},
      });
      const r = realByUser.get(uid)!;
      const b = productBucketLoose(s.product);
      if (b === "모바일") {
        r.mobile++;
        const st = String((s as any).sale_type ?? "").trim();
        if (st) r.mobileBySaleType[st] = (r.mobileBySaleType[st] ?? 0) + 1;
      } else if (b === "인터넷") r.internet++;
      else if (b === "TV프리") r.tvfree++;
      else if (b === "스마트홈") r.smarthome++;
      if ((s.vas1 && String(s.vas1).trim() && s.vas1 !== "없음") || (s.vas2 && String(s.vas2).trim() && s.vas2 !== "없음")) {
        r.vas++;
      }
    });

    const achMap = new Map<string, { avg: number; cnt: number }>();
    (goalRows ?? []).forEach((g: any) => {
      const uid = g.user_id;
      const real = realByUser.get(uid) ?? { mobile: 0, internet: 0, tvfree: 0, smarthome: 0, vas: 0, mobileBySaleType: {} };
      const product = String(g.product ?? "");
      const goalType = String(g.goal_type ?? "count");
      let actual = 0;
      let target = Number(g.goal_value ?? g.goal_count ?? 0);
      if (!target) return;
      const b = productBucketLoose(product);
      const baseCount = b === "모바일" ? real.mobile
        : b === "인터넷" ? real.internet
        : b === "TV프리" ? real.tvfree
        : b === "스마트홈" ? real.smarthome
        : b === "부가서비스" ? real.vas
        : 0;
      if (b === "모바일" && g.sale_type) {
        actual = real.mobileBySaleType[String(g.sale_type)] ?? 0;
      } else {
        actual = baseCount;
      }
      let pct = 0;
      if (goalType === "rate") {
        // 모바일 대비 유치율 목표
        const rate = real.mobile > 0 ? (baseCount / real.mobile) * 100 : 0;
        pct = target > 0 ? (rate / target) * 100 : 0;
      } else {
        pct = target > 0 ? (actual / target) * 100 : 0;
      }
      pct = Math.max(0, Math.min(200, pct)); // 200% 상한
      const cur = achMap.get(uid) ?? { avg: 0, cnt: 0 };
      cur.avg = (cur.avg * cur.cnt + pct) / (cur.cnt + 1);
      cur.cnt += 1;
      achMap.set(uid, cur);
    });

    // === Yesterday-snapshot rankings (per current tab metric) for rank delta ===
    const yAgg = new Map<string, { count: number; profit: number; strategyCount: number; voucherReturned: number }>();
    yPeriodSales.forEach((s: any) => {
      const uid = ownerOf(s);
      if (!yAgg.has(uid)) yAgg.set(uid, { count: 0, profit: 0, strategyCount: 0, voucherReturned: 0 });
      const u = yAgg.get(uid)!;
      u.count++;
      const offer = (s.distributor_amount ?? 0) + (s.extra_subsidy ?? 0) + (s.cash_support_amount ?? 0);
      u.profit += (s.unit_price ?? 0) - offer;
      if (s.device_model && stratSet.has(s.device_model)) u.strategyCount++;
      if (s.voucher && s.voucher_returned === "유") u.voucherReturned++;
    });

    // Calculate streak (consecutive days with sales ending today)
    const calcStreak = (dateCounts: Map<string, number>) => {
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (dateCounts.has(key)) streak++;
        else break;
      }
      return streak;
    };

    // Clean status: missing docs & unresolved pending items
    const { data: allSalesClean } = await supabase
      .from("sales")
      .select("id, created_by, manager, pending_resolved")
      .gte("open_date", start)
      .lte("open_date", end);
    const { data: allDocs } = await supabase
      .from("sale_documents")
      .select("sale_id");
    const docSet = new Set((allDocs ?? []).map((d) => d.sale_id));
    const cleanCalc = new Map<string, { missingDocs: number; pendingItems: number }>();
    (allSalesClean ?? []).forEach((s: any) => {
      const uid = ownerOf(s);
      if (!cleanCalc.has(uid)) cleanCalc.set(uid, { missingDocs: 0, pendingItems: 0 });
      const c = cleanCalc.get(uid)!;
      if (!docSet.has(s.id)) c.missingDocs++;
      if (!s.pending_resolved) c.pendingItems++;
    });
    const cMap = new Map<string, { isClean: boolean; cleanDays: number }>();
    cleanCalc.forEach((v, uid) => {
      const isClean = v.missingDocs === 0 && v.pendingItems === 0;
      const days = isClean ? Math.max(1, calcStreak(uMap.get(uid)?.dateCounts ?? new Map())) : 0;
      cMap.set(uid, { isClean, cleanDays: days });
    });
    setCleanMap(cMap);

    const ranked: RankedUser[] = [];
    uMap.forEach((v, uid) => {
      const p = pMap[uid];
      if (!p) return;
      const clean = cMap.get(uid);
      const mob = v.productCounts.모바일;
      const vasAttach = mob > 0 ? Math.round((v.productCounts.부가서비스 / mob) * 100) : 0;
      const penalty = (cleanCalc.get(uid)?.missingDocs ?? 0) + (cleanCalc.get(uid)?.pendingItems ?? 0);
      const total = v.count || 1;
      const cleanScore = Math.max(0, Math.round((1 - penalty / total) * 100));
      ranked.push({
        user_id: uid,
        name: p.display_name,
        store: p.store,
        count: v.count,
        profit: v.profit,
        strategyCount: v.strategyCount,
        voucherReturned: v.voucherReturned,
        streak: calcStreak(v.dateCounts),
        yesterdayDelta: v.count - (yMap.get(uid) ?? 0),
        rankDelta: 0,
        productCounts: v.productCounts,
        isClean: clean?.isClean ?? false,
        cleanDays: clean?.cleanDays ?? 0,
        excluded: excludedIds.has(uid),
        achievement: Math.round(achMap.get(uid)?.avg ?? 0),
        goalCount: achMap.get(uid)?.cnt ?? 0,
        vasAttach,
        cleanScore,
        cleanPenalty: penalty,
        internetCount: v.productCounts.인터넷,
        tvfreeCount: v.productCounts.TV프리,
        iotCount: v.iotCount,
        partnerCardCount: v.partnerCardCount,
      });
    });

    // === rank delta vs yesterday: compute by sorting both snapshots by current tab metric ===
    const metricFor = (m: { count: number; profit: number; strategyCount: number; voucherReturned: number }) => {
      switch (tab) {
        case "profit": return m.profit;
        case "strategy": return m.strategyCount;
        case "voucher": return m.voucherReturned;
        default: return m.count;
      }
    };
    const todayMetric = ranked.map((r) => ({ uid: r.user_id, v: metricFor(r) }));
    todayMetric.sort((a, b) => b.v - a.v);
    const todayRank = new Map<string, number>();
    todayMetric.forEach((r, i) => todayRank.set(r.uid, i + 1));

    const yMetric: { uid: string; v: number }[] = [];
    yAgg.forEach((m, uid) => yMetric.push({ uid, v: metricFor(m) }));
    // Include users with 0 in yesterday so they have a baseline rank
    ranked.forEach((r) => {
      if (!yAgg.has(r.user_id)) yMetric.push({ uid: r.user_id, v: 0 });
    });
    yMetric.sort((a, b) => b.v - a.v);
    const yRank = new Map<string, number>();
    yMetric.forEach((r, i) => yRank.set(r.uid, i + 1));

    ranked.forEach((r) => {
      const t = todayRank.get(r.user_id) ?? 0;
      const y = yRank.get(r.user_id) ?? 0;
      r.rankDelta = y && t ? y - t : 0; // positive = climbed
    });

    setUsers(ranked);
    setModelRanks(
      Array.from(mMap.entries())
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );
    setLoading(false);
  }, [period, tab, excludedIds]);

  useEffect(() => { if (configLoaded) load(); }, [load, configLoaded]);

  const activeTab = TABS.find((t) => t.key === tab)!;
  const sorted = useMemo(() => {
    let list = [...users];
    if (storeFilter !== "all") list = list.filter((u) => u.store === storeFilter);
    if (hideExcluded) list = list.filter((u) => !u.excluded);
    if (tab === "achievement") list = list.filter((u) => u.goalCount > 0);
    if (tab === "vas") list = list.filter((u) => u.productCounts.모바일 > 0);
    // 상품별 판매왕 / 제휴카드: 0건은 의미 없음
    if (tab === "internet") list = list.filter((u) => u.internetCount > 0);
    if (tab === "tvfree") list = list.filter((u) => u.tvfreeCount > 0);
    if (tab === "iot") list = list.filter((u) => u.iotCount > 0);
    if (tab === "partnerCard") list = list.filter((u) => u.partnerCardCount > 0);
    if (tab === "clean") list = list.filter((u) => u.count > 0);
    return list.sort(activeTab.sortFn);
  }, [users, storeFilter, activeTab, hideExcluded, tab]);

  const top10 = sorted.slice(0, 10);
  const podium = top10.slice(0, 3);
  const rest = top10.slice(3);

  // Rising star: highest yesterdayDelta
  // Rising star: 어제 대비 순위가 가장 많이 상승한 직원 (rankDelta) — 동률이면 yesterdayDelta 순위
  const risingStar = useMemo(() => {
    const pool = users.filter((u) => !u.excluded);
    const climbers = pool.filter((u) => u.rankDelta > 0);
    if (climbers.length > 0) {
      return [...climbers].sort((a, b) => b.rankDelta - a.rankDelta || b.yesterdayDelta - a.yesterdayDelta)[0];
    }
    const grew = pool.filter((u) => u.yesterdayDelta > 0);
    if (grew.length > 0) return [...grew].sort((a, b) => b.yesterdayDelta - a.yesterdayDelta)[0];
    return null;
  }, [users]);

  // My rank
  const myRank = useMemo(() => {
    if (!user) return null;
    const idx = sorted.findIndex((u) => u.user_id === user.id);
    if (idx < 0) return null;
    return { rank: idx + 1, data: sorted[idx] };
  }, [sorted, user]);

  // Confetti when user achieves clean status
  useEffect(() => {
    if (!user || confettiFired.current) return;
    const myClean = cleanMap.get(user.id);
    if (myClean?.isClean && myClean.cleanDays <= 1) {
      confettiFired.current = true;
      setTimeout(() => {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#FFD700", "#FFA500", "#10B981", "#3B82F6"] });
        // Show toast
        import("sonner").then(({ toast }) => {
          toast.success("🎉 완벽한 정산입니다! 클린 마스터 배지를 획득했습니다!", { duration: 5000 });
        });
      }, 500);
    }
  }, [cleanMap, user]);

  // 본인이 현재 탭의 1위에 등극하면 풀스크린 축하 이펙트 (탭별 1회)
  useEffect(() => {
    if (!user || !myRank || myRank.rank !== 1) return;
    const key = `${tab}:${user.id}`;
    if (firstPlaceFiredFor.current === key) return;
    firstPlaceFiredFor.current = key;
    const tabLabel = TABS.find((t) => t.key === tab)?.label ?? "";
    const burst = (origin: { x: number; y: number }) =>
      confetti({
        particleCount: 120, spread: 80, origin, ticks: 220,
        colors: ["#FFD700", "#FF6B6B", "#4ECDC4", "#A78BFA", "#F59E0B", "#10B981"],
      });
    setTimeout(() => burst({ x: 0.15, y: 0.6 }), 0);
    setTimeout(() => burst({ x: 0.85, y: 0.6 }), 200);
    setTimeout(() => burst({ x: 0.5, y: 0.4 }), 400);
    setTimeout(() => burst({ x: 0.5, y: 0.7 }), 700);
    import("sonner").then(({ toast }) => {
      toast.success(`🏆 [${tabLabel}] 1위 등극! 축하합니다!`, { duration: 6000 });
    });
  }, [myRank, tab, user]);

  const getValue = (u: RankedUser) => {
    switch (tab) {
      case "sales": return `${u.count}건`;
      case "profit": return `${fmtKRW(u.profit)}원`;
      case "strategy": return `${u.strategyCount}건`;
      case "voucher": return `${u.voucherReturned}건`;
      case "achievement": return u.goalCount > 0 ? `${u.achievement}%` : "목표 미설정";
      case "internet": return `${u.internetCount}건`;
      case "tvfree": return `${u.tvfreeCount}건`;
      case "iot": return `${u.iotCount}건`;
      case "partnerCard": return `${u.partnerCardCount}건`;
      case "vas": return `${u.vasAttach}%`;
      case "clean": return `${u.cleanScore}점`;
    }
  };

  return (
    <>
      <Header title="판매 랭킹 센터" subtitle="전체 직원 및 매장별 실시간 판매 순위" showPeriodFilter={false} />

      {/* 내 순위 배너 */}
      {myRank && (
        <section className="glass rounded-2xl p-4 mb-4 shadow-card-elevated">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={cn("size-10 rounded-full grid place-items-center text-lg font-bold ring-2",
                getTier(myRank.data.count).color.split(" ").slice(0, 2).join(" "),
                "ring-primary/30"
              )}>
                {getTier(myRank.data.count).icon}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  현재 전체 <span className="text-primary-glow">{myRank.rank}위</span>입니다!
                </p>
                <p className="text-xs text-muted-foreground">
                  {getTier(myRank.data.count).label} 등급 · {myRank.data.count}건 판매
                  {nextTier(myRank.data.count) && (
                    <> · 다음 등급({nextTier(myRank.data.count)!.label})까지 <span className="text-primary font-semibold">{nextTier(myRank.data.count)!.min - myRank.data.count}건</span> 남았습니다</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {myRank.data.isClean && <CleanBadge size="lg" days={myRank.data.cleanDays} />}
              {myRank.data.streak >= 3 && (
                <Badge className="bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-700 border-orange-300 gap-1">
                  <Flame className="size-3" /> {myRank.data.streak}일 연속 열일 중! 🔥
                </Badge>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px] h-9 text-xs rounded-xl bg-input/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl bg-input/60">
            <SelectValue placeholder="전체 매장" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 매장</SelectItem>
            {stores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex p-1 rounded-xl bg-muted/60 text-xs mb-5 overflow-x-auto gap-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all whitespace-nowrap",
                tab === t.key ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* 라이징 스타 */}
      {risingStar && (
        <div className="glass rounded-2xl p-4 mb-5 shadow-card-elevated border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center shadow-glow animate-pulse">
              <Star className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-amber-400 font-semibold">⭐ 오늘의 라이징 스타</p>
              <p className="text-sm font-bold">
                {risingStar.name}
                {risingStar.store && <span className="text-xs text-muted-foreground font-normal ml-1.5">({risingStar.store})</span>}
                <span className="text-xs text-primary-glow ml-2">
                  {risingStar.rankDelta > 0
                    ? `어제 대비 순위 ▲${risingStar.rankDelta}계단 상승! 🚀`
                    : `어제 대비 +${risingStar.yesterdayDelta}건 급증! 🚀`}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 리더보드 (2/3) */}
        <div className="lg:col-span-2 glass rounded-2xl p-5 shadow-card-elevated">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <activeTab.icon className="size-4 text-primary" /> TOP 10 — {activeTab.label}
          </h3>

          {loading ? (
            <div className="space-y-5">
              <p className="text-center text-xs text-muted-foreground py-1">데이터를 불러오는 중입니다...</p>
              {/* Podium skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-2xl p-5 min-h-[260px] bg-muted/30 animate-pulse border border-border/40">
                    <div className="h-6 w-12 rounded bg-muted/60 mb-3" />
                    <div className="h-5 w-32 rounded bg-muted/60 mb-2" />
                    <div className="h-3 w-20 rounded bg-muted/40 mb-4" />
                    <div className="h-9 w-24 rounded bg-muted/60 mb-3" />
                    <div className="space-y-2 pt-3 border-t border-border/30">
                      {[0,1,2,3].map((j) => <div key={j} className="h-1.5 rounded-full bg-muted/40" />)}
                    </div>
                  </div>
                ))}
              </div>
              {/* List skeleton */}
              <ul className="space-y-1.5">
                {[0,1,2,3,4,5,6].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-muted/20 animate-pulse">
                    <div className="size-6 rounded bg-muted/50" />
                    <div className="h-4 w-32 rounded bg-muted/50" />
                    <div className="h-3 w-16 rounded bg-muted/40 ml-auto" />
                  </li>
                ))}
              </ul>
            </div>
          ) : top10.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">데이터가 없습니다</div>
          ) : (
            <>
              {/* Podium */}
              {/* Podium — TOP3 (1.5x 크게, 금/은/동 그라데이션 + 왕관) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-stretch">
                {podium.map((u, i) => {
                  const S = PODIUM_STYLES[i];
                  const Icon = S.icon;
                  const tier = getTier(u.count);
                  const isMe = u.user_id === user?.id;
                  return (
                    <div
                      key={u.user_id}
                      className={cn(
                        "relative overflow-hidden rounded-2xl p-5 backdrop-blur-md transition-all hover:-translate-y-1",
                        "min-h-[260px]",
                        S.bg, S.ring,
                        isMe && "outline outline-2 outline-primary/50 outline-offset-2"
                      )}
                    >
                      {/* 반짝임 후광 */}
                      <div className={cn("absolute -top-12 -right-12 size-40 rounded-full blur-3xl bg-gradient-to-br pointer-events-none", S.halo)} />
                      {/* 왕관 (1위만 큼) */}
                      <div className={cn(
                        "absolute -top-2 left-1/2 -translate-x-1/2 grid place-items-center",
                        i === 0 ? "size-12" : "size-9"
                      )}>
                        <Icon className={cn(S.color, "drop-shadow-md", i === 0 ? "size-9 animate-pulse" : "size-6")} />
                      </div>

                      <div className="relative pt-6 flex flex-col h-full">
                        <div className="flex items-center justify-between">
                          <span className={cn("text-2xl font-extrabold tabular-nums", S.color)}>#{i + 1}</span>
                          <RankDeltaPill delta={u.rankDelta} />
                        </div>
                        <div className="mt-2">
                          <div className="text-lg font-extrabold truncate text-foreground">{u.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <span className="size-1 rounded-full bg-muted-foreground/60" />
                          {u.store ?? "매장 미배정"}
                        </div>
                        </div>
                        <div className={cn("mt-3 font-extrabold tabular-nums", i === 0 ? "text-3xl" : "text-2xl", S.color)}>
                          {getValue(u)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge className={cn("text-[10px] px-2 py-0.5 border bg-gradient-to-br", tier.color)}>
                            <span className="mr-1">{tier.icon}</span>
                            {tier.label}
                          </Badge>
                          {u.streak >= 3 && (
                            <Badge className="text-[9px] bg-orange-100 text-orange-700 border-orange-300 gap-0.5">
                              <Flame className="size-2.5" /> {u.streak}일
                            </Badge>
                          )}
                          {u.isClean && u.cleanDays > 0 && <CleanBadge days={u.cleanDays} />}
                        </div>

                        {/* 상품별 미니 게이지 */}
                        <div className="mt-3 pt-3 border-t border-foreground/10">
                          <ProductMiniGauges counts={u.productCounts} big />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 4~10위 리스트 */}
              <ul className="space-y-1.5">
                {rest.map((u, i) => {
                  const tier = getTier(u.count);
                  const isMe = u.user_id === user?.id;
                  return (
                    <li key={u.user_id} className={cn(
                      "grid grid-cols-12 items-center gap-2 px-3 py-2.5 rounded-lg transition-colors border border-transparent",
                      isMe ? "bg-primary/[0.08] ring-1 ring-primary/20" : "hover:bg-muted/30 hover:border-border/40"
                    )}>
                      <div className="col-span-6 flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground tabular-nums w-6 text-center shrink-0">{i + 4}</span>
                        <span className="text-base shrink-0">{tier.icon}</span>
                        <span className="text-sm font-semibold truncate">{u.name}</span>
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60 shrink-0">
                          {u.store ?? "미배정"}
                        </span>
                        <RankDeltaPill delta={u.rankDelta} />
                        {u.isClean && <CleanBadge days={u.cleanDays} />}
                        {u.streak >= 3 && (
                          <span className="text-[10px] text-orange-500 flex items-center gap-0.5 shrink-0">
                            <Flame className="size-2.5" />{u.streak}일
                          </span>
                        )}
                      </div>
                      <div className="col-span-4 hidden md:block">
                        <ProductMiniGauges counts={u.productCounts} />
                      </div>
                      <div className="col-span-6 md:col-span-2 text-right">
                        <span className="text-sm font-bold tabular-nums">{getValue(u)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* 사이드 패널 (1/3) */}
        <div className="space-y-5">
          {/* 모델별 판매량 TOP 5 */}
          <div className="glass rounded-2xl p-5 shadow-card-elevated">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Smartphone className="size-4 text-primary" /> 모델별 판매량 TOP 5
            </h4>
            {modelRanks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">데이터 없음</p>
            ) : (
              <ul className="space-y-2">
                {modelRanks.map((m, i) => {
                  const maxCount = modelRanks[0]?.count ?? 1;
                  const pct = Math.round((m.count / maxCount) * 100);
                  return (
                    <li key={m.model} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                          {m.model}
                          {m.isStrategy && (
                            <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary border-primary/30">전략</Badge>
                          )}
                        </span>
                        <span className="tabular-nums font-semibold">{m.count}건</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            m.isStrategy
                              ? "bg-gradient-to-r from-primary to-primary-glow shadow-[0_0_8px_hsl(330_100%_55%/0.5)]"
                              : "bg-muted-foreground/40"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 등급 안내 */}
          <div className="glass rounded-2xl p-5 shadow-card-elevated">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Award className="size-4 text-primary" /> 등급 시스템
            </h4>
            <ul className="space-y-2">
              {TIERS.map((t) => (
                <li
                  key={t.label}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg ring-1 bg-gradient-to-br",
                    t.color
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className="text-base leading-none">{t.icon}</span>
                    {t.label}
                  </span>
                  <span className={cn("text-xs font-semibold tabular-nums", t.sub)}>
                    {t.min}건 이상
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default RankingPage;
