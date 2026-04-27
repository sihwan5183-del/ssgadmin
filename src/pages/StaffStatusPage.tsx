import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { usePeriod } from "@/contexts/PeriodContext";
import { PeriodFilter } from "@/components/layout/PeriodFilter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Search, Users, TrendingUpIcon, Coins, Target, Sparkles, Info,
  Smartphone, Wifi, Gift, Calculator, CheckCircle2, Clock, XCircle, ChevronDown,
  PhoneCall, Package, Settings2, Plus, Trophy,
} from "lucide-react";
import { ArrowUp, ArrowDown, Minus, Activity, Wallet, AlertTriangle, Lightbulb } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, RadialBarChart, RadialBar, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, CartesianGrid, RadarChart, Radar, PolarGrid, PolarRadiusAxis, ReferenceLine } from "recharts";
import { formatKRWShort } from "@/data/financeData";
import { useIncentiveRates } from "@/hooks/useIncentiveRates";
import { calcTotalIncentive, forecastIncentive, calcIncentiveForSale } from "@/lib/incentiveEngine";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Profile {
  user_id: string;
  display_name: string;
  team: string | null;
}

interface SaleRow {
  id: string;
  created_by: string;
  customer_name: string | null;
  device_model: string | null;
  product: string | null;
  channel: string | null;
  sale_type: string | null;
  open_date: string | null;
  manager: string | null;
  status: string | null;
  approval_status: string;
  pending_resolved: boolean;
  pending_items: any;
  distributor_amount: number | null;
  net_fee: number | null;
  vas1: string | null;
  vas2: string | null;
}

interface InquiryRow {
  id: string;
  manager: string | null;
  status: string;
  converted_sale_id: string | null;
  inquiry_date: string;
  channel: string;
}

interface GoalRow {
  id: string;
  user_id: string;
  product: string;
  year_month: string;
  goal_count: number;
  sale_type: string;
  goal_type: string;   // 'count' | 'rate'
  goal_value: number;
}

interface InquiryCountRow {
  user_id: string;
  year_month: string;
  inflow_count: number;
}

const DONUT_COLORS = [
  "hsl(45 95% 60%)", "hsl(155 75% 55%)", "hsl(195 90% 60%)",
  "hsl(280 80% 70%)", "hsl(15 85% 65%)", "hsl(330 80% 65%)",
];

// Standard products tracked for goals
const GOAL_PRODUCTS = ["모바일", "인터넷", "TV프리", "스마트홈", "2ND"];

// Mobile sale-type buckets for granular goals
const MOBILE_SALE_TYPES = ["신규", "번이", "기변"] as const;
function mobileSaleTypeBucket(t: string | null): "신규" | "번이" | "기변" | null {
  if (!t) return null;
  const s = t.trim();
  if (/신규/.test(s)) return "신규";
  if (/MNP|번이|이동/i.test(s)) return "번이";
  if (/기변|재약정|업셀/i.test(s)) return "기변";
  return null;
}

// Rate-based goals (e.g., attach rates relative to mobile)
const RATE_GOALS = [
  { key: "vas_rate", label: "부가서비스 유치율", unit: "%" },
  { key: "internet_rate", label: "인터넷 유치율", unit: "%" },
  { key: "tvfree_rate", label: "TV프리 유치율", unit: "%" },
] as const;

// Mix chart products (detailed breakdown)
const MIX_PRODUCTS = ["모바일", "인터넷", "TV프리", "스마트홈", "부가서비스"];

// Buckets for product breakdown
function productBucket(p: string | null): string {
  const s = (p ?? "").toLowerCase();
  if (!s) return "기타";
  if (/2nd|세컨|워치|태블릿|tablet|watch/i.test(p ?? "")) return "2ND";
  if (/스마트홈|iot|홈/i.test(p ?? "")) return "스마트홈";
  // TV프리만 별도 집계 (일반 TV는 기타로 분류)
  if (/tv\s*프리|프리tv|tv프리/i.test(p ?? "") || (p ?? "").includes("TV프리")) return "TV프리";
  if (/인터넷|기가|wifi/i.test(p ?? "")) return "인터넷";
  if (/모바일|mobile|usim|mnp|재약정|업셀/i.test(p ?? "")) return "모바일";
  return "기타";
}

function isWiredOrSolution(p: string | null) {
  const b = productBucket(p);
  return b === "인터넷" || b === "TV프리" || b === "스마트홈" || b === "2ND";
}

function categorize(sale: SaleRow): "모바일" | "결합/인터넷·TV" | "기타 오퍼" {
  const p = (sale.product ?? "").toLowerCase();
  if (/(인터넷|tv|결합|iot|기가)/i.test(sale.product ?? "")) return "결합/인터넷·TV";
  if (sale.device_model || /모바일|mobile/.test(p)) return "모바일";
  return "기타 오퍼";
}

const CATEGORY_ICON: Record<string, typeof Smartphone> = {
  모바일: Smartphone,
  "결합/인터넷·TV": Wifi,
  "기타 오퍼": Gift,
};

const STATUS_BADGE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  확정: { label: "승인", className: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", icon: CheckCircle2 },
  승인대기: { label: "대기", className: "border-amber-400 text-amber-700 bg-amber-50", icon: Clock },
  반려: { label: "반려", className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
  수정요청: { label: "수정요청", className: "border-orange-400 text-orange-700 bg-orange-50", icon: XCircle },
  환수: { label: "환수", className: "border-orange-400 text-orange-700 bg-orange-50", icon: XCircle },
  취소: { label: "취소", className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
};

// Match a sale to a profile: manager-name match preferred, fallback to created_by
function buildOwnerResolver(profiles: Profile[]) {
  const byName = new Map<string, string>();
  profiles.forEach((p) => byName.set(p.display_name.trim().toLowerCase(), p.user_id));
  return (sale: { manager: string | null; created_by: string }) => {
    const m = (sale.manager ?? "").trim().toLowerCase();
    if (m && byName.has(m)) return byName.get(m)!;
    return sale.created_by;
  };
}

function buildInquiryOwnerResolver(profiles: Profile[]) {
  const byName = new Map<string, string>();
  profiles.forEach((p) => byName.set(p.display_name.trim().toLowerCase(), p.user_id));
  return (row: { manager: string | null }) => {
    const m = (row.manager ?? "").trim().toLowerCase();
    if (m && byName.has(m)) return byName.get(m)!;
    return null;
  };
}

// "성공" = 취소/반려가 아닌 모든 것
function isSuccess(s: SaleRow) {
  const st = s.approval_status;
  return st !== "취소" && st !== "반려";
}

export default function StaffStatusPage() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { startDate, endDate, label } = usePeriod();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState<string>("__all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allSales, setAllSales] = useState<SaleRow[]>([]);
  const [allInquiries, setAllInquiries] = useState<InquiryRow[]>([]);
  const [prevSales, setPrevSales] = useState<SaleRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { rates: incentiveRates } = useIncentiveRates();
  const [showDetail, setShowDetail] = useState(false);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  // Simulator
  const [simSaleType, setSimSaleType] = useState<string>("__any");
  const [simProduct, setSimProduct] = useState<string>("__any");
  const [simModel, setSimModel] = useState<string>("__any");

  const canViewAll = isAdmin || isManager;
  const yearMonth = useMemo(() => (endDate || new Date().toISOString().slice(0, 10)).slice(0, 7), [endDate]);

  // Previous-period range (same length as current, immediately before startDate)
  const prevRange = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const lenMs = e.getTime() - s.getTime();
    const prevEnd = new Date(s.getTime() - 24 * 3600 * 1000);
    const prevStart = new Date(prevEnd.getTime() - lenMs);
    return { start: prevStart.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) };
  }, [startDate, endDate]);

  // Load profiles
  useEffect(() => {
    if (roleLoading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, team")
        .eq("status", "active")
        .order("display_name");
      const list = (data ?? []) as Profile[];
      const visible = canViewAll ? list : list.filter((p) => p.user_id === user.id);
      setProfiles(visible);
      setSelectedId((prev) => prev ?? (canViewAll ? null : user.id));
    })();
  }, [user, canViewAll, roleLoading]);

  const teams = useMemo(() => {
    const s = new Set<string>();
    profiles.forEach((p) => p.team && s.add(p.team));
    return Array.from(s);
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (team !== "__all" && (p.team ?? "") !== team) return false;
      if (search && !p.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [profiles, search, team]);

  const selected = profiles.find((p) => p.user_id === selectedId) ?? null;

  // Load ALL sales + inquiries + goals once per period (single query — efficient)
  const reloadData = useCallback(async () => {
    if (roleLoading || profiles.length === 0) return;
    setLoading(true);
    const ids = profiles.map((p) => p.user_id);
    const names = profiles.map((p) => p.display_name);
    // Sales: rows where created_by in ids OR manager in names — fetch via two queries to avoid OR complexity
    const [{ data: byCreator }, { data: byManager }, { data: inq }, { data: goalRows }, { data: prevByCreator }, { data: prevByManager }] = await Promise.all([
      supabase.from("sales")
        .select("id, created_by, customer_name, device_model, product, channel, sale_type, open_date, manager, status, approval_status, pending_resolved, pending_items, distributor_amount, net_fee, vas1, vas2")
        .in("created_by", ids)
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .order("open_date", { ascending: false })
        .limit(5000),
      supabase.from("sales")
        .select("id, created_by, customer_name, device_model, product, channel, sale_type, open_date, manager, status, approval_status, pending_resolved, pending_items, distributor_amount, net_fee, vas1, vas2")
        .in("manager", names)
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .order("open_date", { ascending: false })
        .limit(5000),
      supabase.from("inquiries")
        .select("id, manager, status, converted_sale_id, inquiry_date, channel")
        .in("manager", names)
        .gte("inquiry_date", startDate)
        .lte("inquiry_date", endDate)
        .limit(5000),
      supabase.from("staff_product_goals")
        .select("id, user_id, product, year_month, goal_count")
        .in("user_id", ids)
        .eq("year_month", yearMonth),
      supabase.from("sales")
        .select("id, created_by, customer_name, device_model, product, channel, sale_type, open_date, manager, status, approval_status, pending_resolved, pending_items, distributor_amount, net_fee, vas1, vas2")
        .in("created_by", ids)
        .gte("open_date", prevRange.start)
        .lte("open_date", prevRange.end)
        .limit(5000),
      supabase.from("sales")
        .select("id, created_by, customer_name, device_model, product, channel, sale_type, open_date, manager, status, approval_status, pending_resolved, pending_items, distributor_amount, net_fee, vas1, vas2")
        .in("manager", names)
        .gte("open_date", prevRange.start)
        .lte("open_date", prevRange.end)
        .limit(5000),
    ]);
    // Merge & dedupe
    const map = new Map<string, SaleRow>();
    [...(byCreator ?? []), ...(byManager ?? [])].forEach((r: any) => map.set(r.id, r as SaleRow));
    setAllSales(Array.from(map.values()));
    const prevMap = new Map<string, SaleRow>();
    [...(prevByCreator ?? []), ...(prevByManager ?? [])].forEach((r: any) => prevMap.set(r.id, r as SaleRow));
    setPrevSales(Array.from(prevMap.values()));
    setAllInquiries((inq ?? []) as InquiryRow[]);
    setGoals((goalRows ?? []) as GoalRow[]);
    setLoading(false);
  }, [profiles, startDate, endDate, yearMonth, roleLoading, prevRange.start, prevRange.end]);

  useEffect(() => { reloadData(); }, [reloadData]);

  const ownerOf = useMemo(() => buildOwnerResolver(profiles), [profiles]);
  const inquiryOwnerOf = useMemo(() => buildInquiryOwnerResolver(profiles), [profiles]);

  // Group sales by owner
  const salesByOwner = useMemo(() => {
    const m = new Map<string, SaleRow[]>();
    allSales.forEach((s) => {
      const id = ownerOf(s);
      const arr = m.get(id) ?? [];
      arr.push(s);
      m.set(id, arr);
    });
    return m;
  }, [allSales, ownerOf]);

  const inquiriesByOwner = useMemo(() => {
    const m = new Map<string, InquiryRow[]>();
    allInquiries.forEach((q) => {
      const id = inquiryOwnerOf(q);
      if (!id) return;
      const arr = m.get(id) ?? [];
      arr.push(q);
      m.set(id, arr);
    });
    return m;
  }, [allInquiries, inquiryOwnerOf]);

  const leaderboard = useMemo(() => {
    const rows = filteredProfiles.map((p) => {
      const list = salesByOwner.get(p.user_id) ?? [];
      const successList = list.filter(isSuccess);
      const { total } = calcTotalIncentive(successList as any, incentiveRates);
      const distributorTotal = successList.reduce((sum, s) => sum + Number(s.distributor_amount ?? 0), 0);
      const netFeeTotal = successList.reduce((sum, s) => sum + Number(s.net_fee ?? 0), 0);
      const pendingCount = list.filter((s) => s.pending_resolved === false).length;
      return {
        profile: p,
        salesCount: successList.length,
        totalCount: list.length,
        incentive: total,
        distributorTotal,
        netFeeTotal,
        pendingCount,
      };
    });
    rows.sort((a, b) => b.incentive - a.incentive || b.salesCount - a.salesCount);
    return rows;
  }, [salesByOwner, filteredProfiles, incentiveRates]);

  // Selected staff data (filtered)
  const sales = useMemo(() => {
    if (!selected) return [];
    return salesByOwner.get(selected.user_id) ?? [];
  }, [salesByOwner, selected]);

  const inquiries = useMemo(() => {
    if (!selected) return [];
    return inquiriesByOwner.get(selected.user_id) ?? [];
  }, [inquiriesByOwner, selected]);

  // === Incentive computation (only success sales contribute) ===
  const incentive = useMemo(() => {
    const successSales = sales.filter(isSuccess);
    const { total, breakdowns } = calcTotalIncentive(successSales as any, incentiveRates);
    const fc = forecastIncentive(total, startDate, endDate);
    const goal = Math.max(fc.projected + 100000, Math.ceil((fc.projected || 100000) / 100000) * 100000 + 100000);
    const goalPct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
    const gapToGoal = Math.max(0, goal - total);
    const earnedSales = breakdowns.filter((b) => b.amount > 0).length;
    const avgPerSale = earnedSales > 0 ? Math.round(total / earnedSales) : 0;
    const salesNeeded = avgPerSale > 0 ? Math.ceil(gapToGoal / avgPerSale) : 0;

    const items = sales.map((s) => {
      const b = breakdowns.find((x) => x.saleId === s.id);
      return { sale: s, amount: b?.amount ?? 0, matched: b?.matched ?? [] };
    });

    const catMap = new Map<string, number>();
    items.forEach((it) => {
      if (it.amount <= 0) return;
      const c = categorize(it.sale);
      catMap.set(c, (catMap.get(c) ?? 0) + it.amount);
    });
    const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

    return { total, fc, goal, goalPct, gapToGoal, salesNeeded, items, categoryData };
  }, [sales, incentiveRates, startDate, endDate]);

  // === Detailed analytics (only success sales) ===
  const analytics = useMemo(() => {
    const successSales = sales.filter(isSuccess);

    // Channel: 인입 = 문의 / 성공 = (전환된 문의) + (해당 채널의 직접 성공 실적)
    // 문의에 없는 채널이라도 sales에 있으면 채널로 노출 (실무: 워크인/오프라인 등)
    const chanMap = new Map<string, { inflow: number; success: number }>();
    inquiries.forEach((q) => {
      const c = (q.channel || "기타").trim() || "기타";
      const r = chanMap.get(c) ?? { inflow: 0, success: 0 };
      r.inflow += 1;
      if (q.converted_sale_id) r.success += 1;
      chanMap.set(c, r);
    });
    // 전환 문의가 가리키는 sale ID 셋 (중복 카운트 방지)
    const convertedSaleIds = new Set(
      inquiries.map((q) => q.converted_sale_id).filter(Boolean) as string[]
    );
    successSales.forEach((s) => {
      if (convertedSaleIds.has(s.id)) return; // already counted via inquiry
      const c = (s.channel || "기타").trim() || "기타";
      const r = chanMap.get(c) ?? { inflow: 0, success: 0 };
      // 문의 없이 직접 들어온 실적도 인입(=직접유입) + 성공으로 카운트
      r.inflow += 1;
      r.success += 1;
      chanMap.set(c, r);
    });
    const channelStats = Array.from(chanMap.entries())
      .map(([channel, v]) => ({ channel, ...v, rate: v.inflow > 0 ? Math.round((v.success / v.inflow) * 100) : 0 }))
      .sort((a, b) => b.inflow - a.inflow);

    const totalInflow = channelStats.reduce((a, c) => a + c.inflow, 0);
    const totalConverted = channelStats.reduce((a, c) => a + c.success, 0);
    const overallRate = totalInflow > 0 ? Math.round((totalConverted / totalInflow) * 100) : 0;

    // Product breakdown (TV프리 분리)
    const prodMap = new Map<string, number>();
    successSales.forEach((s) => {
      const b = productBucket(s.product);
      prodMap.set(b, (prodMap.get(b) ?? 0) + 1);
    });
    const productStats = GOAL_PRODUCTS.map((name) => ({ name, count: prodMap.get(name) ?? 0 }));

    // VAS counts: vas1 + vas2 non-empty
    let vasCount = 0;
    successSales.forEach((s) => {
      if (s.vas1 && s.vas1.trim() && s.vas1 !== "없음") vasCount += 1;
      if (s.vas2 && s.vas2.trim() && s.vas2 !== "없음") vasCount += 1;
    });

    // 부가서비스 유치율 = (모바일 개통 중 VAS 1개 이상 가입) / 모바일 개통수
    const mobileSales = successSales.filter((s) => productBucket(s.product) === "모바일");
    const mobileWithVas = mobileSales.filter((s) =>
      (s.vas1 && s.vas1.trim() && s.vas1 !== "없음") || (s.vas2 && s.vas2.trim() && s.vas2 !== "없음")
    );
    const mobileVasRate = mobileSales.length > 0
      ? Math.round((mobileWithVas.length / mobileSales.length) * 100) : 0;

    // 2nd device VAS attach rate: among 2ND-bucket sales, how many have any vas
    const second = successSales.filter((s) => productBucket(s.product) === "2ND");
    const secondWithVas = second.filter((s) =>
      (s.vas1 && s.vas1.trim() && s.vas1 !== "없음") || (s.vas2 && s.vas2.trim() && s.vas2 !== "없음")
    );
    const secondVasRate = second.length > 0 ? Math.round((secondWithVas.length / second.length) * 100) : 0;

    // 5종 비중 분석 (모바일 / 인터넷 / TV프리 / 스마트홈 / 부가서비스)
    const mixData = [
      { name: "모바일", value: mobileSales.length, key: "모바일" },
      { name: "인터넷", value: prodMap.get("인터넷") ?? 0, key: "인터넷" },
      { name: "TV프리", value: prodMap.get("TV프리") ?? 0, key: "TV프리" },
      { name: "스마트홈", value: prodMap.get("스마트홈") ?? 0, key: "스마트홈" },
      { name: "부가서비스", value: vasCount, key: "부가서비스" },
    ].filter((d) => d.value > 0);
    const mobileCount = mobileSales.length;
    const wiredCount = successSales.filter((s) => isWiredOrSolution(s.product)).length;

    return {
      channelStats, totalInflow, totalConverted, overallRate,
      productStats, vasCount, mobileVasRate, mobileCount: mobileSales.length,
      secondCount: second.length, secondVasRate,
      mixData, wiredCount,
    };
  }, [sales, inquiries]);

  // === Previous-period sales for selected (for trend deltas) ===
  const prevSalesForSelected = useMemo(() => {
    if (!selected) return [] as SaleRow[];
    const m = new Map<string, SaleRow[]>();
    prevSales.forEach((s) => {
      const id = ownerOf(s);
      const arr = m.get(id) ?? [];
      arr.push(s);
      m.set(id, arr);
    });
    return m.get(selected.user_id) ?? [];
  }, [prevSales, selected, ownerOf]);

  // === Productivity analytics: attach rates, ARPU, unsettled, bundle, deltas, summary ===
  const productivity = useMemo(() => {
    const success = sales.filter(isSuccess);
    const counts = { 모바일: 0, 인터넷: 0, TV프리: 0, 스마트홈: 0, "2ND": 0 } as Record<string, number>;
    success.forEach((s) => {
      const b = productBucket(s.product);
      if (b in counts) counts[b] += 1;
    });
    const mobile = counts["모바일"];
    let vasCount = 0;
    success.forEach((s) => {
      if (s.vas1 && s.vas1.trim() && s.vas1 !== "없음") vasCount += 1;
      if (s.vas2 && s.vas2.trim() && s.vas2 !== "없음") vasCount += 1;
    });
    const rate = (n: number) => (mobile > 0 ? Math.round((n / mobile) * 100) : 0);
    const attach = {
      internet: rate(counts["인터넷"]),
      tvfree: rate(counts["TV프리"]),
      vas: rate(vasCount),
      smarthome: rate(counts["스마트홈"]),
      second: rate(counts["2ND"]),
    };

    // ARPU: total revenue (distributor + net_fee) / total open count
    const totalRevenue = success.reduce(
      (a, s) => a + Number(s.distributor_amount ?? 0) + Number(s.net_fee ?? 0),
      0
    );
    const arpu = success.length > 0 ? Math.round(totalRevenue / success.length) : 0;

    // 미반납/미검수 잔여율 = pending_resolved=false / 전체
    const unresolved = sales.filter((s) => s.pending_resolved === false).length;
    const unresolvedRate = sales.length > 0 ? Math.round((unresolved / sales.length) * 100) : 0;

    // === Previous-month attach for delta ===
    const prevSuccess = prevSalesForSelected.filter(isSuccess);
    const prevCounts = { 모바일: 0, 인터넷: 0, TV프리: 0, 스마트홈: 0, "2ND": 0 } as Record<string, number>;
    prevSuccess.forEach((s) => {
      const b = productBucket(s.product);
      if (b in prevCounts) prevCounts[b] += 1;
    });
    let prevVas = 0;
    prevSuccess.forEach((s) => {
      if (s.vas1 && s.vas1.trim() && s.vas1 !== "없음") prevVas += 1;
      if (s.vas2 && s.vas2.trim() && s.vas2 !== "없음") prevVas += 1;
    });
    const prevMobile = prevCounts["모바일"];
    const prevRate = (n: number) => (prevMobile > 0 ? Math.round((n / prevMobile) * 100) : 0);
    const prevAttach = {
      internet: prevRate(prevCounts["인터넷"]),
      tvfree: prevRate(prevCounts["TV프리"]),
      vas: prevRate(prevVas),
      smarthome: prevRate(prevCounts["스마트홈"]),
      second: prevRate(prevCounts["2ND"]),
    };
    const delta = {
      internet: attach.internet - prevAttach.internet,
      tvfree: attach.tvfree - prevAttach.tvfree,
      vas: attach.vas - prevAttach.vas,
      smarthome: attach.smarthome - prevAttach.smarthome,
      second: attach.second - prevAttach.second,
    };

    // Bar/Radar data
    const attachBars = [
      { name: "인터넷", value: attach.internet, prev: prevAttach.internet, delta: delta.internet, fill: "hsl(195 90% 60%)" },
      { name: "TV프리", value: attach.tvfree, prev: prevAttach.tvfree, delta: delta.tvfree, fill: "hsl(280 80% 70%)" },
      { name: "부가서비스", value: attach.vas, prev: prevAttach.vas, delta: delta.vas, fill: "hsl(45 95% 60%)" },
      { name: "스마트홈", value: attach.smarthome, prev: prevAttach.smarthome, delta: delta.smarthome, fill: "hsl(155 75% 55%)" },
      { name: "2nd 디바이스", value: attach.second, prev: prevAttach.second, delta: delta.second, fill: "hsl(15 85% 65%)" },
    ];
    const radarData = attachBars.map((b) => ({
      metric: b.name,
      value: Math.min(b.value, 150),
      fullMark: 100,
    }));

    // === 영업 성향 진단 (모바일 집중형 vs 결합 만능형) ===
    const totalSales = success.length || 1;
    const mobileShare = (mobile / totalSales) * 100;
    const wiredShare = ((counts["인터넷"] + counts["TV프리"] + counts["스마트홈"]) / totalSales) * 100;
    let salesType = "균형형";
    if (mobileShare > 70) salesType = "모바일 집중형";
    else if (wiredShare > 35 && attach.internet >= 30) salesType = "결합 만능형";
    else if (attach.vas >= 80) salesType = "부가서비스 강화형";

    // === 강점/약점 한 줄 요약 ===
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (attach.internet >= 30) strengths.push("인터넷 유치율 우수");
    else if (attach.internet < 10 && mobile > 0) weaknesses.push("인터넷 유치율 낮음");
    if (attach.tvfree >= 20) strengths.push("TV프리 결합 우수");
    else if (attach.tvfree < 5 && mobile > 0) weaknesses.push("TV프리 결합 부족");
    if (attach.vas >= 80) strengths.push("부가서비스 우수");
    else if (attach.vas < 50 && mobile > 0) weaknesses.push("부가서비스 유치율 평균 대비 낮음");
    if (attach.second >= 15) strengths.push("2nd 디바이스 번들 우수");
    if (unresolvedRate >= 30) weaknesses.push("미정산/미검수 비율 높음");
    let summary = "";
    if (mobile === 0 && success.length === 0) summary = "분석할 실적이 부족합니다.";
    else if (strengths.length && weaknesses.length) summary = `${strengths[0]}, 그러나 ${weaknesses[0]}.`;
    else if (strengths.length) summary = `${strengths.join(" · ")}.`;
    else if (weaknesses.length) summary = `${weaknesses.join(" · ")} — 개선 필요.`;
    else summary = "전반적으로 평이한 실적 분포입니다.";

    return {
      attach, attachBars, radarData, arpu, totalRevenue,
      unresolved, unresolvedRate, salesType, summary, strengths, weaknesses,
      mobileShare: Math.round(mobileShare), wiredShare: Math.round(wiredShare),
    };
  }, [sales, prevSalesForSelected]);

  // Goals for selected
  const selectedGoals = useMemo(() => {
    if (!selected) return [] as { product: string; goal: number; achieved: number; pct: number }[];
    const map = new Map<string, number>();
    goals.filter((g) => g.user_id === selected.user_id).forEach((g) => map.set(g.product, g.goal_count));
    return GOAL_PRODUCTS.map((p) => {
      const goal = map.get(p) ?? 0;
      const achieved = analytics.productStats.find((x) => x.name === p)?.count ?? 0;
      const pct = goal > 0 ? Math.min(100, Math.round((achieved / goal) * 100)) : 0;
      return { product: p, goal, achieved, pct };
    });
  }, [selected, goals, analytics.productStats]);

  // Simulator
  const distinctSaleTypes = useMemo(() => Array.from(new Set(incentiveRates.map((r) => r.match_sale_type).filter(Boolean) as string[])), [incentiveRates]);
  const distinctProducts = useMemo(() => Array.from(new Set(incentiveRates.map((r) => r.match_product).filter(Boolean) as string[])), [incentiveRates]);
  const distinctModels = useMemo(() => Array.from(new Set(incentiveRates.map((r) => r.match_model).filter(Boolean) as string[])), [incentiveRates]);

  const simResult = useMemo(() => {
    const hypo = {
      id: "__sim__",
      open_date: new Date().toISOString().slice(0, 10),
      sale_type: simSaleType === "__any" ? null : simSaleType,
      product: simProduct === "__any" ? null : simProduct,
      device_model: simModel === "__any" ? null : simModel,
    };
    return calcIncentiveForSale(hypo as any, incentiveRates);
  }, [simSaleType, simProduct, simModel, incentiveRates]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="size-6 text-primary-glow" /> 직원별 현황
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {canViewAll ? "직원을 선택해 개인 성과·인센티브 현황을 확인하세요" : "내 성과 및 인센티브 현황"} · {label}
            </p>
          </div>
          <PeriodFilter />
        </div>

        {/* Search & filter */}
        <Card className="p-4 glass">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="직원 이름 검색"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!canViewAll}
              />
            </div>
            {canViewAll && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="팀" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">전체 팀</SelectItem>
                  {teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </Card>

        {/* Leaderboard */}
        {canViewAll && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-primary-glow" />
                전 직원 실적 한눈에
                <Badge variant="outline" className="border-border/50 text-muted-foreground ml-1">
                  {leaderboard.length}명
                </Badge>
              </h3>
              {loading && <span className="text-xs text-muted-foreground">불러오는 중…</span>}
            </div>
            {leaderboard.length === 0 ? (
              <Card className="glass p-8 text-center text-muted-foreground text-sm">
                해당 기간에 등록된 실적이 없습니다
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {leaderboard.map((row, idx) => {
                  const isSelected = selectedId === row.profile.user_id;
                  const rank = idx + 1;
                  return (
                    <button
                      key={row.profile.user_id}
                      onClick={() => setSelectedId(row.profile.user_id)}
                      className={`group text-left p-4 rounded-xl border glass transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
                        isSelected ? "border-primary/60 bg-primary/[0.06]" : "border-border/40 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`size-7 rounded-lg grid place-items-center text-[11px] font-bold shrink-0 ${
                            rank === 1 ? "bg-amber-100 text-amber-700" :
                            rank === 2 ? "bg-slate-400/20 text-slate-200" :
                            rank === 3 ? "bg-orange-100 text-orange-700" :
                            "bg-card/60 text-muted-foreground"
                          }`}>#{rank}</div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{row.profile.display_name}</div>
                            {row.profile.team && (
                              <div className="text-[10px] text-muted-foreground truncate">{row.profile.team}</div>
                            )}
                          </div>
                        </div>
                        {row.pendingCount > 0 && (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px] shrink-0">
                            미처리 {row.pendingCount}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] text-muted-foreground">성공 / 전체</div>
                          <div className="text-base font-bold tabular-nums">{row.salesCount}/{row.totalCount}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">인센티브</div>
                          <div className="text-base font-bold text-amber-700 tabular-nums">{formatKRWShort(row.incentive)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">유통망 지원금</div>
                          <div className="text-sm font-semibold tabular-nums text-foreground/90">{formatKRWShort(row.distributorTotal)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">회수 마진</div>
                          <div className="text-sm font-semibold text-emerald-300 tabular-nums">{formatKRWShort(row.netFeeTotal)}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!selected ? (
          <Card className="p-12 text-center glass">
            <Users className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">위 카드에서 직원을 선택하면 상세 현황이 표시됩니다</p>
          </Card>
        ) : (
          <>
            {/* Section header for selected staff */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-border/30">
              <div>
                <div className="text-xs text-muted-foreground">상세 현황</div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {selected.display_name}
                  {selected.team && <Badge variant="outline" className="text-xs">{selected.team}</Badge>}
                </h2>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(true)} className="gap-2">
                  <Settings2 className="size-4" /> 월간 목표 설정 ({yearMonth})
                </Button>
              )}
            </div>

            {/* [Hero] 3 cards */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="p-7 glass relative overflow-hidden border-amber-300 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.04] to-transparent">
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-amber-50 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-700/80">
                      <Coins className="size-4 text-amber-400" /> 이번 달 총 인센티브
                    </div>
                  </div>
                  <div className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-tight text-amber-700 tabular-nums leading-none">
                    {formatKRWShort(incentive.total)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {incentive.items.filter((i) => i.amount > 0).length}건의 실적에서 발생
                  </p>
                </div>
              </Card>

              <Card className="p-7 glass relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-transparent">
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-200/80">
                    <TrendingUpIcon className="size-4 text-emerald-400" /> 마감 예상 인센티브
                  </div>
                  <div className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-tight text-emerald-300 tabular-nums leading-none">
                    {formatKRWShort(incentive.fc.projected)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {incentive.fc.elapsedDays}/{incentive.fc.totalDays}일 경과 · 잔여 {incentive.fc.remainingDays}일
                  </p>
                </div>
              </Card>

              <Card className="p-5 glass relative overflow-hidden border-amber-500/20">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Target className="size-4 text-amber-400" /> 인센티브 목표 달성률
                </div>
                <div className="relative h-44 mt-1">
                  <ResponsiveContainer>
                    <RadialBarChart innerRadius="78%" outerRadius="100%"
                      data={[{ name: "달성률", value: incentive.goalPct, fill: "hsl(45 95% 60%)" }]}
                      startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "hsl(var(--muted) / 0.25)" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-4xl font-extrabold text-amber-700 tabular-nums leading-none">{incentive.goalPct}%</div>
                    <div className="text-[10px] text-muted-foreground mt-1">목표 {formatKRWShort(incentive.goal)}</div>
                  </div>
                </div>
              </Card>
            </section>

            {/* === 채널별 인입 대비 성공률 + 가입상품별 실적 === */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card className="p-6 glass">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <PhoneCall className="size-4 text-primary-glow" /> 채널별 인입 대비 성공률
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    전체 {analytics.totalInflow}건 / 성공 {analytics.totalConverted}건 ·
                    <span className="text-emerald-300 font-semibold ml-1">{analytics.overallRate}%</span>
                  </div>
                </div>
                {analytics.channelStats.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    이 기간 등록된 인입(문의) 데이터가 없습니다
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analytics.channelStats.map((c) => (
                      <div key={c.channel} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{c.channel}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {c.success}/{c.inflow} ·
                            <span className="text-emerald-300 font-semibold ml-1">{c.rate}%</span>
                          </span>
                        </div>
                        <Progress value={c.rate} className="h-2" />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-6 glass">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="size-4 text-primary-glow" /> 가입상품별 실적 & 목표 달성
                  </h3>
                  <Badge variant="outline" className="text-[10px]">{yearMonth}</Badge>
                </div>
                <div className="space-y-3">
                  {selectedGoals.map((g) => (
                    <div key={g.product} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{g.product}</span>
                        <span className="text-muted-foreground tabular-nums">
                          <span className="text-amber-700 font-semibold">{g.achieved}</span>
                          {g.goal > 0 ? <> / 목표 {g.goal}대 · <span className="text-emerald-300 font-semibold">{g.pct}%</span></> : <> · 목표 미설정</>}
                        </span>
                      </div>
                      <Progress value={g.goal > 0 ? g.pct : 0} className="h-2.5" />
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            {/* === 부가서비스 유치율 / 2nd 디바이스 / 5종 판매비중 === */}
            <section className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <Card className="p-6 glass">
                <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Gift className="size-4 text-primary-glow" /> 부가서비스 유치율
                </div>
                <div className="text-4xl font-extrabold text-amber-700 tabular-nums">
                  {analytics.mobileVasRate}<span className="text-base font-normal text-muted-foreground ml-1">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  모바일 {analytics.mobileCount}건 중 부가 포함 · 총 {analytics.vasCount}건
                </p>
              </Card>

              <Card className="p-6 glass">
                <div className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Smartphone className="size-4 text-primary-glow" /> 2nd 디바이스 판매
                </div>
                <div className="text-4xl font-extrabold text-emerald-300 tabular-nums">
                  {analytics.secondCount}<span className="text-base font-normal text-muted-foreground ml-1">대</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  워치·태블릿 등 · 부가 부착률 {analytics.secondVasRate}%
                </p>
              </Card>

              <Card className="p-6 glass lg:col-span-2">
                <div className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Wifi className="size-4 text-primary-glow" /> 가입상품 5종 판매비중
                  <span className="text-[10px] text-muted-foreground ml-1">· 항목 클릭 시 실적 리스트로 이동</span>
                </div>
                {analytics.mixData.length === 0 ? (
                  <div className="h-32 grid place-items-center text-xs text-muted-foreground">데이터 없음</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="h-40">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={analytics.mixData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={3} stroke="none">
                            {analytics.mixData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                          </Pie>
                          <RTooltip contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12 }} formatter={(v: any, n: any) => [`${v}건`, n]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5">
                      {analytics.mixData.map((d, i) => {
                        const total = analytics.mixData.reduce((a, x) => a + x.value, 0);
                        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                        const handleClick = () => {
                          const params = new URLSearchParams();
                          if (d.key === "부가서비스") {
                            params.set("vas", "1");
                          } else {
                            params.set("product", d.key);
                          }
                          if (selected) params.set("manager", selected.display_name);
                          window.location.href = `/sales-ledger?${params.toString()}`;
                        };
                        return (
                          <button
                            key={d.name}
                            onClick={handleClick}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors text-left"
                          >
                            <span className="size-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                            <span className="text-xs font-medium flex-1 truncate">{d.name}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">{d.value}건</span>
                            <span className="text-[10px] tabular-nums text-emerald-300 font-semibold w-9 text-right">{pct}%</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            </section>

            {/* === 종합 영업 효율 분석 (Attach Rate / ARPU / Trend / Goals / Radar) === */}
            <section className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="size-4 text-primary-glow" /> 종합 영업 효율 분석
                  <Badge variant="outline" className="text-[10px] ml-1">{productivity.salesType}</Badge>
                </h3>
                <div className="text-[11px] text-muted-foreground">
                  기준: 모바일 {analytics.mobileCount}건 · 전월 비교 ({prevRange.start} ~ {prevRange.end})
                </div>
              </div>

              {/* Strength / Weakness 한줄 요약 */}
              <Card className="p-4 glass border-primary/20 bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-primary/15 grid place-items-center text-primary-glow shrink-0">
                    <Lightbulb className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground">AI 한줄 요약</div>
                    <div className="text-sm font-semibold mt-0.5">{productivity.summary}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {productivity.strengths.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px] border-emerald-400/40 text-emerald-300 bg-emerald-500/10">
                          + {s}
                        </Badge>
                      ))}
                      {productivity.weaknesses.map((w) => (
                        <Badge key={w} variant="outline" className="text-[10px] border-amber-400/40 text-amber-700 bg-amber-50">
                          ! {w}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* 핵심 지표 4종 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4 glass">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="size-3.5 text-amber-500" /> 건당 평균 수익 (ARPU)
                  </div>
                  <div className="text-2xl font-extrabold tabular-nums text-amber-700 mt-1">
                    {formatKRWShort(productivity.arpu)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    총수익 {formatKRWShort(productivity.totalRevenue)}
                  </div>
                </Card>
                <Card className="p-4 glass">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-orange-500" /> 미반납·미검수 잔여율
                  </div>
                  <div className={`text-2xl font-extrabold tabular-nums mt-1 ${productivity.unresolvedRate >= 30 ? "text-destructive" : "text-foreground"}`}>
                    {productivity.unresolvedRate}<span className="text-sm font-normal text-muted-foreground ml-0.5">%</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    미정산 {productivity.unresolved}건 / 전체 {sales.length}건
                  </div>
                </Card>
                <Card className="p-4 glass">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-emerald-500" /> 2nd 디바이스 번들율
                  </div>
                  <div className="text-2xl font-extrabold tabular-nums text-emerald-300 mt-1">
                    {productivity.attach.second}<span className="text-sm font-normal text-muted-foreground ml-0.5">%</span>
                  </div>
                  <DeltaPill delta={productivity.attachBars[4].delta} />
                </Card>
                <Card className="p-4 glass">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Activity className="size-3.5 text-primary-glow" /> 영업 성향
                  </div>
                  <div className="text-lg font-bold mt-1.5">{productivity.salesType}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    모바일 {productivity.mobileShare}% · 결합 {productivity.wiredShare}%
                  </div>
                </Card>
              </div>

              {/* Attach Rate (전 상품) + 월간 목표 달성률 + Radar */}
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                {/* 전 상품 모바일 대비 유치율 — 가로형 멀티 막대 */}
                <Card className="p-5 glass lg:col-span-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold">모바일 대비 전 상품 유치율 (Attach Rate)</h4>
                    <span className="text-[10px] text-muted-foreground">▲▼ 전월 대비</span>
                  </div>
                  {analytics.mobileCount === 0 ? (
                    <div className="h-56 grid place-items-center text-xs text-muted-foreground">모바일 개통 데이터 없음</div>
                  ) : (
                    <>
                      <div className="h-56">
                        <ResponsiveContainer>
                          <BarChart
                            data={productivity.attachBars.filter((b) => b.name !== "2nd 디바이스")}
                            layout="vertical"
                            margin={{ top: 8, right: 24, left: 8, bottom: 4 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} unit="%" domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 10) * 10)]} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={70} />
                            <RTooltip
                              contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12 }}
                              formatter={(v: any, _n: any, p: any) => [`${v}% (전월 ${p?.payload?.prev ?? 0}%)`, "유치율"]}
                            />
                            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                              {productivity.attachBars.filter((b) => b.name !== "2nd 디바이스").map((b, i) => <Cell key={i} fill={b.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 mt-2">
                        {productivity.attachBars.filter((b) => b.name !== "2nd 디바이스").map((b) => (
                          <div key={b.name} className="text-center p-1.5 rounded-md bg-card/40 border border-border/40">
                            <div className="text-[10px] text-muted-foreground truncate">{b.name}</div>
                            <div className="text-sm font-bold tabular-nums">{b.value}%</div>
                            <DeltaPill delta={b.delta} compact />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>

                {/* 월간 목표 달성률 — 유치율 옆 배치 */}
                <Card className="p-5 glass lg:col-span-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Target className="size-4 text-primary-glow" /> 월간 목표 달성률
                    </h4>
                    <Badge variant="outline" className="text-[10px]">{yearMonth}</Badge>
                  </div>
                  <div className="space-y-2.5">
                    {selectedGoals.map((g) => {
                      const colorMap: Record<string, string> = {
                        모바일: "hsl(45 95% 60%)",
                        인터넷: "hsl(195 90% 60%)",
                        TV프리: "hsl(280 80% 70%)",
                        스마트홈: "hsl(155 75% 55%)",
                        "2ND": "hsl(15 85% 65%)",
                      };
                      return (
                        <div key={g.product} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium flex items-center gap-2">
                              <span className="size-2 rounded-full" style={{ background: colorMap[g.product] ?? "hsl(var(--primary))" }} />
                              {g.product}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              <span className="text-amber-700 font-semibold">{g.achieved}</span>
                              {g.goal > 0 ? (
                                <> / {g.goal}대 · <span className={g.pct >= 100 ? "text-emerald-400 font-bold" : "text-emerald-300 font-semibold"}>{g.pct}%</span></>
                              ) : (
                                <> · 목표 미설정</>
                              )}
                            </span>
                          </div>
                          <Progress value={g.goal > 0 ? g.pct : 0} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Radar — 영업 성향 시각화 */}
              <Card className="p-5 glass">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">영업 성향 레이더 (전 상품 유치율)</h4>
                  <span className="text-[10px] text-muted-foreground">중심에서 멀수록 우수</span>
                </div>
                <div className="h-60">
                  <ResponsiveContainer>
                    <RadarChart data={productivity.radarData} outerRadius="78%">
                      <PolarGrid stroke="hsl(var(--border) / 0.5)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <Radar name="유치율" dataKey="value" stroke="hsl(45 95% 60%)" fill="hsl(45 95% 60%)" fillOpacity={0.45} />
                      <RTooltip
                        contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12 }}
                        formatter={(v: any) => [`${v}%`, "유치율"]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            {/* Donut + Simulator (existing) */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="p-6 glass lg:col-span-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Smartphone className="size-4 text-primary-glow" /> 항목별 인센티브 수익 비중
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="h-64">
                    {incentive.categoryData.length === 0 ? (
                      <div className="h-full grid place-items-center text-sm text-muted-foreground">매칭된 인센티브가 없습니다</div>
                    ) : (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={incentive.categoryData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={3} stroke="none">
                            {incentive.categoryData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                          </Pie>
                          <RTooltip contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => formatKRWShort(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {incentive.categoryData.length === 0 ? (
                      <li className="text-xs text-muted-foreground">아직 데이터가 없어요</li>
                    ) : incentive.categoryData.map((c, i) => {
                      const Icon = CATEGORY_ICON[c.name] ?? Gift;
                      const pct = incentive.total > 0 ? Math.round((c.value / incentive.total) * 100) : 0;
                      return (
                        <li key={c.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/40 border border-border/40">
                          <div className="size-9 rounded-lg grid place-items-center" style={{ background: `${DONUT_COLORS[i % DONUT_COLORS.length]}22`, color: DONUT_COLORS[i % DONUT_COLORS.length] }}>
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">{pct}% 비중</div>
                          </div>
                          <div className="text-base font-bold text-amber-700 tabular-nums">{formatKRWShort(c.value)}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Card>

              <Card className="p-6 glass border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Calculator className="size-4 text-emerald-400" /> 인센티브 시뮬레이터
                </h3>
                <div className="space-y-2.5">
                  <Select value={simSaleType} onValueChange={setSimSaleType}>
                    <SelectTrigger><SelectValue placeholder="가입 유형" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">가입 유형 — 무관</SelectItem>
                      {distinctSaleTypes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={simProduct} onValueChange={setSimProduct}>
                    <SelectTrigger><SelectValue placeholder="상품" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">상품 — 무관</SelectItem>
                      {distinctProducts.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={simModel} onValueChange={setSimModel}>
                    <SelectTrigger><SelectValue placeholder="모델" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">모델 — 무관</SelectItem>
                      {distinctModels.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08]">
                  <div className="text-[11px] text-emerald-200/80">+1건 추가 시 예상 인센티브</div>
                  <div className="text-3xl font-extrabold tabular-nums text-emerald-300 mt-0.5">+{formatKRWShort(simResult.amount)}</div>
                </div>
              </Card>
            </section>

            {/* Real-time incentive list (kept) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Coins className="size-4 text-amber-400" /> 실시간 인센티브 발생 내역
                  <Badge variant="outline" className="border-border/50 text-muted-foreground ml-1">{incentive.items.length}건</Badge>
                </h3>
                {sales.length > 12 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowDetail((v) => !v)}>
                    {showDetail ? "접기" : `${sales.length - 12}건 더 보기`}
                    <ChevronDown className={`size-3.5 ml-1 transition-transform ${showDetail ? "rotate-180" : ""}`} />
                  </Button>
                )}
              </div>
              {loading ? (
                <Card className="glass p-10 text-center text-muted-foreground">불러오는 중…</Card>
              ) : incentive.items.length === 0 ? (
                <Card className="glass p-10 text-center text-muted-foreground">해당 기간에 실적이 없습니다</Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {(showDetail ? incentive.items : incentive.items.slice(0, 12)).map(({ sale, amount, matched }) => {
                    const status = STATUS_BADGE[sale.approval_status] ?? STATUS_BADGE["승인대기"];
                    const StatusIcon = status.icon;
                    const cat = categorize(sale);
                    const CatIcon = CATEGORY_ICON[cat] ?? Gift;
                    return (
                      <Card key={sale.id} className={`p-4 glass relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-elevated ${amount > 0 ? "border-amber-500/20" : "border-border/40"}`}>
                        <div className="relative space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-8 rounded-lg bg-card/60 grid place-items-center text-muted-foreground shrink-0"><CatIcon className="size-4" /></div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">{sale.device_model || sale.product || "(모델 미지정)"}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{sale.customer_name ?? "고객 미상"} · {sale.open_date ?? "-"}</div>
                              </div>
                            </div>
                            <Badge variant="outline" className={`gap-1 shrink-0 ${status.className}`}><StatusIcon className="size-3" /> {status.label}</Badge>
                          </div>
                          <div className="flex items-end justify-between pt-1">
                            <div className="space-y-1">
                              <Badge variant="outline" className="border-border/40 text-muted-foreground text-[10px]">{sale.sale_type ?? "유형 미지정"}</Badge>
                              {sale.channel && <div className="text-[10px] text-muted-foreground">{sale.channel}</div>}
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground">발생 인센티브</div>
                              <div className={`text-xl font-extrabold tabular-nums ${amount > 0 ? "text-amber-700" : "text-muted-foreground/70"}`}>
                                {amount > 0 ? `+${formatKRWShort(amount)}` : "₩0"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* Goal editor dialog */}
        {selected && isAdmin && (
          <GoalDialog
            open={goalDialogOpen}
            onOpenChange={setGoalDialogOpen}
            user={selected}
            yearMonth={yearMonth}
            currentGoals={goals.filter((g) => g.user_id === selected.user_id)}
            onSaved={reloadData}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

function GoalDialog({
  open, onOpenChange, user, yearMonth, currentGoals, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: Profile;
  yearMonth: string;
  currentGoals: GoalRow[];
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init: Record<string, string> = {};
    GOAL_PRODUCTS.forEach((p) => {
      const g = currentGoals.find((x) => x.product === p);
      init[p] = g ? String(g.goal_count) : "";
    });
    setValues(init);
  }, [currentGoals, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = GOAL_PRODUCTS
        .map((p) => ({
          user_id: user.user_id,
          product: p,
          year_month: yearMonth,
          goal_count: Math.max(0, parseInt(values[p] || "0", 10) || 0),
        }));
      const { error } = await supabase
        .from("staff_product_goals")
        .upsert(rows, { onConflict: "user_id,product,year_month" });
      if (error) throw error;
      toast.success("월간 목표가 저장되었습니다");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("저장 실패: " + (e.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user.display_name} · {yearMonth} 월간 목표</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {GOAL_PRODUCTS.map((p) => (
            <div key={p} className="flex items-center gap-3">
              <div className="w-24 text-sm font-medium">{p}</div>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={values[p] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">대</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeltaPill({ delta, compact = false }: { delta: number; compact?: boolean }) {
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const cls =
    delta > 0
      ? "text-emerald-300 bg-emerald-500/10 border-emerald-400/30"
      : delta < 0
      ? "text-destructive bg-destructive/10 border-destructive/30"
      : "text-muted-foreground bg-muted/30 border-border/40";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border tabular-nums ${cls} ${
        compact ? "text-[9px] mt-0.5" : "text-[10px] mt-1"
      }`}
    >
      <Icon className="size-2.5" />
      {Math.abs(delta)}%p
    </span>
  );
}
