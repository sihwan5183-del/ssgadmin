import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Download, Search, Trash2, Pencil, ShieldAlert, Hash,
  Wallet as WalletIcon, Gift, TrendingUp, Banknote, FileText,
  AlertTriangle, Filter, X, Loader2, ChevronDown, ChevronUp, CheckCircle2, Ban, ListFilter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { usePeriod } from "@/contexts/PeriodContext";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { exportToExcel, SALES_COLUMNS, OFFER_COLUMNS, exportSalesFullExcel } from "@/lib/excelExport";
import { useQuickExport, useLastUpdated } from "@/hooks/useQuickExport";
import { maskPhone, maskName } from "@/lib/maskPii";
import { formatPhone } from "@/lib/phoneFormat";
import { useResignedUsers, ResignedTag } from "@/hooks/useResignedUsers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { calcDashboardProfit } from "@/lib/profit";
import { useDashboardStaff } from "@/hooks/useDashboardStaff";
import { UnifiedCalendarWidget } from "@/components/dashboard/UnifiedCalendarWidget";

const PAGE_SIZE = 25;

// ============= 엑셀형 컬럼 필터 (체크박스 다중선택) =============
function ColumnFilter({
  label, options, selected, onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const active = selected.length > 0;
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(q.toLowerCase())),
    [options, q],
  );
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} 필터`}
          className={cn(
            "ml-1 inline-flex items-center justify-center size-4 rounded transition-colors",
            active ? "text-primary bg-primary/15" : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/60",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <ChevronDown className="size-3" strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold">{label} 필터</span>
          {active && (
            <button onClick={() => onChange([])} className="text-[10px] text-muted-foreground hover:text-foreground">초기화</button>
          )}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="검색…"
          className="h-7 text-xs mb-2"
        />
        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filtered.length === 0 && <div className="text-[11px] text-muted-foreground py-2 text-center">항목 없음</div>}
          {filtered.map((o) => (
            <label key={o} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/60 cursor-pointer text-xs">
              <Checkbox checked={selected.includes(o)} onCheckedChange={() => toggle(o)} />
              <span className="truncate">{o || "(빈값)"}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function useAnimatedNumber(target: number, duration = 400) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = display;
    const diff = target - start;
    if (diff === 0) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * ease));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return display;
}

type SaleRow = {
  id: string;
  created_by: string;
  seq: number | null;
  channel: string | null;
  moyo_excluded: boolean | null;
  manager: string | null;
  open_month: string | null;
  product: string | null;
  sale_type: string | null;
  open_method: string | null;
  status: string | null;
  open_date: string | null;
  customer_name: string | null;
  birth_date: string | null;
  phone: string | null;
  device_model: string | null;
  device_serial: string | null;
  usim_model: string | null;
  usim_serial: string | null;
  rate_plan: string | null;
  vas1: string | null;
  vas2: string | null;
  unit_price: number | null;
  vas_fee: number | null;
  voucher: string | null;
  voucher_returned: string | null;
  receivable_amount: number | null;
  receivable_paid: string | null;
  cash_open: boolean | null;
  distributor_amount: number | null;
  extra_subsidy: number | null;
  cash_support_amount: number | null;
  cash_bank: string | null;
  cash_account: string | null;
  cash_holder: string | null;
  net_fee: number | null;
  delivery_type: string | null;
  tracking_no: string | null;
  note: string | null;
  bundle: string | null;
  pending_items?: string[] | null;
  pending_note?: string | null;
  pending_resolved?: boolean | null;
  approval_status?: string | null;
  trade_in_enabled?: boolean | null;
  trade_in_model?: string | null;
  trade_in_confirmed?: number | null;
  custom_fields?: Record<string, any> | null;
  customer_support_amount?: number | null;
  corp_card_amount?: number | null;
  plan_change_planned?: boolean | null;
  plan_change_target_plan?: string | null;
  plan_change_completed_at?: string | null;
  vas1_action?: string | null;
  vas2_action?: string | null;
};

const SalesLedgerPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { startDate, endDate, label: periodLabel, setMode, setYear, setMonth } = usePeriod();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const quickExport = useQuickExport();
  const resignedIds = useResignedUsers();
  const { staff: dashboardStaff, isDashboardStaff } = useDashboardStaff();

  const [rows, setRows] = useState<SaleRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState(() => searchParams.get("q") ?? "");
  const [debouncedSearchQ, setDebouncedSearchQ] = useState(() => searchParams.get("q") ?? "");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // === 엑셀형 컬럼 필터 (체크박스 다중 선택) ===
  type ColKey = "channel" | "status" | "manager" | "product" | "sale_type";
  const COL_KEYS: ColKey[] = ["channel", "status", "manager", "product", "sale_type"];
  const readColFromUrl = (k: ColKey): string[] => {
    const v = searchParams.get(`f_${k}`);
    if (!v) return [];
    return v.split("||").filter(Boolean);
  };
  const [colFilters, setColFilters] = useState<Record<ColKey, string[]>>(() => ({
    channel: readColFromUrl("channel"),
    status: readColFromUrl("status"),
    manager: readColFromUrl("manager"),
    product: readColFromUrl("product"),
    sale_type: readColFromUrl("sale_type"),
  }));
  const setColFilter = (k: ColKey, vals: string[]) =>
    setColFilters((prev) => ({ ...prev, [k]: vals }));
  const clearColFilter = (k: ColKey) => setColFilter(k, []);
  const clearAllColFilters = () =>
    setColFilters({ channel: [], status: [], manager: [], product: [], sale_type: [] });

  // URL 쿼리 파라미터로 진입 시 초기 필터 적용 (직원별 현황 → 비중 차트 클릭 등)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("product");
    const m = sp.get("manager") ?? sp.get("staffName");
    const ps = sp.get("products");
    const stOverride = sp.get("sale_type");
    const fromDash = sp.get("from_dashboard") === "1";
    if (p) setColFilter("product", [p]);
    if (m) setColFilter("manager", [m]);
    // 대시보드(staffName/manager)로 진입한 경우: 항상 이번 달 강제
    if (sp.get("staffName")) {
      const now = new Date();
      setMode("month");
      setYear(now.getFullYear());
      setMonth(now.getMonth() + 1);
    }
    if (ps) {
      const list = ps.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) setColFilter("product", list);
    }
    if (stOverride) setColFilter("sale_type", [stOverride]);
    // 대시보드 진입: 항상 이번 달 기준으로 강제
    if (fromDash) {
      const now = new Date();
      setMode("month");
      setYear(now.getFullYear());
      setMonth(now.getMonth() + 1);
    }
    const st = sp.get("status");
    if (st) {
      const list = st.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) setColFilter("status", list);
      // 대시보드 [개통 대기]에서 진입 시: 항상 이번 달 기준으로 강제
      const now = new Date();
      setMode("month");
      setYear(now.getFullYear());
      setMonth(now.getMonth() + 1);
    }
    // vas=1 인 경우 별도 필터 컬럼이 없어서 검색어로 표시
    if (sp.get("vas") === "1") setSearchQ("부가서비스");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === 필터/검색 상태 → URL 동기화 (상세 진입 후 복귀 시 그대로 유지) ===
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    // 기존 dashboard deep-link 키는 유지
    const q = searchQ.trim();
    if (q) next.set("q", q); else next.delete("q");
    COL_KEYS.forEach((k) => {
      const v = colFilters[k];
      if (v && v.length > 0) next.set(`f_${k}`, v.join("||"));
      else next.delete(`f_${k}`);
    });
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ, colFilters]);

  const isMobile = useIsMobile();

  const { options: channelOptions } = useFieldOptions("channel");
  const { options: productOptions } = useFieldOptions("product");
  const { options: statusOptions } = useFieldOptions("status");

  const [dbSummary, setDbSummary] = useState({
    count: 0,
    totalRebate: 0,
    totalOffer: 0,
    totalProfit: 0,
    excludedCount: 0,
    moyoCount: 0,
    moyoFeeTotal: 0,
    totalReceivable: 0,
    totalVoucher: 0,
    totalTradeIn: 0,
    totalVas: 0,
  });
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unreturnedCount, setUnreturnedCount] = useState(0);

  // 담당자 필드에 UUID가 들어간 경우 프로필 display_name으로 치환하기 위한 맵
  const [managerNameMap, setManagerNameMap] = useState<Record<string, string>>({});
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // 담당자 필터가 표시명(이름)인 경우, sales.manager 컬럼에 UUID/이름 둘 다 저장될 수 있어
  // 매칭되는 user_id 들을 함께 IN 절로 넣어줘야 누락 없이 검색됨.
  // 담당자 컬럼 필터에 표시명이 선택된 경우, sales.manager 에는 UUID/이름 둘 다 저장될 수 있어
  // 대응되는 user_id 까지 함께 IN 절로 넣어줘야 누락 없이 검색됨.
  const [managerValues, setManagerValues] = useState<string[] | null>(null);
  useEffect(() => {
    let alive = true;
    const sel = colFilters.manager.filter((v) => v && v !== "__none__");
    if (sel.length === 0) { setManagerValues(null); return; }
    const names = sel.filter((v) => !UUID_RE.test(v));
    if (names.length === 0) { setManagerValues(sel); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("display_name", names);
      if (!alive) return;
      const uids = (data ?? []).map((p: any) => p.user_id).filter(Boolean);
      setManagerValues(Array.from(new Set([...sel, ...uids])));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colFilters.manager]);
  const resolveManager = useCallback(
    (raw: string | null | undefined, fallbackUid?: string | null) => {
      const v = (raw ?? "").trim();
      if (v && UUID_RE.test(v) && managerNameMap[v]) return managerNameMap[v];
      if (v) return v;
      if (fallbackUid && managerNameMap[fallbackUid]) return managerNameMap[fallbackUid];
      return "-";
    },
    [managerNameMap],
  );

  // === 일괄 담당자 지정용: 활성 직원 목록 ===
  const [staffList, setStaffList] = useState<{ user_id: string; display_name: string }[]>([]);
  const [bulkManager, setBulkManager] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, show_in_dashboard")
        .eq("status", "active")
        .eq("show_in_dashboard", true)
        .order("display_name", { ascending: true });
      const list = (data ?? []) as { user_id: string; display_name: string }[];
      setStaffList(list);
      setManagerNameMap((prev) => {
        const next = { ...prev };
        list.forEach((p) => { if (p.user_id && p.display_name) next[p.user_id] = p.display_name; });
        return next;
      });
    })();
  }, [isAdmin]);

  // 담당자 비어있는지 헬퍼
  const isManagerMissing = (r: SaleRow) => {
    const v = (r.manager ?? "").trim();
    if (!v) return true;
    // UUID인데 매핑이 없거나 활성 직원에 없는 경우는 표시상 비어보이지 않음 — 빈 값만 강조
    return false;
  };

  const bulkAssignManager = async () => {
    if (!isAdmin || selected.size === 0 || !bulkManager) return;
    const ids = Array.from(selected);
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from("sales")
        .update({ manager: bulkManager })
        .in("id", ids);
      if (error) throw error;
      // 더블체크: 실제로 반영되었는지 다시 SELECT
      const { data: verify, error: verr } = await supabase
        .from("sales")
        .select("id, manager")
        .in("id", ids);
      if (verr) throw verr;
      const ok = (verify ?? []).filter((v: any) => v.manager === bulkManager).length;
      if (ok !== ids.length) {
        toast.error(`반영 검증 실패: ${ok}/${ids.length}건만 저장됨`);
      } else {
        const nm = staffList.find((s) => s.user_id === bulkManager)?.display_name ?? bulkManager;
        toast.success(`${ids.length}건 담당자 [${nm}] 지정 완료`);
      }
      setSelected(new Set());
      setBulkManager("");
      load();
      loadSummary();
    } catch (e) {
      toast.error("담당자 일괄 지정 실패", { description: (e as Error).message });
    } finally {
      setBulkBusy(false);
    }
  };

  // ※ 확정 잠금 정책 폐지 — 직원이 자유롭게 수정 가능. 변경 이력은 sales_audit_log 트리거에 자동 기록됨.

  // 5대 오퍼 + 카드결제 + 제휴카드 할인
  const offerOf = (r: SaleRow) =>
    (r.distributor_amount ?? 0)
    + (r.extra_subsidy ?? 0)
    + (r.cash_support_amount ?? 0)
    + (r.customer_support_amount ?? 0)
    + (r.corp_card_amount ?? 0)
    + Number((r as any).custom_fields?.partner_card_discount ?? 0);
  // 5대 수익 - 오퍼
  const profitOf = (r: SaleRow) =>
    (r.unit_price ?? 0)
    + (r.vas_fee ?? 0)
    + (r.trade_in_enabled ? (r.trade_in_confirmed ?? 0) : 0)
    + (r.receivable_amount ?? 0)
    + Number((r as any).custom_fields?.voucher_amount ?? 0)
    - offerOf(r);
  const hasDeductions = (r: SaleRow) =>
    offerOf(r) > 0;

  const load = useCallback(async () => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("sales")
      .select("*", { count: "exact" })
      // 대시보드 [개통 대기] 와 동일 기준:
      // open_date 가 기간 내 OR (open_date NULL 이면서 created_at 이 기간 내)
      .or(
        `and(open_date.gte.${startDate},open_date.lte.${endDate}),` +
        `and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`
      );
    // === 엑셀형 컬럼 필터 적용 (서버 사이드) ===
    if (colFilters.status.length > 0) query = query.in("status", colFilters.status);
    if (colFilters.channel.length > 0) query = query.in("channel", colFilters.channel);
    if (colFilters.product.length > 0) query = query.in("product", colFilters.product);
    if (colFilters.sale_type.length > 0) query = query.in("sale_type", colFilters.sale_type);
    if (colFilters.manager.length > 0) {
      const hasNone = colFilters.manager.includes("__none__");
      const realVals = managerValues ?? colFilters.manager.filter((v) => v !== "__none__");
      if (hasNone && realVals.length === 0) {
        query = query.or("manager.is.null,manager.eq.");
      } else if (realVals.length > 0) {
        query = query.in("manager", realVals);
      }
    }
    const sq = debouncedSearchQ.trim();
    if (sq) {
      const digits = sq.replace(/[^0-9]/g, "");
      const esc = sq.replace(/[,()]/g, " ").trim();
      const orParts = [
        `customer_name.ilike.%${esc}%`,
        `device_model.ilike.%${esc}%`,
        `manager.ilike.%${esc}%`,
        `channel.ilike.%${esc}%`,
      ];
      if (digits.length >= 2) orParts.push(`phone.ilike.%${digits}%`);
      query = query.or(orParts.join(","));
    }
    const { data, error, count } = await query
      .order("open_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      toast.error("목록 불러오기 실패", { description: error.message });
      setSearching(false);
      return;
    }
    setRows((data ?? []) as SaleRow[]);
    setTotal(count ?? 0);
    setSearching(false);
  }, [page, startDate, endDate, colFilters, managerValues, debouncedSearchQ]);

  const loadSummary = useCallback(async () => {
    // 정책: 저장된 모든 실적은 즉시 합계에 반영. (status·approval_status·검수상태와 무관)
    // '취소' 상태만 제외하여 통계 왜곡 방지.
    let q = supabase
      .from("sales")
      .select("unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, receivable_amount, trade_in_enabled, trade_in_confirmed, voucher, voucher_returned, customer_support_amount, corp_card_amount, custom_fields, channel, moyo_excluded, manager, product, approval_status, status")
      .or(
        `and(open_date.gte.${startDate},open_date.lte.${endDate}),` +
        `and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`
      );
    if (colFilters.status.length > 0) q = q.in("status", colFilters.status);
    if (colFilters.channel.length > 0) q = q.in("channel", colFilters.channel);
    if (colFilters.product.length > 0) q = q.in("product", colFilters.product);
    if (colFilters.sale_type.length > 0) q = q.in("sale_type", colFilters.sale_type);
    if (colFilters.manager.length > 0) {
      const hasNone = colFilters.manager.includes("__none__");
      const realVals = managerValues ?? colFilters.manager.filter((v) => v !== "__none__");
      if (hasNone && realVals.length === 0) q = q.or("manager.is.null,manager.eq.");
      else if (realVals.length > 0) q = q.in("manager", realVals);
    }
    const { data } = await q;
    const all = data ?? [];
    // ✅ 단일 공식 (calcDashboardProfit) — 대시보드/엑셀과 1원도 어긋나지 않게 통일
    // ※ 모요 수수료는 [총 리베이트/총 오퍼]에서 분리. 마지막 [최종 수익]에서만 차감.
    let totalCommission = 0;
    let totalVas = 0;
    let totalReceivable = 0;
    let totalVoucher = 0;
    let totalTradeIn = 0;
    let totalOfferExpense = 0; // 모요 수수료 제외한 순수 지출 합계
    let moyoFeeTotal = 0;
    let moyoCount = 0;
    for (const r of all) {
      const p = calcDashboardProfit(r as any);
      totalCommission += p.salesCommission;
      totalVas += p.vasFee;
      totalReceivable += p.receivableAmount;
      totalVoucher += p.voucherAmount;
      totalTradeIn += p.tradeInConfirmed;
      // 지출에서 모요 수수료 제외 → 순수 오퍼/지출 항목만
      totalOfferExpense += p.expense - p.moyoFee;
      moyoFeeTotal += p.moyoFee;
      if (p.moyoFee > 0) moyoCount += 1;
    }
    const totalRebate = totalCommission + totalVas; // 단가표 + 부가서비스 (순수 영업)
    const totalRevenuePure = totalRebate + totalReceivable + totalVoucher + totalTradeIn;
    // 최종 수익 = (순수 수익) - (순수 지출) - (모요 수수료) ← 마지막에 차감
    const totalProfit = totalRevenuePure - totalOfferExpense - moyoFeeTotal;
    setDbSummary({
      count: all.length,
      totalRebate,
      totalOffer: totalOfferExpense,
      totalProfit,
      excludedCount: 0,
      moyoCount,
      moyoFeeTotal,
      totalReceivable,
      totalVoucher,
      totalTradeIn,
      totalVas,
    });

    const { count: uc } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .or(
        `and(open_date.gte.${startDate},open_date.lte.${endDate}),` +
        `and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`
      )
      .gt("receivable_amount", 0)
      .neq("receivable_paid", "완료");
    setUnpaidCount(uc ?? 0);
    const { count: urc } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .or(
        `and(open_date.gte.${startDate},open_date.lte.${endDate}),` +
        `and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`
      )
      .neq("voucher", "")
      .not("voucher", "is", null)
      .neq("voucher_returned", "유");
    setUnreturnedCount(urc ?? 0);
  }, [startDate, endDate, colFilters, managerValues]);

  useEffect(() => {
    load();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate, colFilters, managerValues, debouncedSearchQ]);

  useEffect(() => { setPage(0); }, [startDate, endDate, colFilters, managerValues, debouncedSearchQ]);

  // 실적 입력 후 navigate로 진입 시 즉시 강제 리로드 (캐시 우회)
  useEffect(() => {
    const st = (location.state as { refresh?: number } | null) ?? null;
    if (st?.refresh) {
      load();
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // 실시간 동기화: sales 변경 시 즉시 리스트/요약 재조회 (대시보드와 1:1 일치 유지)
  useEffect(() => {
    const ch = supabase
      .channel("sales-ledger-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        load();
        loadSummary();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, loadSummary]);

  // 디바운스 (300ms) — 입력 중에는 스피너 표시
  useEffect(() => {
    if (searchQ !== debouncedSearchQ) setSearching(true);
    const t = setTimeout(() => setDebouncedSearchQ(searchQ), 300);
    return () => clearTimeout(t);
  }, [searchQ, debouncedSearchQ]);

  // Collect unique managers for filter
  const managers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.manager && set.add(r.manager));
    // [실적 대시보드 노출] OFF 인 직원은 드롭다운에서 제외 — 실 판매자만 빠르게 선택
    const arr = Array.from(set).filter((m) => {
      const v = m.trim();
      if (!v) return false;
      if (UUID_RE.test(v)) {
        // UUID → 이름 매핑이 있고 노출 대상인 경우만
        return isDashboardStaff(v) || isDashboardStaff(managerNameMap[v] ?? "");
      }
      return isDashboardStaff(v);
    });
    return arr.sort();
  }, [rows, dashboardStaff, managerNameMap]);

  // 담당자가 UUID 형태로 저장된 행이 있으면 profiles에서 실명을 조회해 매핑
  useEffect(() => {
    const uids = new Set<string>();
    rows.forEach((r) => {
      const m = (r.manager ?? "").trim();
      if (m && UUID_RE.test(m) && !managerNameMap[m]) uids.add(m);
      const cb = (r as any).created_by as string | undefined;
      if (cb && !managerNameMap[cb] && (!m || UUID_RE.test(m))) uids.add(cb);
    });
    if (uids.size === 0) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", Array.from(uids));
      if (!data || data.length === 0) return;
      setManagerNameMap((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => {
          if (p.user_id && p.display_name) next[p.user_id] = p.display_name;
        });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearchQ.trim().toLowerCase().replace(/\s+/g, "");
    let result = rows;
    if (dayFilter) {
      result = result.filter((r) => r.open_date === dayFilter);
    }
    if (!q) return result;
    const qDigits = q.replace(/[^0-9]/g, "");
    return result.filter((r) => {
      const name = (r.customer_name ?? "").toLowerCase().replace(/\s+/g, "");
      const phone = (r.phone ?? "").replace(/[^0-9]/g, "");
      const model = (r.device_model ?? "").toLowerCase().replace(/\s+/g, "");
      const manager = (r.manager ?? "").toLowerCase().replace(/\s+/g, "");
      const store = (r.channel ?? "").toLowerCase().replace(/\s+/g, "");
      if (name.includes(q) || model.includes(q) || manager.includes(q) || store.includes(q)) return true;
      if (qDigits && phone.includes(qDigits)) return true;
      return false;
    });
  }, [rows, debouncedSearchQ, dayFilter]);

  const allSelected = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const n = new Set(prev);
        filteredRows.forEach((r) => n.delete(r.id));
        return n;
      }
      const n = new Set(prev);
      filteredRows.forEach((r) => n.add(r.id));
      return n;
    });
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const handleExport = async () => {
    let q = supabase
      .from("sales")
      .select("*")
      .or(
        `and(open_date.gte.${startDate},open_date.lte.${endDate}),` +
        `and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`
      );
    if (colFilters.status.length > 0) q = q.in("status", colFilters.status);
    if (colFilters.channel.length > 0) q = q.in("channel", colFilters.channel);
    if (colFilters.product.length > 0) q = q.in("product", colFilters.product);
    if (colFilters.sale_type.length > 0) q = q.in("sale_type", colFilters.sale_type);
    if (colFilters.manager.length > 0) {
      const realVals = managerValues ?? colFilters.manager.filter((v) => v !== "__none__");
      if (realVals.length > 0) q = q.in("manager", realVals);
      else if (colFilters.manager.includes("__none__")) q = q.or("manager.is.null,manager.eq.");
    }
    const { data, error } = await q.order("open_date", { ascending: false, nullsFirst: false });
    if (error) return toast.error("엑셀 내보내기 실패", { description: error.message });
    let sales = (data ?? []) as any[];
    // 클라이언트 측 검색어 보조 필터
    const sq = debouncedSearchQ.trim().toLowerCase();
    const sqDigits = sq.replace(/[^0-9]/g, "");
    sales = sales.filter((r: any) => {
      if (sq) {
        const name = (r.customer_name ?? "").toLowerCase();
        const phone = (r.phone ?? "").replace(/[^0-9]/g, "");
        const model = (r.device_model ?? "").toLowerCase();
        const manager = (r.manager ?? "").toLowerCase();
        const ch = (r.channel ?? "").toLowerCase();
        const txt = name.includes(sq) || model.includes(sq) || manager.includes(sq) || ch.includes(sq);
        const ph = sqDigits && phone.includes(sqDigits);
        if (!txt && !ph) return false;
      }
      return true;
    });
    // 담당자 UID → 성함 매핑 (created_by 기반)
    const uids = Array.from(new Set(sales.map((s: any) => s.created_by).filter(Boolean)));
    const uidToName: Record<string, string> = {};
    if (uids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", uids as string[]);
      (profs ?? []).forEach((p: any) => { uidToName[p.user_id] = p.display_name; });
    }
    exportSalesFullExcel(sales, uidToName, `실적장표_${periodLabel.replace(/\s/g, "")}`, "판매원장");
  };

  const handleExportOffers = async () => {
    const { data, error } = await supabase
      .from("sales")
      .select(
        "seq, open_date, channel, manager, customer_name, phone, product, sale_type, device_model, rate_plan, unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, receivable_amount, receivable_paid, cash_open, cash_bank, cash_account, cash_holder, voucher, voucher_returned, net_fee, approval_status, note",
      )
      .gte("open_date", startDate)
      .lte("open_date", endDate)
      .order("open_date", { ascending: false, nullsFirst: false });
    if (error) return toast.error("오퍼 내보내기 실패", { description: error.message });
    const filtered = (data ?? []).filter((r: any) =>
      Number(r.distributor_amount ?? 0) > 0 ||
      Number(r.extra_subsidy ?? 0) > 0 ||
      Number(r.cash_support_amount ?? 0) > 0 ||
      Number(r.receivable_amount ?? 0) > 0 ||
      r.cash_open === true ||
      (r.voucher && String(r.voucher).trim() !== ""),
    );
    const mapped = filtered.map((r: any) => ({
      ...r,
      cash_open: r.cash_open ? "Y" : "",
    }));
    exportToExcel(
      mapped,
      OFFER_COLUMNS,
      `오퍼_지원금관리_${periodLabel.replace(/\s/g, "")}`,
      "오퍼관리",
    );
  };

  const onDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠어요?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) {
      return toast.error("삭제 실패", { description: error.message });
    }
    toast.success("삭제되었습니다");
    load();
    loadSummary();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("sales").delete().in("id", ids);
    if (error) {
      return toast.error("선택 삭제 실패", { description: error.message });
    }
    toast.success(`${ids.length}건이 삭제되었습니다`);
    setSelected(new Set());
    load();
    loadSummary();
  };

  const deleteAllInPeriod = async () => {
    const { error, count } = await supabase
      .from("sales")
      .delete({ count: "exact" })
      .gte("open_date", startDate)
      .lte("open_date", endDate);
    if (error) {
      return toast.error("전체 삭제 실패", { description: error.message });
    }
    toast.success(`${count ?? 0}건이 삭제되었습니다`);
    setSelected(new Set());
    load();
    loadSummary();
  };

  const animCount = useAnimatedNumber(dbSummary.count);
  const animRebate = useAnimatedNumber(dbSummary.totalRebate);
  const animOffer = useAnimatedNumber(dbSummary.totalOffer);
  const animProfit = useAnimatedNumber(dbSummary.totalProfit);

  const hasActiveFilter = COL_KEYS.some((k) => colFilters[k].length > 0);
  const resetAllFilters = clearAllColFilters;

  const fallbackStatuses = ["청약완료", "택배발송", "개통완료", "예약", "보류", "취소"];
  const statusList = statusOptions.length > 0 ? statusOptions : fallbackStatuses;

  // === 컬럼별 옵션 빌더 (엑셀형 필터 드롭다운용) ===
  const fallbackSaleTypes = ["신규", "MNP", "USIM MNP", "기변", "기변(재가입)"];
  const buildOptions = (colKey: ColKey, fromRows: (r: SaleRow) => string | null | undefined, presets: string[] = []): string[] => {
    const set = new Set<string>();
    presets.forEach((v) => v && set.add(v));
    rows.forEach((r) => {
      const v = (fromRows(r) ?? "").toString().trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  };
  const channelFilterOptions = useMemo(() => buildOptions("channel", (r) => r.channel, channelOptions), [rows, channelOptions]);
  const statusFilterOptions = useMemo(() => buildOptions("status", (r) => r.status, statusList), [rows, statusList]);
  const productFilterOptions = useMemo(() => buildOptions("product", (r) => r.product, productOptions), [rows, productOptions]);
  const saleTypeFilterOptions = useMemo(() => buildOptions("sale_type", (r) => r.sale_type, fallbackSaleTypes), [rows]);
  const managerFilterOptions = useMemo(() => {
    const set = new Set<string>();
    staffList.forEach((s) => { if (s.display_name) set.add(s.display_name); });
    rows.forEach((r) => {
      const m = (r.manager ?? "").trim();
      if (!m) return;
      if (UUID_RE.test(m)) {
        const nm = managerNameMap[m];
        if (nm) set.add(nm);
      } else {
        set.add(m);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
  }, [rows, staffList, managerNameMap]);

  return (
    <>
      <Header
        title="판매원장 관리"
        subtitle="전체 판매 실적 조회 · 필터 · 엑셀 추출 · 정산 관리"
        showScopeToggle={false}
        showPeriodFilter
      />

      <div className="mb-3">
      <div className="mb-5">
        <UnifiedCalendarWidget onDayClick={(iso) => setDayFilter((cur) => (cur === iso ? null : iso))} showTabs={false} />
        {dayFilter && (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-foreground">
            <Badge variant="outline" className="h-7 px-2 border-primary/40 text-primary gap-1">
              <Filter className="size-3" /> {dayFilter} 개통건만 표시
            </Badge>
            <button
              onClick={() => setDayFilter(null)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50"
            >
              <X className="size-3" /> 날짜 필터 해제 (당월 전체 보기)
            </button>
          </div>
        )}
      </div>
      {dbSummary.excludedCount > 0 && (
        <div className="-mt-3 mb-4 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="size-3" />
          상품권 미반납 {dbSummary.excludedCount}건은 합계에서 제외되었습니다 (반납 완료 시 자동 반영)
        </div>
      )}

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* 검색바 */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="고객명·연락처 뒷자리·모델명 검색…"
            className="h-10 pl-9 pr-9 bg-input/60 border-border/60"
          />
          {searching ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
          ) : searchQ ? (
            <button
              type="button"
              onClick={() => setSearchQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
              aria-label="검색어 지우기"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {hasActiveFilter && (
          <Badge variant="outline" className="h-7 px-2 text-[11px] border-primary/40 text-primary gap-1">
            <Filter className="size-3" /> 컬럼 필터 적용중
          </Badge>
        )}
        {hasActiveFilter && (
          <button
            onClick={resetAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 rounded hover:bg-muted/50"
          >
            <X className="size-3" /> 모든 필터 초기화
          </button>
        )}

        <Button variant="outline" size="sm" onClick={handleExport} className="rounded-xl gap-2">
          <Download className="size-4" /> 실적 엑셀
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportOffers} className="rounded-xl gap-2 border-amber-400 text-amber-700 hover:bg-amber-50">
          <Download className="size-4" /> 오퍼(지원금)
        </Button>
        <Button
          variant="outline" size="sm"
          onClick={() => quickExport.exportNow("sales", { start_date: startDate, end_date: endDate })}
          disabled={quickExport.busy === "sales"}
          className="rounded-xl gap-2"
        >
          <Download className="size-4" /> {quickExport.busy === "sales" ? "생성 중…" : "다운로드 센터"}
        </Button>
        <Link to="/downloads">
          <Button variant="outline" size="sm" className="rounded-xl gap-2">
            <FileText className="size-4" /> 다운로드 센터
          </Button>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-primary/15 text-primary-glow border-primary/30">총 {dbSummary.count.toLocaleString()}건</Badge>
          {isAdmin && selected.size > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-2 py-1">
              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">담당자 일괄지정({selected.size})</span>
              <Select value={bulkManager} onValueChange={setBulkManager}>
                <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue placeholder="직원 선택" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {staffList.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 px-2 text-xs" disabled={!bulkManager || bulkBusy} onClick={bulkAssignManager}>
                {bulkBusy ? "적용중…" : "적용"}
              </Button>
            </div>
          )}
          {isAdmin && selected.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"
                  className="rounded-xl gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                  <Trash2 className="size-4" /> 선택 삭제 ({selected.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="size-5 text-destructive" /> 선택한 {selected.size}건을 삭제합니다
                  </AlertDialogTitle>
                  <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteSelected}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    삭제 진행
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"
                  className="rounded-xl gap-2 border-destructive/60 text-destructive hover:bg-destructive/15">
                  <ShieldAlert className="size-4" /> 전체 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <ShieldAlert className="size-5 text-destructive" /> 정말로 모든 데이터를 삭제하시겠습니까?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    현재 기간({periodLabel})의 <strong className="text-destructive">{total.toLocaleString()}건</strong> 모든 판매 데이터가 영구 삭제됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAllInPeriod}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    모두 삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <section className="glass-strong rounded-2xl p-2 md:p-3 shadow-card-elevated">
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px] min-w-[1280px] font-sans [font-feature-settings:'tnum'] border-collapse">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wide text-foreground/70 border-b-2 border-border/60 bg-muted/60 [&>th]:whitespace-nowrap [&>th]:align-middle [&>th]:px-1.5 [&>th]:py-2">
                {isAdmin && (
                  <th className="w-7">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="전체 선택" />
                  </th>
                )}
                {/* 그룹 A: 기본정보 */}
                <th className="text-center font-bold w-[52px]">개통일</th>
                <th className="text-center font-bold w-[88px]">
                  <span className="inline-flex items-center">경로<ColumnFilter label="경로" options={channelFilterOptions} selected={colFilters.channel} onChange={(v) => setColFilter("channel", v)} /></span>
                </th>
                <th className="text-center font-bold w-[78px]">
                  <span className="inline-flex items-center">최종상태<ColumnFilter label="최종상태" options={statusFilterOptions} selected={colFilters.status} onChange={(v) => setColFilter("status", v)} /></span>
                </th>
                <th className="text-center font-bold w-[64px]">
                  <span className="inline-flex items-center">담당<ColumnFilter label="담당" options={managerFilterOptions} selected={colFilters.manager} onChange={(v) => setColFilter("manager", v)} /></span>
                </th>
                <th className="text-center font-bold w-[56px]">
                  <span className="inline-flex items-center">상품<ColumnFilter label="상품" options={productFilterOptions} selected={colFilters.product} onChange={(v) => setColFilter("product", v)} /></span>
                </th>
                <th className="text-left font-bold w-[88px] whitespace-nowrap">고객</th>
                <th className="text-center font-bold w-[120px] whitespace-nowrap">가입번호</th>
                <th className="text-left font-bold w-[56px] whitespace-nowrap">
                  <span className="inline-flex items-center">판매유형<ColumnFilter label="판매유형" options={saleTypeFilterOptions} selected={colFilters.sale_type} onChange={(v) => setColFilter("sale_type", v)} /></span>
                </th>
                <th className="text-center font-bold w-[110px] border-r border-border/40">연락처</th>
                {/* 그룹 B: 가입내용 */}
                <th className="text-left font-bold min-w-[110px] max-w-[160px]">단말</th>
                <th className="text-left font-bold min-w-[120px] max-w-[180px]">요금제</th>
                <th className="text-center font-bold w-[68px]">약정</th>
                <th className="text-right font-bold w-[60px] border-r border-border/40">할부</th>
                {/* 그룹 C: 혜택/태그 */}
                <th className="text-center font-bold w-[52px]">동판</th>
                <th className="text-center font-bold w-[58px] border-r border-border/40">오퍼</th>
                {/* 그룹 D: 정산/금액 */}
                <th className="text-right font-bold w-[92px] text-foreground">총수익</th>
                <th className="text-right font-bold w-[92px] text-rose-600 dark:text-rose-400 bg-rose-500/[0.03]">총오퍼</th>
                <th className="text-right font-bold w-[100px] text-foreground border-r border-border/40">최종수익금액</th>
                <th className="text-center font-bold w-[68px]">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const mine = r.created_by === user?.id;
                // 권한 정책 통일: 조회 가능한 모든 사용자(같은 팀 포함)는 수정도 가능
                // 서버 RLS(`Sales update by scope`)가 최종 권한을 강제함
                const canEdit = true;
                const offer = offerOf(r);
                const profit = profitOf(r);
                const negative = profit < 0;
                const isMoyoExcluded = r.channel === "모요" && r.product === "모바일" && r.moyo_excluded === true;
                const handleRowClick = () => {
                  if (!canEdit) {
                    toast.info("본인이 등록한 실적만 수정할 수 있습니다");
                    return;
                  }
                  navigate(`/input?edit=${r.id}`);
                };
                return (
                  <tr key={r.id} className={cn(
                    "border-b border-border/40 hover:bg-primary/[0.05] cursor-pointer transition-colors group bg-background",
                    "[&>td]:py-2 [&>td]:px-1.5 [&>td]:leading-tight [&>td]:whitespace-nowrap [&>td]:align-middle",
                    isMoyoExcluded && "text-muted-foreground",
                    isManagerMissing(r) && "bg-amber-50/40 dark:bg-amber-500/[0.06]",
                  )}
                  onClick={handleRowClick}
                  >
                    {isAdmin && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label={`${r.customer_name ?? ""} 선택`}
                        />
                      </td>
                    )}
                    <td className="tabular-nums text-center">{r.open_date ? r.open_date.slice(5) : "-"}</td>
                    <td className="align-middle whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1 leading-tight">
                        <span className="no-underline">
                          {r.channel ?? "-"}
                          {(r as any).channel_company ? (
                            <span className="text-muted-foreground"> - {(r as any).channel_company}</span>
                          ) : null}
                        </span>
                        {isMoyoExcluded && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center justify-center rounded-full bg-destructive/10 text-destructive p-0.5"
                                aria-label="모요 미적용"
                              >
                                <Ban className="size-3" strokeWidth={2.5} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>모요 미적용</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-center">
                      {(() => {
                        const s = (r.status ?? "").trim();
                        if (!s) return <span className="text-muted-foreground/50">-</span>;
                        const dotCls =
                          s.includes("개통") && s.includes("완료") ? "bg-emerald-600" :
                          s.includes("택배") ? "bg-sky-600" :
                          s.includes("진행") ? "bg-blue-600" :
                          s.includes("반려") || s.includes("취소") ? "bg-rose-600" :
                          s.includes("보류") || s.includes("대기") ? "bg-amber-500" :
                          s.includes("접수") ? "bg-slate-500" :
                          "bg-zinc-500";
                        return (
                          <span className="inline-flex items-center gap-1 text-foreground text-[11px] font-bold whitespace-nowrap">
                            <span className={cn("inline-block size-1.5 rounded-full", dotCls)} />
                            {s}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap font-medium text-center">
                      {isManagerMissing(r) ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300 text-[10px]">
                          <AlertTriangle className="size-3" /> 미지정
                        </span>
                      ) : (
                        resolveManager(r.manager, (r as any).created_by)
                      )}
                      <ResignedTag userId={r.created_by} ids={resignedIds} />
                    </td>
                    <td className="text-center">{r.product ?? "-"}</td>
                    <td className="text-left">
                      <div className="flex items-center gap-1">
                        <span className="font-medium truncate block max-w-[88px]">{isAdmin ? (r.customer_name ?? "-") : maskName(r.customer_name) || "-"}</span>
                        {r.plan_change_planned && !r.plan_change_completed_at && (
                          <span
                            title={r.plan_change_target_plan ? `요금제 변경 예정: ${r.plan_change_target_plan}` : "요금제 변경 예정"}
                            className="inline-flex items-center rounded-[3px] border border-primary/40 text-primary bg-primary/5 px-1 py-px text-[9px] font-bold leading-none"
                          >
                            요변
                          </span>
                        )}
                        {(r.vas1_action === "remove" || r.vas2_action === "remove") && (
                          <span
                            title="부가서비스 삭제 예정"
                            className="inline-flex items-center rounded-[3px] border border-destructive/40 text-destructive bg-destructive/5 px-1 py-px text-[9px] font-bold leading-none"
                          >
                            부삭
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center text-foreground/90 tabular-nums text-[11px] font-mono tracking-tight">
                      {(() => {
                        const cf = (r as any).custom_fields ?? {};
                        const an = (
                          cf.subscription_no ??
                          cf.activation_number ??
                          cf.가입번호 ??
                          (r as any).activation_number ??
                          ""
                        )
                          .toString()
                          .trim();
                        if (!an) return <span className="text-muted-foreground/50">-</span>;
                        return <span>{an}</span>;
                      })()}
                    </td>
                    <td className="text-left text-foreground whitespace-nowrap">
                      {(() => {
                        const st = (r.sale_type ?? "").trim();
                        if (!st) return <span className="text-muted-foreground/50">-</span>;
                        const stShort = st.replace("USIM ", "").replace("기기변경", "기변").replace("번호이동", "MNP");
                        return <span>{stShort}</span>;
                      })()}
                    </td>
                    <td className="text-foreground/90 tabular-nums text-center text-[11px] font-mono tracking-tight border-r border-border/30">
                      {(() => {
                        const raw = isAdmin ? (r.phone ?? "") : (maskPhone(r.phone) || "");
                        if (!raw) return <span className="text-muted-foreground/50">-</span>;
                        const formatted = isAdmin ? formatPhone(raw) : raw;
                        return <span>{formatted}</span>;
                      })()}
                    </td>
                    <td className="text-muted-foreground text-left max-w-[160px] truncate" title={r.device_model ?? ""}>{r.device_model ?? "-"}</td>
                    <td className="text-muted-foreground text-left max-w-[180px] truncate" title={r.rate_plan ?? ""}>{r.rate_plan ?? "-"}</td>
                    <td className="text-muted-foreground text-center">
                      {(() => {
                        const ct = (r.custom_fields as any)?.contract_type;
                        if (!ct) return "-";
                        return String(ct)
                          .replace("이동사지원금", "이동사")
                          .replace("공시지원금", "공시")
                          .replace("선택약정", "선택");
                      })()}
                    </td>
                    <td className="text-right text-muted-foreground tabular-nums border-r border-border/30 pr-2">
                      {(r.custom_fields as any)?.installment_months
                        ? `${(r.custom_fields as any).installment_months}`
                        : "-"}
                    </td>
                    <td className="text-center">
                      {r.bundle === "Y" ? <Badge variant="outline" className="h-[16px] text-[9px] border-primary/40 text-primary px-1 py-0">동판</Badge> : <span className="text-muted-foreground text-[10px]">-</span>}
                    </td>
                    <td className="text-center border-r border-border/30">
                      {(r.custom_fields as any)?.has_offer === false
                        ? <Badge variant="secondary" className="h-[16px] text-[9px] px-1 py-0">무오퍼</Badge>
                        : <Badge variant="outline" className="h-[16px] text-[9px] px-1 py-0">오퍼</Badge>}
                    </td>
                    <td className="text-right tabular-nums font-bold text-foreground pr-2">
                      {(r.unit_price ?? 0).toLocaleString("ko-KR")}
                    </td>
                    <td className="text-right tabular-nums font-bold text-rose-600 dark:text-rose-400 bg-rose-500/[0.04] pr-2">
                      {offer.toLocaleString("ko-KR")}
                    </td>
                    <td className={cn(
                      "text-right tabular-nums font-extrabold border-r border-border/30 pr-2",
                      negative ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"
                    )}>
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{profit.toLocaleString("ko-KR")}</span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs space-y-0.5 max-w-[220px]">
                            <p className="font-semibold mb-1">수익 상세 내역</p>
                            <p>단가: +{(r.unit_price ?? 0).toLocaleString()}</p>
                            {(r.vas_fee ?? 0) > 0 && <p>부가수익: +{(r.vas_fee ?? 0).toLocaleString()}</p>}
                            {r.trade_in_enabled && (r.trade_in_confirmed ?? 0) > 0 && <p>중고폰: +{(r.trade_in_confirmed ?? 0).toLocaleString()}</p>}
                            {(r.distributor_amount ?? 0) > 0 && <p className="text-destructive">유통망: -{(r.distributor_amount ?? 0).toLocaleString()}</p>}
                            {(r.extra_subsidy ?? 0) > 0 && <p className="text-destructive">상품권: -{(r.extra_subsidy ?? 0).toLocaleString()}</p>}
                            {(r.cash_support_amount ?? 0) > 0 && <p className="text-destructive">현금지원: -{(r.cash_support_amount ?? 0).toLocaleString()}</p>}
                            {(r.customer_support_amount ?? 0) > 0 && <p className="text-destructive">고객지원: -{(r.customer_support_amount ?? 0).toLocaleString()}</p>}
                            {(r.corp_card_amount ?? 0) > 0 && <p className="text-destructive">법인카드: -{(r.corp_card_amount ?? 0).toLocaleString()}</p>}
                            <hr className="border-border/40 my-1" />
                            <p className="font-bold">최종: {profit.toLocaleString()}</p>
                            {(r.receivable_amount ?? 0) > 0 && <p className="text-warning">미수금: {(r.receivable_amount ?? 0).toLocaleString()} ({r.receivable_paid === "완료" ? "수급완료" : "미수급"})</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <div className="inline-flex items-center justify-center gap-0.5">
                            <button onClick={() => navigate(`/input?edit=${r.id}`)} className="size-6 rounded-md grid place-items-center text-primary-glow hover:bg-primary/10">
                              <Pencil className="size-3" />
                            </button>
                            {(mine || isAdmin) && (
                              <button onClick={() => onDelete(r.id)} className="size-6 rounded-md grid place-items-center text-destructive hover:bg-destructive/10">
                                <Trash2 className="size-3" />
                              </button>
                            )}
                        </div>
                      ) : (
                        <span className="text-[9px] text-muted-foreground">읽기</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr><td colSpan={isAdmin ? 18 : 17} className="text-center py-10 text-muted-foreground">
                  {searchQ ? "검색 결과가 없습니다." : "선택한 기간에 데이터가 없습니다."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
      </section>
    </>
  );
};

const SummaryCard = ({
  icon: Icon, label, value, accent, tooltip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "primary" | "secondary" | "success" | "warning" | "destructive";
  tooltip?: React.ReactNode;
}) => {
  const tone: Record<string, string> = {
    primary: "from-primary/20 to-primary-glow/5 text-primary-glow border-primary/20",
    secondary: "from-secondary/20 to-primary/5 text-secondary border-secondary/20",
    success: "from-success/20 to-success/5 text-success border-success/20",
    warning: "from-warning/20 to-warning/5 text-warning border-warning/20",
    destructive: "from-destructive/25 to-destructive/5 text-destructive border-destructive/30",
  };
  const card = (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-4 cursor-help", tone[accent])}>
      <div className="flex items-center gap-2 text-[11px] font-medium opacity-90 text-primary">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-lg md:text-xl font-bold tabular-nums tracking-tight text-foreground transition-all duration-300">
        {value}
      </div>
    </div>
  );
  if (!tooltip) return card;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-[11px] leading-relaxed whitespace-pre-line">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SalesLedgerPage;