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
  AlertTriangle, Filter, X, Loader2, ChevronDown, ChevronUp, CheckCircle2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { usePeriod } from "@/contexts/PeriodContext";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { exportToExcel, SALES_COLUMNS, OFFER_COLUMNS, exportSalesFullExcel } from "@/lib/excelExport";
import { useQuickExport, useLastUpdated } from "@/hooks/useQuickExport";
import { maskPhone, maskName } from "@/lib/maskPii";
import { useResignedUsers, ResignedTag } from "@/hooks/useResignedUsers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { calcDashboardProfit } from "@/lib/profit";

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
  // 모요 적용 구분: all | applied(모요+토글OFF) | excluded(모요+토글ON)
  const [moyoFilter, setMoyoFilter] = useState<"all" | "applied" | "excluded">("all");

  // URL 쿼리 파라미터로 진입 시 초기 필터 적용 (직원별 현황 → 비중 차트 클릭 등)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const p = sp.get("product");
    const m = sp.get("manager");
    if (p) setProductFilter(p);
    if (m) setManagerFilter(m);
    // vas=1 인 경우 별도 필터 컬럼이 없어서 검색어로 표시
    if (sp.get("vas") === "1") setSearchQ("부가서비스");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMobile = useIsMobile();
  const [filterOpen, setFilterOpen] = useState(false);

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
    if (moyoFilter === "applied") {
      query = query.eq("channel", "모요").eq("product", "모바일").or("moyo_excluded.is.null,moyo_excluded.eq.false");
    } else if (moyoFilter === "excluded") {
      query = query.eq("channel", "모요").eq("product", "모바일").eq("moyo_excluded", true);
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
  }, [page, startDate, endDate, statusFilter, managerFilter, storeFilter, productFilter, returnFilter, inspectionFilter, moyoFilter, debouncedSearchQ]);

  const loadSummary = useCallback(async () => {
    let q = supabase
      .from("sales")
      .select("unit_price, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, receivable_amount, trade_in_enabled, trade_in_confirmed, voucher, voucher_returned, customer_support_amount, corp_card_amount, custom_fields, channel, moyo_excluded, manager, product, approval_status")
      .gte("open_date", startDate)
      .lte("open_date", endDate)
      .in("status", ["개통완료", "설치완료"]);
    if (managerFilter !== "all") q = q.eq("manager", managerFilter);
    if (storeFilter !== "all") q = q.eq("channel", storeFilter);
    if (productFilter !== "all") q = q.eq("product", productFilter);
    if (moyoFilter === "applied") {
      q = q.eq("channel", "모요").eq("product", "모바일").or("moyo_excluded.is.null,moyo_excluded.eq.false");
    } else if (moyoFilter === "excluded") {
      q = q.eq("channel", "모요").eq("product", "모바일").eq("moyo_excluded", true);
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
  }, [startDate, endDate, managerFilter, storeFilter, productFilter, moyoFilter]);

  useEffect(() => {
    load();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate, statusFilter, managerFilter, storeFilter, productFilter, returnFilter, inspectionFilter, moyoFilter, debouncedSearchQ]);

  useEffect(() => { setPage(0); }, [startDate, endDate, statusFilter, managerFilter, storeFilter, productFilter, returnFilter, inspectionFilter, moyoFilter, debouncedSearchQ]);

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
  }, [rows, debouncedSearchQ, quickFilter, bundleFilter, noOfferFilter]);

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
      .gte("open_date", startDate)
      .lte("open_date", endDate);
    if (statusFilter.length > 0) {
      q = q.in("status", statusFilter);
    } else {
      // 기본: 대시보드와 동일하게 [개통완료, 설치완료]만
      q = q.in("status", ["개통완료", "설치완료"]);
    }
    if (managerFilter !== "all") q = q.eq("manager", managerFilter);
    if (storeFilter !== "all") q = q.eq("channel", storeFilter);
    if (productFilter !== "all") q = q.eq("product", productFilter);
    if (returnFilter === "returned") q = q.eq("voucher_returned", "유");
    else if (returnFilter === "unreturned") q = q.not("voucher", "is", null).neq("voucher", "").neq("voucher_returned", "유");
    if (inspectionFilter === "inspected") q = q.eq("approval_status", "확정");
    else if (inspectionFilter === "uninspected") q = q.neq("approval_status", "확정");
    if (moyoFilter === "applied") q = q.eq("channel", "모요").eq("product", "모바일").or("moyo_excluded.is.null,moyo_excluded.eq.false");
    else if (moyoFilter === "excluded") q = q.eq("channel", "모요").eq("product", "모바일").eq("moyo_excluded", true);
    const { data, error } = await q.order("open_date", { ascending: false, nullsFirst: false });
    if (error) return toast.error("엑셀 내보내기 실패", { description: error.message });
    let sales = (data ?? []) as any[];
    // 클라이언트 측 보조 필터 (퀵필터/번들/노오퍼/검색어)
    const sq = debouncedSearchQ.trim().toLowerCase();
    const sqDigits = sq.replace(/[^0-9]/g, "");
    sales = sales.filter((r: any) => {
      if (quickFilter === "unpaid" && !((r.receivable_amount ?? 0) > 0 && r.receivable_paid !== "완료")) return false;
      if (quickFilter === "unreturned" && !(r.voucher && String(r.voucher).trim() !== "" && r.voucher_returned !== "유")) return false;
      if (bundleFilter && r.bundle !== "Y") return false;
      if (noOfferFilter && (r.custom_fields as any)?.has_offer !== false) return false;
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

  const hasActiveFilter =
    statusFilter.length > 0 ||
    quickFilter !== null ||
    managerFilter !== "all" ||
    storeFilter !== "all" ||
    productFilter !== "all" ||
    returnFilter !== "all" ||
    inspectionFilter !== "all" ||
    moyoFilter !== "all" ||
    bundleFilter ||
    noOfferFilter;

  const resetAllFilters = () => {
    setStatusFilter([]);
    setQuickFilter(null);
    setManagerFilter("all");
    setStoreFilter("all");
    setProductFilter("all");
    setReturnFilter("all");
    setInspectionFilter("all");
    setMoyoFilter("all");
    setBundleFilter(false);
    setNoOfferFilter(false);
  };

  const toggleStatus = (s: string) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const fallbackStatuses = ["청약완료", "택배발송", "개통완료", "예약", "보류", "취소"];
  const statusList = statusOptions.length > 0 ? statusOptions : fallbackStatuses;

  const showFilterBody = !isMobile || filterOpen;

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
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Filter className="size-4 text-primary" />
          <span className="text-sm font-semibold">스마트 필터</span>
          {hasActiveFilter && (
            <Badge variant="outline" className="h-6 px-2 text-[10px] border-primary/40 text-primary">
              필터 적용중
            </Badge>
          )}
          {hasActiveFilter && (
            <button
              onClick={resetAllFilters}
              className="ml-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="size-3" /> 초기화
            </button>
          )}

          {/* 통합 검색 — 항상 보임 */}
          <div className="relative flex-1 min-w-[200px] max-w-md ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="고객명·연락처 뒷자리·모델명 검색…"
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

          {isMobile && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1"
              onClick={() => setFilterOpen((v) => !v)}
            >
              필터 상세 {filterOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          )}
        </div>

        {showFilterBody && (
          <>
            <div className="grid grid-cols-2 md:flex md:flex-wrap md:items-center gap-2">
              {/* 매장(채널) 필터 */}
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-9 md:w-[150px]">
                  <SelectValue placeholder="매장 전체" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all">매장 전체</SelectItem>
                  {channelOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 상품 필터 */}
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="h-9 md:w-[140px]">
                  <SelectValue placeholder="상품 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">상품 전체</SelectItem>
                  {productOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 직원 필터 */}
              <Select value={managerFilter} onValueChange={setManagerFilter}>
                <SelectTrigger className="h-9 md:w-[140px]">
                  <SelectValue placeholder="직원 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">직원 전체</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 반납 필터 */}
              <Select value={returnFilter} onValueChange={(v) => setReturnFilter(v as any)}>
                <SelectTrigger className="h-9 md:w-[140px]">
                  <SelectValue placeholder="반납 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">반납 전체</SelectItem>
                  <SelectItem value="returned">반납완료</SelectItem>
                  <SelectItem value="unreturned">미반납</SelectItem>
                </SelectContent>
              </Select>

              {/* 검수 필터 */}
              <Select value={inspectionFilter} onValueChange={(v) => setInspectionFilter(v as any)}>
                <SelectTrigger className="h-9 md:w-[140px]">
                  <SelectValue placeholder="검수 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">검수 전체</SelectItem>
                  <SelectItem value="inspected">검수완료(확정)</SelectItem>
                  <SelectItem value="uninspected">미검수</SelectItem>
                </SelectContent>
              </Select>

              {/* 모요 적용 구분 필터 */}
              <Select value={moyoFilter} onValueChange={(v) => setMoyoFilter(v as any)}>
                <SelectTrigger className="h-9 md:w-[150px]">
                  <SelectValue placeholder="모요 전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모요 전체</SelectItem>
                  <SelectItem value="applied">모요 적용</SelectItem>
                  <SelectItem value="excluded">모요 미적용</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 상태 멀티셀렉트 (칩) */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[11px] text-muted-foreground mr-1">상태:</span>
              {statusList.map((s) => {
                const active = statusFilter.includes(s);
                return (
                  <Badge
                    key={s}
                    variant="outline"
                    className={cn(
                      "cursor-pointer transition-colors h-7 px-2.5",
                      active
                        ? "border-primary/60 text-primary bg-primary/15"
                        : "border-border/40 text-muted-foreground hover:bg-muted/40",
                    )}
                    onClick={() => toggleStatus(s)}
                  >
                    {s}
                  </Badge>
                );
              })}
            </div>

            {/* 빠른 필터 */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-muted-foreground mr-1">빠른:</span>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 cursor-pointer transition-colors h-7 px-2.5",
                  quickFilter === "unpaid"
                    ? "border-destructive/60 text-destructive bg-destructive/15"
                    : "border-border/40 text-muted-foreground hover:bg-muted/40",
                )}
                onClick={() => setQuickFilter(quickFilter === "unpaid" ? null : "unpaid")}
              >
                💰 미수금 {unpaidCount > 0 && `(${unpaidCount})`}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 cursor-pointer transition-colors h-7 px-2.5",
                  quickFilter === "unreturned"
                    ? "border-destructive/60 text-destructive bg-destructive/15"
                    : "border-border/40 text-muted-foreground hover:bg-muted/40",
                )}
                onClick={() => setQuickFilter(quickFilter === "unreturned" ? null : "unreturned")}
              >
                🎫 상품권 미반납 {unreturnedCount > 0 && `(${unreturnedCount})`}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 cursor-pointer transition-colors h-7 px-2.5",
                  bundleFilter
                    ? "border-primary/60 text-primary bg-primary/15"
                    : "border-border/40 text-muted-foreground hover:bg-muted/40",
                )}
                onClick={() => setBundleFilter(!bundleFilter)}
              >
                📦 동판 건만
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 cursor-pointer transition-colors h-7 px-2.5",
                  noOfferFilter
                    ? "border-primary/60 text-primary bg-primary/15"
                    : "border-border/40 text-muted-foreground hover:bg-muted/40",
                )}
                onClick={() => setNoOfferFilter(!noOfferFilter)}
              >
                🚫 무오퍼 건만
              </Badge>
            </div>
          </>
        )}
      </section>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <SummaryCard icon={Hash} label="총 판매 건수" value={`${animCount.toLocaleString()}건`} accent="primary" />
        <SummaryCard
          icon={WalletIcon}
          label="총 리베이트"
          value={`${animRebate.toLocaleString("ko-KR")}원`}
          accent="secondary"
          tooltip={`= 단가표 수수료 + 부가서비스 수수료\n(모요 수수료 미포함 · 순수 영업 수치)`}
        />
        <SummaryCard
          icon={Gift}
          label="총 오퍼(지원금)"
          value={`${animOffer.toLocaleString("ko-KR")}원`}
          accent="warning"
          tooltip={`= 유통망지원금 + 현금개통 + 추가지원금\n  + 고객지원금 + 법인카드 결제\n(모요 수수료 별도 관리 · 미포함)`}
        />
        <SummaryCard
          icon={TrendingUp}
          label="총 최종 수익"
          value={`${animProfit.toLocaleString("ko-KR")}원`}
          accent={animProfit >= 0 ? "success" : "destructive"}
          tooltip={`= (총 리베이트 + 미수금 + 상품권 + 중고폰)\n   − 총 오퍼(지원금)\n   − 모요 수수료 합계\n\n모요 수수료는 마지막 단계에서만 차감됩니다.`}
        />
        <SummaryCard
          icon={Banknote}
          label="미수금 건"
          value={`${unpaidCount}건`}
          accent={unpaidCount > 0 ? "destructive" : "primary"}
          tooltip={`수급 미완료 미수금 건수\n(수수료와 무관 · 순수 미수 액수 관리)`}
        />
        <SummaryCard
          icon={Gift}
          label="상품권 미반납"
          value={`${unreturnedCount}건`}
          accent={unreturnedCount > 0 ? "destructive" : "primary"}
          tooltip={`반납 미완료 상품권 건수\n(수수료와 무관 · 순수 미반납 관리)`}
        />
      </div>
      {/* 모요 정산 정보 (별도 라인) */}
      <div className="-mt-2 mb-5 rounded-xl border border-fuchsia-300/40 bg-gradient-to-r from-fuchsia-50/80 to-pink-50/40 dark:from-fuchsia-950/30 dark:to-pink-950/20 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">
          <Filter className="size-3.5" /> 모요 정산 정보 (별도 지출 관리)
        </div>
        <div className="text-xs text-muted-foreground">
          모요 정산 대상: <span className="font-bold tabular-nums text-foreground">{dbSummary.moyoCount.toLocaleString()}건</span>
        </div>
        <div className="text-xs text-muted-foreground">
          모요 수수료 합계: <span className="font-bold tabular-nums text-fuchsia-700 dark:text-fuchsia-300">{dbSummary.moyoFeeTotal.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="text-[10px] text-muted-foreground/80 ml-auto">
          ※ 모바일 상품 한정 · 토글 OFF 건만 합산 · 최종 수익에서만 차감
        </div>
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
                <th className="text-left px-3 py-2 font-medium">요금제</th>
                <th className="text-left px-3 py-2 font-medium">약정</th>
                <th className="text-center px-2 py-2 font-medium">할부</th>
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
                // ※ 잠금 정책 폐지 — 본인 또는 관리자는 언제든 수정 가능 (히스토리는 sales_audit_log 자동 기록)
                const canEdit = mine || isAdmin;
                // 검수 완료 = 관리자가 검수에서 확정 처리한 상태
                const isInspected =
                  r.approval_status === "확정" || r.approval_status === "검수완료";
                const hasPending = (r.pending_items?.length ?? 0) > 0 && r.pending_resolved === false;
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
                    "border-b border-border/20 hover:bg-white/[0.03] cursor-pointer transition-colors",
                    mine && "bg-primary/[0.04]",
                    hasPending && "bg-amber-50/70 hover:bg-amber-500/[0.12]",
                    isMoyoExcluded && "text-muted-foreground/80 [&_td]:line-through",
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
                    <td className="px-3 py-2.5 no-underline">
                      <div className="flex items-center gap-1.5 no-underline">
                        <span>{r.channel ?? "-"}</span>
                        {isMoyoExcluded && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted-foreground/40 text-muted-foreground no-underline">
                            모요 미적용
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.manager ?? "-"}
                      <ResignedTag userId={r.created_by} ids={resignedIds} />
                    </td>
                    <td className="px-3 py-2.5">{r.product ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{isAdmin ? (r.customer_name ?? "-") : maskName(r.customer_name) || "-"}</span>
                        {isInspected && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-emerald-500/50 text-emerald-700 bg-emerald-50 px-1.5 py-0">
                            <CheckCircle2 className="size-2.5" /> 검수 완료
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
                    <td className="px-3 py-2.5 text-muted-foreground">{r.rate_plan ?? "-"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {(r.custom_fields as any)?.contract_type ?? "-"}
                    </td>
                    <td className="px-2 py-2.5 text-center text-muted-foreground tabular-nums">
                      {(r.custom_fields as any)?.installment_months
                        ? `${(r.custom_fields as any).installment_months}개월`
                        : "-"}
                    </td>
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
                          {isInspected && (
                            <span className="text-[9px] text-emerald-700 flex items-center gap-0.5 leading-tight">
                              <CheckCircle2 className="size-2.5 shrink-0" /> 검수 완료
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">읽기전용</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr><td colSpan={isAdmin ? 21 : 20} className="text-center py-10 text-muted-foreground">
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