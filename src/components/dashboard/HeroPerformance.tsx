import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Sun, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle, Smartphone, Monitor, Package, Wifi, Tv, Home, Star, CreditCard, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { applyActivationFilter, EXCLUDED_ACTIVATION_STATUSES } from "@/lib/salesFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProductScope, type ProductScope as Scope6 } from "@/contexts/ProductScopeContext";

type Segment = "all" | "모바일" | "USIM MNP" | "2nd" | "홈" | "TV프리" | "스마트홈" | "대명" | "맞춤제안" | "기타";

const PRODUCT_BADGES: { key: Segment; label: string; short: string; icon: typeof Smartphone; color: string }[] = [
  { key: "all", label: "전체", short: "전체", icon: Package, color: "text-foreground" },
  { key: "모바일", label: "모바일", short: "M", icon: Smartphone, color: "text-primary" },
  { key: "USIM MNP", label: "USIM", short: "U", icon: CreditCard, color: "text-chart-1" },
  { key: "2nd", label: "2nd", short: "2", icon: Smartphone, color: "text-chart-2" },
  { key: "홈", label: "홈", short: "H", icon: Wifi, color: "text-chart-3" },
  { key: "TV프리", label: "TV프리", short: "TV", icon: Tv, color: "text-chart-4" },
  { key: "스마트홈", label: "스마트홈", short: "SH", icon: Home, color: "text-chart-5" },
  { key: "대명", label: "대명", short: "DM", icon: Star, color: "text-warning" },
  { key: "맞춤제안", label: "업셀", short: "UP", icon: Lightbulb, color: "text-success" },
  { key: "기타", label: "기타", short: "E", icon: Package, color: "text-muted-foreground" },
];

const classifyProduct = (p: string | null): Segment => {
  if (!p) return "기타";
  if (p.includes("모바일")) return "모바일";
  if (p === "USIM MNP" || p.includes("USIM")) return "USIM MNP";
  if (p === "세컨" || p === "2nd" || p.includes("세컨")) return "2nd";
  if (p === "홈" || p.includes("인터넷")) return "홈";
  if (p.includes("TV프리") || p.includes("TV")) return "TV프리";
  if (p.includes("스마트홈") || p.includes("IOT")) return "스마트홈";
  if (p.includes("대명")) return "대명";
  if (p.includes("맞춤") || p.includes("업셀")) return "맞춤제안";
  return "기타";
};

const matchSegment = (product: string | null, seg: Segment) => {
  if (seg === "all") return true;
  return classifyProduct(product) === seg;
};

const PENDING_ACTIVATION_STATUS_OR =
  "status.eq.청약완료,status.eq.택배발송,status.ilike.청약*완료,status.ilike.택배*발송";
const normalizeStatusValue = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, "").trim();
const isPendingActivationStatus = (value: string | null | undefined) =>
  normalizeStatusValue(value) === "청약완료" || normalizeStatusValue(value) === "택배발송";

type SegMap = Record<Segment, number>;
const countAll = (rows: { product: string | null }[]): SegMap => {
  const m: SegMap = { all: 0, "모바일": 0, "USIM MNP": 0, "2nd": 0, "홈": 0, "TV프리": 0, "스마트홈": 0, "대명": 0, "맞춤제안": 0, "기타": 0 };
  rows.forEach((r) => { const k = classifyProduct(r.product); m[k]++; m.all++; });
  return m;
};

/** 카드 hover 시 노출되는 세부 유형 breakdown — 시각적 피로 제거를 위해 툴팁으로 숨김 */
const SegBreakdownTooltip = ({ counts }: { counts: SegMap }) => {
  const items = PRODUCT_BADGES.filter((b) => b.key !== "all" && counts[b.key] > 0);
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 min-w-[160px]">
      {items.map((b) => (
        <div key={b.key} className="flex items-center justify-between gap-2 text-[11px]">
          <span className={cn("inline-flex items-center gap-1 font-medium", b.color)}>
            <b.icon className="size-3" />
            {b.label}
          </span>
          <span className="font-bold tabular-nums">{counts[b.key]}</span>
        </div>
      ))}
    </div>
  );
};

/** ProductScope (6대 카드) → HeroPerformance 내부 Segment 매핑 */
const scopeToSegment = (s: Scope6): Segment => {
  switch (s) {
    case "all": return "all";
    case "모바일": return "모바일";
    case "인터넷": return "홈";
    case "TV프리": return "TV프리";
    case "스마트홈": return "스마트홈";
    case "대명": return "대명";
    case "업셀": return "맞춤제안";
    default: return "all";
  }
};

const Delta = ({ value, label }: { value: number; label: string }) => {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
          positive
            ? "text-success bg-success/10 border border-success/20"
            : "text-destructive bg-destructive/10 border border-destructive/20"
        )}
      >
        <Icon className="size-2.5" />
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
};

export const HeroPerformance = () => {
  const { startDate, endDate, prevStartDate, prevEndDate, label, month } = usePeriod();
  const { monthlyTarget } = useAppSettings();
  const { scope } = useProductScope();
  const segment: Segment = scopeToSegment(scope);
  const [todayRows, setTodayRows] = useState<{ product: string | null }[]>([]);
  const [ydayRows, setYdayRows] = useState<{ product: string | null }[]>([]);
  const [currentRows, setCurrentRows] = useState<{ product: string | null }[]>([]);
  const [prevRows, setPrevRows] = useState<{ product: string | null }[]>([]);
  const [pendingRows, setPendingRows] = useState<{ product: string | null; created_at: string; open_date: string | null; status: string | null; sale_type: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const todayISO = new Date().toISOString().slice(0, 10);
    const ydate = new Date();
    ydate.setDate(ydate.getDate() - 1);
    const ydayISO = ydate.toISOString().slice(0, 10);
    // 개통 집계 (Source of Truth): open_date 기준 + 취소/개통취소/반려 제외
    const activated = (s: string, e: string) =>
      applyActivationFilter(supabase.from("sales").select("product"), s, e).limit(10000);
    // 개통 대기는 open_date가 없을 수 있으므로 별도 (이번 기간 내 created_at 기준)
    let pendingQuery: any = supabase
      .from("sales")
      .select("product, created_at, open_date, status, sale_type")
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59.999`);
    for (const s of EXCLUDED_ACTIVATION_STATUSES) pendingQuery = pendingQuery.neq("status", s);
    // [맞춤제안 실적관리] 데이터 — 업셀 세그먼트로 합산 (change_date 기준)
    const proposals = (s: string, e: string) =>
      supabase
        .from("custom_proposals")
        .select("id")
        .gte("change_date", s)
        .lte("change_date", e)
        .limit(10000);
    const [a, b, c, d, e, pa, pb, pc, pd] = await Promise.all([
      activated(startDate, endDate),
      activated(prevStartDate, prevEndDate),
      activated(todayISO, todayISO),
      activated(ydayISO, ydayISO),
      pendingQuery.limit(10000),
      proposals(startDate, endDate),
      proposals(prevStartDate, prevEndDate),
      proposals(todayISO, todayISO),
      proposals(ydayISO, ydayISO),
    ]);
    // 맞춤제안 1건 = 업셀 실적 1건 으로 카운트되도록 product="맞춤제안" 가상 행 주입
    const asUpsell = (n: number) =>
      Array.from({ length: n }, () => ({ product: "맞춤제안" as string | null }));
    setCurrentRows([...(a.data ?? []), ...asUpsell(pa.data?.length ?? 0)]);
    setPrevRows([...(b.data ?? []), ...asUpsell(pb.data?.length ?? 0)]);
    setTodayRows([...(c.data ?? []), ...asUpsell(pc.data?.length ?? 0)]);
    setYdayRows([...(d.data ?? []), ...asUpsell(pd.data?.length ?? 0)]);
    setPendingRows(e.data ?? []);
    setLoading(false);
  }, [startDate, endDate, prevStartDate, prevEndDate]);

  useEffect(() => {
    let alive = true;
    fetchAll().catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchAll]);

  // 실시간 동기화: sales 변경 시 즉시 재조회 (장표와 1:1 일치 유지)
  useEffect(() => {
    const ch = supabase
      .channel("dashboard-hero-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        fetchAll();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_proposals" }, () => {
        fetchAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const cur = currentRows.filter((r) => matchSegment(r.product, segment));
    const prev = prevRows.filter((r) => matchSegment(r.product, segment));
    const tod = todayRows.filter((r) => matchSegment(r.product, segment));
    const yd = ydayRows.filter((r) => matchSegment(r.product, segment));
    // [개통 대기] = 이번 달, 상태가 [택배발송] 또는 [청약완료] 인 건만
    const pend = pendingRows.filter(
      (r) => matchSegment(r.product, segment) && isPendingActivationStatus(r.status),
    );
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    const urgent = pend.filter((r) => new Date(r.created_at).getTime() <= threeHoursAgo);
    return { cur: cur.length, prev: prev.length, tod: tod.length, yd: yd.length, pend: pend.length, urgent: urgent.length };
  }, [segment, currentRows, prevRows, todayRows, ydayRows, pendingRows]);

  const todaySeg = useMemo(() => countAll(todayRows), [todayRows]);
  const pendSeg = useMemo(
    () => countAll(pendingRows.filter((r) => isPendingActivationStatus(r.status))),
    [pendingRows],
  );
  const curSeg = useMemo(() => countAll(currentRows), [currentRows]);

  // 개통 대기 모바일 - 판매유형별 세부 합계 (신규/MNP/기변)
  const mobilePendingTypes = useMemo(() => {
    const out = { 신규: 0, MNP: 0, 기변: 0 };
    pendingRows
      .filter((r) => isPendingActivationStatus(r.status) && classifyProduct(r.product) === "모바일")
      .forEach((r) => {
        const t = (r.sale_type ?? "").trim();
        if (t === "신규") out["신규"]++;
        else if (t === "MNP" || t === "USIM MNP") out["MNP"]++;
        else if (t === "기변") out["기변"]++;
      });
    return out;
  }, [pendingRows]);

  const periodDelta = filtered.prev === 0 ? (filtered.cur > 0 ? 100 : 0) : ((filtered.cur - filtered.prev) / filtered.prev) * 100;
  const todayDelta = filtered.yd === 0 ? (filtered.tod > 0 ? 100 : 0) : ((filtered.tod - filtered.yd) / filtered.yd) * 100;
  const prevLabel = month === 0 ? "전년 대비" : "전월 대비";
  const hasPending = filtered.pend > 0;
  const activeLabel = PRODUCT_BADGES.find((b) => b.key === segment)?.label ?? "전체";

  return (
    <TooltipProvider delayDuration={150}>
    <section className="h-full flex flex-col gap-2">
      {/* 현재 필터 표시 — 탭 UI는 상단 '핵심 상품 성과 보드' 카드로 일원화 */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>현재 필터:</span>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-md font-semibold",
            segment === "all"
              ? "bg-muted/60 text-foreground"
              : "bg-primary/15 text-primary-glow border border-primary/30",
          )}
        >
          {activeLabel}
        </span>
        {segment !== "all" && (
          <span className="text-[10px] text-muted-foreground/80">· 상단 카드로 변경</span>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
        {/* 오늘의 개통 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="p-3 glass relative overflow-hidden cursor-default">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sun className="size-3.5 text-warning" />
                오늘의 개통
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-foreground tabular-nums leading-none">{filtered.tod}</span>
                <span className="text-sm text-muted-foreground">건</span>
              </div>
              <div className="mt-2">
                <Delta value={todayDelta} label="전일 대비" />
              </div>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-popover">
            <div className="text-[11px] font-semibold mb-1.5 text-muted-foreground">오늘 가입 유형별</div>
            <SegBreakdownTooltip counts={todaySeg} />
          </TooltipContent>
        </Tooltip>

        {/* 개통 대기 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card
              className={cn(
                "p-3 glass relative overflow-hidden cursor-pointer transition-all hover:shadow-glow",
                hasPending && "border-warning/40"
              )}
              onClick={() => navigate("/sales-ledger?status=" + encodeURIComponent("택배발송,청약완료"))}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Clock className={cn("size-3.5", hasPending ? "text-warning" : "text-muted-foreground")} />
                개통 대기
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className={cn("text-3xl font-bold tabular-nums leading-none", hasPending ? "text-warning" : "text-muted-foreground")}>
                  {filtered.pend}
                </span>
                <span className="text-sm text-muted-foreground">건</span>
              </div>
              <div className="mt-2">
                {filtered.urgent > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-destructive bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="size-2.5" />
                    긴급 {filtered.urgent}건
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">긴급 대기 없음</span>
                )}
              </div>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-popover">
            <div className="text-[11px] font-semibold mb-1.5 text-muted-foreground">대기 가입 유형별</div>
            <SegBreakdownTooltip counts={pendSeg} />
            {(mobilePendingTypes.신규 + mobilePendingTypes.MNP + mobilePendingTypes.기변) > 0 && (
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1 text-[10px]">
                <span className="font-semibold text-muted-foreground">모바일</span>
                <span className="px-1 py-0.5 rounded bg-primary/10 text-primary font-semibold">신규 {mobilePendingTypes.신규}</span>
                <span className="px-1 py-0.5 rounded bg-chart-1/10 text-chart-1 font-semibold">MNP {mobilePendingTypes.MNP}</span>
                <span className="px-1 py-0.5 rounded bg-chart-2/10 text-chart-2 font-semibold">기변 {mobilePendingTypes.기변}</span>
              </div>
            )}
          </TooltipContent>
        </Tooltip>

        {/* 누적 개통 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="p-3 glass relative overflow-hidden cursor-default">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="size-3.5 text-success" />
                누적 개통 ({label})
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-foreground tabular-nums leading-none">{filtered.cur}</span>
                <span className="text-sm text-muted-foreground">건</span>
              </div>
              <div className="mt-2">
                <Delta value={periodDelta} label={prevLabel} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                이전 동기간 {filtered.prev.toLocaleString()}건
              </div>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-popover">
            <div className="text-[11px] font-semibold mb-1.5 text-muted-foreground">누적 가입 유형별</div>
            <SegBreakdownTooltip counts={curSeg} />
          </TooltipContent>
        </Tooltip>
      </div>
    </section>
    </TooltipProvider>
  );
};
