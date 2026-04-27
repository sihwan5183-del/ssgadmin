import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Download, Search, Trash2, Pencil, ShieldAlert, Hash,
  Wallet as WalletIcon, Gift, TrendingUp, Banknote, FileText,
  AlertTriangle, Filter, X, Lock, Unlock, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { usePeriod } from "@/contexts/PeriodContext";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { exportToExcel, SALES_COLUMNS, OFFER_COLUMNS } from "@/lib/excelExport";
import { useQuickExport, useLastUpdated } from "@/hooks/useQuickExport";
import { maskPhone, maskName } from "@/lib/maskPii";
import { useResignedUsers, ResignedTag } from "@/hooks/useResignedUsers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

const PAGE_SIZE = 25;

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
};

const SalesLedgerPage = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { startDate, endDate, label: periodLabel } = usePeriod();
  const navigate = useNavigate();
  const quickExport = useQuickExport();
  const resignedIds = useResignedUsers();

  const [rows, setRows] = useState<SaleRow[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [debouncedSearchQ, setDebouncedSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [quickFilter, setQuickFilter] = useState<"unpaid" | "unreturned" | null>(null);
  const [bundleFilter, setBundleFilter] = useState(false);
  const [noOfferFilter, setNoOfferFilter] = useState(false);
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  // 반납/검수 필터
  // returnFilter: all | returned(반납완료) | unreturned(미반납)
  // inspectionFilter: all | inspected(검수완료=확정) | uninspected(미검수)
  const [returnFilter, setReturnFilter] = useState<"all" | "returned" | "unreturned">("all");
  const [inspectionFilter, setInspectionFilter] = useState<"all" | "inspected" | "uninspected">("all");

  const isMobile = useIsMobile();
  const [filterOpen, setFilterOpen] = useState(false);

  const [dbSummary, setDbSummary] = useState({ count: 0, totalRebate: 0, totalOffer: 0, totalProfit: 0, excludedCount: 0 });
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unreturnedCount, setUnreturnedCount] = useState(0);

  // 최고관리자 전용: 확정된 실적 강제 잠금 해제 토글 (localStorage 저장)
  const [forceUnlock, setForceUnlock] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin_force_unlock_sales") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (forceUnlock) localStorage.setItem("admin_force_unlock_sales", "1");
    else localStorage.removeItem("admin_force_unlock_sales");
  }, [forceUnlock]);

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
      .gte("open_date", startDate)
      .lte("open_date", endDate);
    if (statusFilter.length > 0) {
      query = query.in("status", statusFilter);
    }
    if (managerFilter !== "all") {
      query = query.eq("manager", managerFilter);
    }
    if (storeFilter !== "all") {
      query = query.eq("channel", storeFilter);
    }
    if (productFilter !== "all") {
      query = query.eq("product", productFilter);
    }
    if (returnFilter === "returned") {
      query = query.eq("voucher_returned", "유");
    } else if (returnFilter === "unreturned") {
      query = query.not("voucher", "is", null).neq("voucher", "").neq("voucher_returned", "유");
    }
    if (inspectionFilter === "inspected") {
      query = query.eq("approval_status", "확정");
    } else if (inspectionFilter === "uninspected") {
      query = query.neq("approval_status", "확정");
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
  }, [page, startDate, endDate, statusFilter, managerFilter, debouncedSearchQ]);

  const loadSummary = useCallback(async () => {
    const { data } = await supabase
      .from("sales")
      .select("unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, receivable_amount, trade_in_enabled, trade_in_confirmed, voucher, voucher_returned, customer_support_amount, corp_card_amount, custom_fields")
      .gte("open_date", startDate)
      .lte("open_date", endDate);
    const all = data ?? [];
    // 정산 제외 규칙: 상품권이 있고 반납 미완료('유' 아님) → 합계 제외
    const isExcluded = (r: any) =>
      r.voucher && String(r.voucher).trim() !== "" && r.voucher_returned !== "유";
    const rows = all.filter((r) => !isExcluded(r));
    const excludedCount = all.length - rows.length;
    const totalRebate = rows.reduce((s, r) => s + (r.unit_price ?? 0), 0);
    const totalOffer = rows.reduce((s, r) => s + (r.distributor_amount ?? 0) + (r.extra_subsidy ?? 0) + (r.cash_support_amount ?? 0), 0);
    const totalCustomerSupport = rows.reduce((s, r) => s + ((r as any).customer_support_amount ?? 0), 0);
    const totalCorpCard = rows.reduce((s, r) => s + ((r as any).corp_card_amount ?? 0), 0);
    const totalOfferAll = totalOffer + totalCustomerSupport + totalCorpCard;
    const totalVas = rows.reduce((s, r) => s + (r.vas_fee ?? 0), 0);
    const totalTradeIn = rows.reduce((s, r) => s + (r.trade_in_enabled ? (r.trade_in_confirmed ?? 0) : 0), 0);
    const totalVoucher = rows.reduce(
      (s, r) => s + Number(((r as any).custom_fields?.voucher_amount) ?? 0),
      0,
    );
    setDbSummary({
      count: all.length,
      totalRebate,
      totalOffer: totalOfferAll,
      totalProfit: totalRebate + totalVas + totalTradeIn + totalVoucher - totalOfferAll,
      excludedCount,
    });

    const { count: uc } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .gte("open_date", startDate)
      .lte("open_date", endDate)
      .gt("receivable_amount", 0)
      .neq("receivable_paid", "완료");
    setUnpaidCount(uc ?? 0);
    const { count: urc } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .gte("open_date", startDate)
      .lte("open_date", endDate)
      .neq("voucher", "")
      .not("voucher", "is", null)
      .neq("voucher_returned", "유");
    setUnreturnedCount(urc ?? 0);
  }, [startDate, endDate]);

  useEffect(() => {
    load();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate, statusFilter, managerFilter, debouncedSearchQ]);

  useEffect(() => { setPage(0); }, [startDate, endDate, statusFilter, managerFilter, debouncedSearchQ]);

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
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearchQ.trim().toLowerCase().replace(/\s+/g, "");
    let result = rows;
    if (quickFilter === "unpaid") {
      result = result.filter((r) => (r.receivable_amount ?? 0) > 0 && r.receivable_paid !== "완료");
    } else if (quickFilter === "unreturned") {
      result = result.filter((r) => r.voucher && r.voucher.trim() !== "" && r.voucher_returned !== "유");
    }
    if (bundleFilter) result = result.filter((r) => r.bundle === "Y");
    if (noOfferFilter) result = result.filter((r) => (r.custom_fields as any)?.has_offer === false);
    if (storeFilter !== "all") result = result.filter((r) => (r.channel ?? "") === storeFilter);
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
  }, [rows, debouncedSearchQ, quickFilter, bundleFilter, noOfferFilter, storeFilter]);

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
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .gte("open_date", startDate)
      .lte("open_date", endDate)
      .order("open_date", { ascending: false, nullsFirst: false });
    if (error) return toast.error("엑셀 내보내기 실패", { description: error.message });
    exportToExcel(data ?? [], SALES_COLUMNS, `실적장표_${periodLabel.replace(/\s/g, "")}`, "실적");
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
    if (error) return toast.error("삭제 실패", { description: error.message });
    toast.success("삭제 완료");
    load();
    loadSummary();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("sales").delete().in("id", ids);
    if (error) return toast.error("선택 삭제 실패", { description: error.message });
    toast.success(`${ids.length}건 삭제 완료`);
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
    if (error) return toast.error("전체 삭제 실패", { description: error.message });
    toast.success(`${count ?? 0}건 삭제 완료`);
    setSelected(new Set());
    load();
    loadSummary();
  };

  const animCount = useAnimatedNumber(dbSummary.count);
  const animRebate = useAnimatedNumber(dbSummary.totalRebate);
  const animOffer = useAnimatedNumber(dbSummary.totalOffer);
  const animProfit = useAnimatedNumber(dbSummary.totalProfit);

  const hasActiveFilter = statusFilter || quickFilter || managerFilter !== "all";

  return (
    <>
      <Header
        title="판매원장 관리"
        subtitle="전체 판매 실적 조회 · 필터 · 엑셀 추출 · 정산 관리"
        showScopeToggle={false}
        showPeriodFilter
      />

      {/* 필터 바 */}
      <section className="glass rounded-2xl p-4 mb-4 shadow-card-elevated">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="size-4 text-primary" />
          <span className="text-sm font-semibold">필터</span>
          {hasActiveFilter && (
            <button
              onClick={() => { setStatusFilter(null); setQuickFilter(null); setManagerFilter("all"); }}
              className="ml-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="size-3" /> 초기화
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="직원 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">직원 전체</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter ?? "all"} onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="상태 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">상태 전체</SelectItem>
              <SelectItem value="개통완료">개통완료</SelectItem>
              <SelectItem value="예약">예약</SelectItem>
              <SelectItem value="보류">보류</SelectItem>
              <SelectItem value="취소">취소</SelectItem>
            </SelectContent>
          </Select>

          <Badge
            variant="outline"
            className={cn(
              "gap-1 cursor-pointer transition-colors h-9 px-3",
              quickFilter === "unpaid"
                ? "border-destructive/60 text-destructive bg-destructive/15"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
            onClick={() => setQuickFilter(quickFilter === "unpaid" ? null : "unpaid")}
          >
            💰 미수금 {unpaidCount > 0 && `(${unpaidCount})`}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 cursor-pointer transition-colors h-9 px-3",
              quickFilter === "unreturned"
                ? "border-destructive/60 text-destructive bg-destructive/15"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
            onClick={() => setQuickFilter(quickFilter === "unreturned" ? null : "unreturned")}
          >
            🎫 상품권 미반납 {unreturnedCount > 0 && `(${unreturnedCount})`}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 cursor-pointer transition-colors h-9 px-3",
              bundleFilter
                ? "border-primary/60 text-primary bg-primary/15"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
            onClick={() => setBundleFilter(!bundleFilter)}
          >
            📦 동판 건만
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 cursor-pointer transition-colors h-9 px-3",
              noOfferFilter
                ? "border-primary/60 text-primary bg-primary/15"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
            onClick={() => setNoOfferFilter(!noOfferFilter)}
          >
            🚫 무오퍼 건만
          </Badge>

          <div className="relative flex-1 min-w-[200px] max-w-md ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="고객명·연락처·모델·담당자·매장 검색…"
              className="h-9 pl-9 pr-9 bg-input/60"
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
        </div>
      </section>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <SummaryCard icon={Hash} label="총 판매 건수" value={`${animCount.toLocaleString()}건`} accent="primary" />
        <SummaryCard icon={WalletIcon} label="총 리베이트" value={`${animRebate.toLocaleString("ko-KR")}원`} accent="secondary" />
        <SummaryCard icon={Gift} label="총 오퍼(지원금)" value={`${animOffer.toLocaleString("ko-KR")}원`} accent="warning" />
        <SummaryCard
          icon={TrendingUp}
          label="총 최종 수익"
          value={`${animProfit.toLocaleString("ko-KR")}원`}
          accent={animProfit >= 0 ? "success" : "destructive"}
        />
        <SummaryCard icon={Banknote} label="미수금 건" value={`${unpaidCount}건`} accent={unpaidCount > 0 ? "destructive" : "primary"} />
        <SummaryCard icon={Gift} label="상품권 미반납" value={`${unreturnedCount}건`} accent={unreturnedCount > 0 ? "destructive" : "primary"} />
      </div>
      {dbSummary.excludedCount > 0 && (
        <div className="-mt-3 mb-4 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="size-3" />
          상품권 미반납 {dbSummary.excludedCount}건은 합계에서 제외되었습니다 (반납 완료 시 자동 반영)
        </div>
      )}

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
          {isAdmin && (
            <div className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-colors",
              forceUnlock
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-border/40 bg-muted/30 text-muted-foreground"
            )}>
              {forceUnlock ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
              <span className="text-xs font-medium">수정 잠금 강제 해제</span>
              <Switch
                checked={forceUnlock}
                onCheckedChange={(v) => {
                  setForceUnlock(v);
                  if (v) toast.warning("확정 실적 잠금이 해제되었습니다", {
                    description: "수정 시 정산 데이터에 영향을 줄 수 있습니다. 모든 변경 이력은 자동 기록됩니다.",
                  });
                }}
                aria-label="확정 실적 잠금 강제 해제"
              />
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
      <section className="glass-strong rounded-2xl p-5 md:p-6 shadow-card-elevated">
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs min-w-[1100px]">
            <thead>
              <tr className="text-[11px] text-muted-foreground border-b border-border/40">
                {isAdmin && (
                  <th className="px-3 py-2 w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="전체 선택" />
                  </th>
                )}
                <th className="text-left px-3 py-2 font-medium">개통일</th>
                <th className="text-left px-3 py-2 font-medium">경로</th>
                <th className="text-left px-3 py-2 font-medium">담당</th>
                <th className="text-left px-3 py-2 font-medium">상품</th>
                <th className="text-left px-3 py-2 font-medium">고객</th>
                <th className="text-left px-3 py-2 font-medium">연락처</th>
                <th className="text-left px-3 py-2 font-medium">단말</th>
                <th className="text-center px-2 py-2 font-medium">동판</th>
                <th className="text-center px-2 py-2 font-medium">오퍼</th>
                <th className="text-right px-3 py-2 font-medium">리베이트 단가</th>
                <th className="text-right px-3 py-2 font-medium">오퍼(지원금)</th>
                <th className="text-right px-3 py-2 font-medium">최종 수익</th>
                <th className="text-right px-3 py-2 font-medium">미수금</th>
                <th className="text-right px-3 py-2 font-medium">고객지원</th>
                <th className="text-right px-3 py-2 font-medium">법인카드</th>
                <th className="text-right px-3 py-2 font-medium">중고폰</th>
                <th className="text-right px-3 py-2 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const mine = r.created_by === user?.id;
                const isLocked = r.approval_status === "확정";
                const adminOverride = isAdmin && forceUnlock;
                const canEdit = adminOverride || (mine && !isLocked) || (isAdmin && !isLocked);
                const hasPending = (r.pending_items?.length ?? 0) > 0 && r.pending_resolved === false;
                const offer = offerOf(r);
                const profit = profitOf(r);
                const negative = profit < 0;
                const handleRowClick = () => {
                  if (isLocked && !adminOverride) {
                    if (isAdmin) {
                      toast.info("확정된 실적입니다", {
                        description: "상단의 [수정 잠금 강제 해제] 토글을 켠 뒤 다시 시도하세요.",
                      });
                      return;
                    }
                    toast.info("확정된 실적은 수정할 수 없습니다", { description: "관리자에게 잠금 해제를 요청하세요." });
                    return;
                  }
                  if (!canEdit) {
                    toast.info("본인이 등록한 실적만 수정할 수 있습니다");
                    return;
                  }
                  navigate(`/input?edit=${r.id}`);
                };
                return (
                  <tr key={r.id} className={cn(
                    "border-b border-border/20 hover:bg-white/[0.03] cursor-pointer transition-colors",
                    mine && "bg-primary/[0.04]",
                    hasPending && "bg-amber-50/70 hover:bg-amber-500/[0.12]",
                    isLocked && "opacity-80",
                  )}
                  onClick={handleRowClick}
                  >
                    {isAdmin && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label={`${r.customer_name ?? ""} 선택`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.channel ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      {r.manager ?? "-"}
                      <ResignedTag userId={r.created_by} ids={resignedIds} />
                    </td>
                    <td className="px-3 py-2.5">{r.product ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{isAdmin ? (r.customer_name ?? "-") : maskName(r.customer_name) || "-"}</span>
                        {isLocked && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-border/60 px-1.5 py-0">
                            <Lock className="size-2.5" /> 확정
                          </Badge>
                        )}
                        {hasPending && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-400 text-amber-700 bg-amber-50 px-1.5 py-0">
                            <AlertTriangle className="size-2.5" /> 미처리 {r.pending_items?.length}
                          </Badge>
                        )}
                        {(r.receivable_amount ?? 0) > 0 && r.receivable_paid !== "완료" && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-destructive/40 text-destructive bg-destructive/10 px-1.5 py-0">
                            💰 미수급
                          </Badge>
                        )}
                        {r.voucher && r.voucher.trim() !== "" && r.voucher_returned !== "유" && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-destructive/40 text-destructive bg-destructive/10 px-1.5 py-0">
                            🎫 미반납
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{isAdmin ? (r.phone ?? "-") : maskPhone(r.phone) || "-"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.device_model ?? "-"}</td>
                    <td className="px-2 py-2.5 text-center">
                      {r.bundle === "Y" ? <Badge variant="outline" className="text-[9px] border-primary/40 text-primary px-1.5 py-0">동판</Badge> : <span className="text-muted-foreground text-[10px]">-</span>}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {(r.custom_fields as any)?.has_offer === false
                        ? <Badge variant="secondary" className="text-[9px] px-1.5 py-0">무오퍼</Badge>
                        : <Badge variant="outline" className="text-[9px] px-1.5 py-0">오퍼</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{(r.unit_price ?? 0).toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-warning">{offer.toLocaleString("ko-KR")}</td>
                    <td className={cn(
                      "px-3 py-2.5 text-right tabular-nums font-semibold",
                      negative ? "text-destructive" : hasDeductions(r) ? "text-warning" : "text-revenue"
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
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {(r.receivable_amount ?? 0) > 0 ? (
                        <span className={r.receivable_paid === "완료" ? "text-muted-foreground line-through" : "text-warning font-medium"}>
                          {(r.receivable_amount ?? 0).toLocaleString("ko-KR")}
                        </span>
                      ) : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {(r.customer_support_amount ?? 0) > 0
                        ? <span className="text-warning">{(r.customer_support_amount ?? 0).toLocaleString("ko-KR")}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {(r.corp_card_amount ?? 0) > 0
                        ? <span className="text-warning">{(r.corp_card_amount ?? 0).toLocaleString("ko-KR")}</span>
                        : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {r.trade_in_enabled ? (
                        <span className="text-primary" title={r.trade_in_model ?? ""}>
                          {(r.trade_in_confirmed ?? 0) > 0
                            ? `₩${(r.trade_in_confirmed ?? 0).toLocaleString("ko-KR")}`
                            : "대기"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <div className="inline-flex gap-1">
                            <button onClick={() => navigate(`/input?edit=${r.id}`)} className="size-7 rounded-lg grid place-items-center text-primary-glow hover:bg-primary/10">
                              <Pencil className="size-3.5" />
                            </button>
                            {(mine || isAdmin) && (
                              <button onClick={() => onDelete(r.id)} className="size-7 rounded-lg grid place-items-center text-destructive hover:bg-destructive/10">
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                          {isLocked && adminOverride && (
                            <span className="text-[9px] text-destructive/80 flex items-center gap-0.5 leading-tight max-w-[140px] text-right">
                              <AlertTriangle className="size-2.5 shrink-0" />
                              확정 실적 수정 — 정산 영향 주의
                            </span>
                          )}
                        </div>
                      ) : isLocked ? (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end"><Lock className="size-3" /> 잠금</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">읽기전용</span>
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
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "primary" | "secondary" | "success" | "warning" | "destructive";
}) => {
  const tone: Record<string, string> = {
    primary: "from-primary/20 to-primary-glow/5 text-primary-glow border-primary/20",
    secondary: "from-secondary/20 to-primary/5 text-secondary border-secondary/20",
    success: "from-success/20 to-success/5 text-success border-success/20",
    warning: "from-warning/20 to-warning/5 text-warning border-warning/20",
    destructive: "from-destructive/25 to-destructive/5 text-destructive border-destructive/30",
  };
  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br p-4", tone[accent])}>
      <div className="flex items-center gap-2 text-[11px] font-medium opacity-90 text-primary">
        <Icon className="size-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-lg md:text-xl font-bold tabular-nums tracking-tight text-foreground transition-all duration-300">
        {value}
      </div>
    </div>
  );
};

export default SalesLedgerPage;