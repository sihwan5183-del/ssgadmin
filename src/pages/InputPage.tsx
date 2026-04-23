import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Upload, Zap, Trash2, Pencil, X, FileSpreadsheet, Download, Search, ShieldAlert, Hash, Wallet as WalletIcon, Gift, TrendingUp } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { useProductRatePlans } from "@/hooks/useProductRatePlans";
import { usePeriod } from "@/contexts/PeriodContext";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { exportToExcel, SALES_COLUMNS, OFFER_COLUMNS } from "@/lib/excelExport";
import { cn } from "@/lib/utils";
import { useFieldDefinitions } from "@/hooks/useFieldDefinitions";
import { useNetFeeFormula } from "@/hooks/useNetFeeFormula";
import { DynamicFieldRenderer } from "@/components/admin/DynamicFieldRenderer";
import { ExcelMappingDialog, type MappingTarget } from "@/components/admin/ExcelMappingDialog";
import { ExcelTemplateEditor } from "@/components/admin/ExcelTemplateEditor";
import { ExcelUploadWizard } from "@/components/admin/ExcelUploadWizard";
import type { FieldRule } from "@/lib/excelValidation";
import { useQuickExport, useLastUpdated } from "@/hooks/useQuickExport";
import { SaleDocuments } from "@/components/sales/SaleDocuments";
import { PendingItemsEditor } from "@/components/sales/PendingItemsEditor";
import { MoneyInput } from "@/components/ui/money-input";
import { ModelAutocomplete } from "@/components/ui/model-autocomplete";
import { Sparkles, AlertTriangle, Wallet, Banknote, Building2 } from "lucide-react";
import { CreditCard } from "lucide-react";

const PAGE_SIZE = 25;

/* ---------- animated counter hook ---------- */
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
      // ease-out
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
};

const emptyForm: Partial<SaleRow> = {
  status: "개통완료",
  moyo_excluded: false,
  cash_open: false,
};

const InputPage = () => {
  const { user } = useAuth();
  const { options: CHANNELS } = useFieldOptions("channel");
  const { options: PRODUCTS } = useFieldOptions("product");
  const { options: SALE_TYPES } = useFieldOptions("sale_type");
  const { options: OPEN_METHODS } = useFieldOptions("open_method");
  const { options: STATUSES } = useFieldOptions("status");
  const { options: RATE_PLANS } = useFieldOptions("rate_plan");
  const { getPlansForProduct, getDefaultsForProduct, getAllowedSaleTypes } = useProductRatePlans();
  const { options: DELIVERY_TYPES } = useFieldOptions("delivery_type");
  const { options: BANKS } = useFieldOptions("bank");
  const [form, setForm] = useState<Partial<SaleRow>>(emptyForm);
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [pendingNote, setPendingNote] = useState<string>("");
  const [pendingResolved, setPendingResolved] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const mappingFileRef = useRef<HTMLInputElement>(null);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const { startDate, endDate, label: periodLabel } = usePeriod();
  const quickExport = useQuickExport();
  const lastUpdated = useLastUpdated("sales");
  const { fields: dynamicFields } = useFieldDefinitions("sales");
  const { calc: calcNetFee, formula: netFeeFormula } = useNetFeeFormula();
  const { isAdmin } = useRole();
  const [searchQ, setSearchQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const [linkedInquiryId, setLinkedInquiryId] = useState<string | null>(null);
  const [dbSummary, setDbSummary] = useState({ count: 0, totalRebate: 0, totalOffer: 0, totalProfit: 0 });
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [unreturnedCount, setUnreturnedCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<"unpaid" | "unreturned" | null>(null);

  // 인입 → 실적 자동 채움 (URL 파라미터)
  useEffect(() => {
    const fromInquiry = searchParams.get("from_inquiry");
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setStatusFilter(statusParam);
      searchParams.delete("status");
      setSearchParams(searchParams, { replace: true });
    }
    if (!fromInquiry) return;
    const customer = searchParams.get("customer_name") ?? "";
    const phone = searchParams.get("phone") ?? "";
    const channel = searchParams.get("channel") ?? "";
    const manager = searchParams.get("manager") ?? "";
    setForm((f) => ({
      ...f,
      customer_name: customer || f.customer_name,
      phone: phone || f.phone,
      channel: channel || f.channel,
      manager: manager || f.manager,
      open_date: f.open_date ?? new Date().toISOString().slice(0, 10),
    }));
    setLinkedInquiryId(fromInquiry);
    toast.info("인입 데이터가 자동 입력되었습니다", { description: "저장 시 인입 건과 자동 연결됩니다." });
    // 한 번 채운 뒤 URL 정리
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 리베이트(unit_price) - 오퍼(지원금 합) = 최종 수익
  const offerOf = (r: SaleRow) =>
    (r.distributor_amount ?? 0) + (r.extra_subsidy ?? 0) + (r.cash_support_amount ?? 0);
  const profitOf = (r: SaleRow) => (r.unit_price ?? 0) - offerOf(r);

  const filteredRows = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    let result = rows;
    if (quickFilter === "unpaid") {
      result = result.filter((r) => (r.receivable_amount ?? 0) > 0 && r.receivable_paid !== "완료");
    } else if (quickFilter === "unreturned") {
      result = result.filter((r) => r.voucher && r.voucher.trim() !== "" && r.voucher_returned !== "유");
    }
    if (!q) return result;
    return result.filter((r) => {
      const name = (r.customer_name ?? "").toLowerCase();
      const phone = (r.phone ?? "").replace(/[^0-9]/g, "");
      return name.includes(q) || phone.includes(q.replace(/[^0-9]/g, ""));
    });
  }, [rows, searchQ, quickFilter]);

  // Fetch full aggregates from DB (not limited by pagination)
  const loadSummary = useCallback(async (sq?: string) => {
    const q = (sq ?? searchQ).trim().toLowerCase();
    // If searching, we need to fetch matching rows' aggregates
    if (q) {
      const like = `%${q}%`;
      const { data, error } = await supabase
        .from("sales")
        .select("unit_price, distributor_amount, extra_subsidy, cash_support_amount")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .or(`customer_name.ilike.${like},phone.ilike.${like}`);
      if (error) return;
      const rows = data ?? [];
      const totalRebate = rows.reduce((s, r) => s + (r.unit_price ?? 0), 0);
      const totalOffer = rows.reduce((s, r) => s + (r.distributor_amount ?? 0) + (r.extra_subsidy ?? 0) + (r.cash_support_amount ?? 0), 0);
      setDbSummary({ count: rows.length, totalRebate, totalOffer, totalProfit: totalRebate - totalOffer });
    } else {
      // No search: aggregate all rows in the period
      const { data, error } = await supabase
        .from("sales")
        .select("unit_price, distributor_amount, extra_subsidy, cash_support_amount")
        .gte("open_date", startDate)
        .lte("open_date", endDate);
      if (error) return;
      const rows = data ?? [];
      const totalRebate = rows.reduce((s, r) => s + (r.unit_price ?? 0), 0);
      const totalOffer = rows.reduce((s, r) => s + (r.distributor_amount ?? 0) + (r.extra_subsidy ?? 0) + (r.cash_support_amount ?? 0), 0);
      setDbSummary({ count: rows.length, totalRebate, totalOffer, totalProfit: totalRebate - totalOffer });
    }
    // Unpaid/unreturned counts
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
  }, [searchQ, startDate, endDate]);

  const summary = dbSummary;

  // Animated values for summary cards
  const animCount = useAnimatedNumber(summary.count);
  const animRebate = useAnimatedNumber(summary.totalRebate);
  const animOffer = useAnimatedNumber(summary.totalOffer);
  const animProfit = useAnimatedNumber(summary.totalProfit);

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

  // Track which fields were auto-filled from product defaults
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());

  const set = <K extends keyof SaleRow>(k: K, v: SaleRow[K] | undefined) =>
    setForm((f) => {
      // Clear auto-filled marker when user manually changes a field
      if (autoFilledFields.has(k)) {
        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete(k); return n; });
      }
      return { ...f, [k]: v };
    });

  const num = (v: unknown) => {
    if (v === "" || v == null) return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const load = async () => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from("sales")
      .select("*", { count: "exact" })
      .gte("open_date", startDate)
      .lte("open_date", endDate);
    if (statusFilter) {
      query = query.in("status", [statusFilter, ...(statusFilter === "개통대기" ? ["접수완료"] : [])]);
    }
    const { data, error, count } = await query
      .order("open_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      toast.error("목록 불러오기 실패", { description: error.message });
      return;
    }
    setRows((data ?? []) as SaleRow[]);
    setTotal(count ?? 0);
  };

  useEffect(() => {
    load();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate, statusFilter]);

  // Re-fetch summary when search changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => loadSummary(searchQ), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQ, startDate, endDate]);

  useEffect(() => {
    setPage(0);
  }, [startDate, endDate]);

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
    // 지원금이 1원이라도 있는 행만 (또는 미수금/현금개통/상품권 발생 건도 포함)
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

  const reset = () => {
    setForm(emptyForm);
    setCustomFields({});
    setPendingItems([]);
    setPendingNote("");
    setPendingResolved(true);
    setEditingId(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const baseNumeric = {
      unit_price: num(form.unit_price),
      vas_fee: num(form.vas_fee),
      receivable_amount: num(form.receivable_amount),
      distributor_amount: num(form.distributor_amount),
      extra_subsidy: num(form.extra_subsidy),
      cash_support_amount: num(form.cash_support_amount),
    };
    const payload = {
      ...form,
      created_by: user.id,
      ...baseNumeric,
      // 관리자가 정의한 수식으로 자동 계산 (사용자 입력값이 있으면 우선)
      net_fee: form.net_fee != null && form.net_fee !== 0
        ? num(form.net_fee)
        : calcNetFee(baseNumeric),
      custom_fields: customFields,
      pending_items: pendingItems,
      pending_note: pendingNote || null,
      pending_resolved: pendingItems.length === 0 ? true : pendingResolved,
    };
    try {
      if (editingId) {
        const { error } = await supabase.from("sales").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("수정 완료");
      } else {
        const { data: inserted, error } = await supabase.from("sales").insert(payload).select("id").single();
        if (error) throw error;
        // 인입 → 실적 자동 연결
        if (linkedInquiryId && inserted?.id) {
          await supabase
            .from("inquiries")
            .update({ status: "개통완료", converted_sale_id: inserted.id })
            .eq("id", linkedInquiryId);
          setLinkedInquiryId(null);
        }
        toast.success("판매 실적 저장 완료", { description: "대시보드에 즉시 반영됩니다." });
      }
      reset();
      load();
    } catch (err) {
      toast.error("저장 실패", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const onEdit = (r: SaleRow) => {
    setEditingId(r.id);
    setForm(r);
    setCustomFields(((r as any).custom_fields as Record<string, any>) ?? {});
    setPendingItems(((r as any).pending_items as string[]) ?? []);
    setPendingNote(((r as any).pending_note as string) ?? "");
    setPendingResolved(((r as any).pending_resolved as boolean) ?? true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // === 매핑 엔진 업로드 ===
  const targets: MappingTarget[] = [
    ...SALES_COLUMNS.map(([k, l]) => ({ field_key: k, label: l })),
    ...dynamicFields.map((f) => ({ field_key: `custom_fields.${f.field_key}`, label: f.label })),
  ];

  // 검증 규칙 — 필수/형식 정의
  const SALES_RULES: FieldRule[] = useMemo(() => [
    { field_key: "channel", label: "인입경로", required: true },
    { field_key: "manager", label: "담당자", required: true },
    { field_key: "customer_name", label: "고객명", required: true },
    { field_key: "open_date", label: "개통일", type: "date" },
    { field_key: "birth_date", label: "생년월일" },
    { field_key: "unit_price", label: "단가표 기준", type: "number" },
    { field_key: "vas_fee", label: "부가서비스 수수료", type: "number" },
    { field_key: "receivable_amount", label: "금액", type: "number" },
    { field_key: "distributor_amount", label: "유통망", type: "number" },
    { field_key: "extra_subsidy", label: "추가지원금", type: "number" },
    { field_key: "cash_support_amount", label: "입금금액", type: "number" },
    { field_key: "net_fee", label: "수수료", type: "number" },
    { field_key: "moyo_excluded", label: "모요 미적용", type: "boolean" },
    { field_key: "cash_open", label: "현금개통", type: "boolean" },
  ], []);

  // 위저드 열기 (단일 진입점) — '기본 양식 업로드' 버튼이 호출
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardFile, setWizardFile] = useState<File | null>(null);

  const onMappingFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setWizardFile(f);
    setWizardOpen(true);
    if (mappingFileRef.current) mappingFileRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  };

  // 위저드 commit — 검증 통과한 행을 sales에 insert
  const handleWizardCommit = async (rows: Record<string, any>[]): Promise<void> => {
    if (!user || rows.length === 0) return;
    const records = rows.map((r) => {
      const custom: Record<string, any> = r.custom_fields ?? {};
      const base: Record<string, any> = { created_by: user.id };
      for (const [k, v] of Object.entries(r)) {
        if (k === "custom_fields") continue;
        if (k.startsWith("custom_fields.")) {
          custom[k.slice("custom_fields.".length)] = v;
        } else {
          base[k] = v;
        }
      }
      if (base.net_fee == null || base.net_fee === 0) base.net_fee = calcNetFee(base);
      base.custom_fields = custom;
      return base;
    });
    const chunk = 200;
    for (let i = 0; i < records.length; i += chunk) {
      const { error } = await supabase.from("sales").insert(records.slice(i, i + chunk) as any);
      if (error) throw error;
    }
    load();
  };

  const handleMappingConfirm = async (mapped: Record<string, any>[]): Promise<void> => {
    if (!user) return;
    const records = mapped
      .filter((r) => Object.values(r).some((v) => v !== "" && v != null))
      .map((r) => {
        const custom: Record<string, any> = {};
        const base: Record<string, any> = { created_by: user.id };
        for (const [k, v] of Object.entries(r)) {
          if (k.startsWith("custom_fields.")) {
            custom[k.slice("custom_fields.".length)] = v;
          } else {
            base[k] = v;
          }
        }
        // 숫자 컬럼 변환
        ["unit_price", "vas_fee", "receivable_amount", "distributor_amount", "extra_subsidy", "cash_support_amount", "net_fee"].forEach((k) => {
          if (base[k] != null) base[k] = num(base[k]);
        });
        if (base.net_fee == null || base.net_fee === 0) base.net_fee = calcNetFee(base);
        base.custom_fields = custom;
        return base;
      });
    if (!records.length) {
      toast.error("등록할 데이터가 없습니다");
      return;
    }
    const chunk = 200;
    for (let i = 0; i < records.length; i += chunk) {
      const { error } = await supabase.from("sales").insert(records.slice(i, i + chunk) as any);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success(`${records.length}건 등록되었습니다`);
    load();
  };

  const onDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠어요?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) return toast.error("삭제 실패", { description: error.message });
    toast.success("삭제 완료");
    load();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("sales").delete().in("id", ids);
    if (error) return toast.error("선택 삭제 실패", { description: error.message });
    toast.success(`${ids.length}건 삭제 완료`);
    setSelected(new Set());
    load();
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
  };

  // === 양식 샘플 다운로드 (관리자가 편집 — app_settings.sales_excel_template) ===
  const TEMPLATE_KEY = "sales_excel_template";
  const FALLBACK_HEADERS = [
    "번호","인입경로","모요\n미적용","담당자","개통년월","가입상품","판매유형","동판/번들",
    "개통방식","최종상태","개통일자","고객명","생년월일","연락처",
    "단말기","일련번호","USIM","일련번호.1","개통요금제",
    "부가서비스.1","부가서비스.2","단가표 기준","부가서비스 수수료",
    "상품권\n*반납시 작성","반납\n유/무","금액","입금\n유/무",
    "현금개통","유통망","추가지원금","입금금액","은행","입금계좌","예금주",
    "수수료","발송유형","운송장","특이사항",
  ];
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);

  const downloadTemplate = async () => {
    try {
      // 항상 최신본을 가져오기 위해 캐시 우회 (updated_at 함께 조회)
      const { data, error } = await supabase
        .from("app_settings")
        .select("value, updated_at")
        .eq("key", TEMPLATE_KEY)
        .maybeSingle();
      if (error) throw error;
      const tpl: any = data?.value ?? {
        sheet_name: "실적장표",
        guide: "실적장표 — 이 행은 안내용입니다 (삭제하지 마세요). 데이터는 3행부터 입력하세요.",
        headers: FALLBACK_HEADERS.map((k) => ({ key: k, example: "" })),
      };
      const savedHeaders: { key: string; example: any }[] = Array.isArray(tpl.headers)
        ? tpl.headers
        : [];
      const savedKeys = new Set(savedHeaders.map((h) => h.key));
      const mergedHeaders = [
        ...savedHeaders,
        ...FALLBACK_HEADERS.filter((key) => !savedKeys.has(key)).map((key) => ({ key, example: "" })),
      ];
      const headers: { key: string; example: any }[] =
        mergedHeaders.length > 0 ? mergedHeaders : FALLBACK_HEADERS.map((k) => ({ key: k, example: "" }));
      const wb = XLSX.utils.book_new();
      const aoa: any[][] = [
        [tpl.guide ?? ""],
        headers.map((h) => h.key),
        headers.map((h) => h.example ?? ""),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = headers.map(() => ({ wch: 14 }));
      XLSX.utils.book_append_sheet(wb, ws, tpl.sheet_name ?? "실적장표");
      XLSX.writeFile(wb, `실적장표_양식샘플_${new Date().toISOString().slice(0, 10)}.xlsx`);
      const verLabel = data?.updated_at
        ? new Date(data.updated_at).toLocaleString("ko-KR")
        : "기본값";
      toast.success(`양식 샘플 다운로드 완료 (${headers.length}개 컬럼)`, {
        description: `최신 저장본: ${verLabel} · 3행부터 입력 후 '기본 양식 업로드'로 올려주세요.`,
      });
    } catch (e) {
      toast.error("양식 다운로드 실패", { description: e instanceof Error ? e.message : String(e) });
    }
  };


  // === 엑셀 업로드 ===
  const handleFile = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 헤더가 2행에 있어 range:1로 두 번째 행을 헤더로 사용
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        range: 1,
        defval: null,
      });

      const pick = (r: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) {
          if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
        }
        return null;
      };
      const toNum = (v: unknown) => {
        if (v == null || v === "") return 0;
        const n = Number(String(v).replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };
      const toBool = (v: unknown) => {
        if (typeof v === "boolean") return v;
        const s = String(v ?? "").trim();
        return ["O", "o", "Y", "y", "유", "예", "true", "1"].includes(s);
      };
      const toDate = (v: unknown): string | null => {
        if (!v) return null;
        if (typeof v === "number") {
          // Excel serial date
          const d = XLSX.SSF.parse_date_code(v);
          if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        }
        const s = String(v).trim();
        // "04월 10일"
        const m = s.match(/(\d{1,2})월\s*(\d{1,2})일/);
        if (m) {
          const y = new Date().getFullYear();
          return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
        }
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
      };

      const records = json
        .filter((r) => pick(r, "고객명", "인입경로", "담당자"))
        .map((r) => ({
          created_by: user.id,
          seq: pick(r, "번호", "No", "no") ? Number(pick(r, "번호", "No", "no")) : null,
          channel: pick(r, "인입경로") as string | null,
          moyo_excluded: toBool(pick(r, "모요\n미적용", "모요 미적용", "모요미적용")),
          manager: pick(r, "담당자") as string | null,
          open_month: pick(r, "개통년월") ? String(pick(r, "개통년월")) : null,
          product: pick(r, "가입상품") as string | null,
          sale_type: pick(r, "판매유형") as string | null,
          bundle: pick(r, "동판/번들") as string | null,
          open_method: pick(r, "개통방식") as string | null,
          status: (pick(r, "최종상태") as string) || "개통완료",
          open_date: toDate(pick(r, "개통일자")),
          customer_name: pick(r, "고객명") as string | null,
          birth_date: pick(r, "생년월일") ? String(pick(r, "생년월일")) : null,
          phone: pick(r, "연락처") as string | null,
          device_model: pick(r, "단말기") as string | null,
          device_serial: pick(r, "일련번호") ? String(pick(r, "일련번호")) : null,
          usim_model: pick(r, "USIM") as string | null,
          usim_serial: pick(r, "일련번호.1", "일련번호_1") ? String(pick(r, "일련번호.1", "일련번호_1")) : null,
          rate_plan: pick(r, "개통요금제") as string | null,
          vas1: pick(r, "부가서비스.1", "부가서비스1") as string | null,
          vas2: pick(r, "부가서비스.2", "부가서비스2") as string | null,
          unit_price: toNum(pick(r, "단가표 기준", "단가표기준")),
          vas_fee: toNum(pick(r, "부가서비스 수수료", "VAS 수수료", "VAS수수료")),
          voucher: pick(r, "상품권\n*반납시 작성", "상품권") ? String(pick(r, "상품권\n*반납시 작성", "상품권")) : null,
          voucher_returned: pick(r, "반납\n유/무", "반납 유/무", "반납유무") as string | null,
          receivable_amount: toNum(pick(r, "금액")),
          receivable_paid: pick(r, "입금\n유/무", "입금 유/무") as string | null,
          cash_open: toBool(pick(r, "현금개통")),
          distributor_amount: toNum(pick(r, "유통망")),
          extra_subsidy: toNum(pick(r, "추가지원금")),
          cash_support_amount: toNum(pick(r, "입금금액")),
          cash_bank: pick(r, "은행") as string | null,
          cash_account: pick(r, "입금계좌") as string | null,
          cash_holder: pick(r, "예금주") as string | null,
          net_fee: toNum(pick(r, "수수료")),
          delivery_type: pick(r, "발송유형") as string | null,
          tracking_no: pick(r, "운송장") ? String(pick(r, "운송장")) : null,
          note: pick(r, "특이사항") as string | null,
        }));

      if (!records.length) {
        toast.error("불러올 행이 없습니다", { description: "엑셀 헤더가 '실적장표' 형식인지 확인하세요." });
        return;
      }

      // 청크 단위로 insert
      const chunk = 200;
      for (let i = 0; i < records.length; i += chunk) {
        const { error } = await supabase.from("sales").insert(records.slice(i, i + chunk));
        if (error) throw error;
      }
      toast.success(`엑셀 업로드 완료`, { description: `${records.length}건이 저장되었습니다.` });
      load();
    } catch (err) {
      toast.error("엑셀 업로드 실패", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Header title="실적 입력 / 원장" subtitle="엑셀 '실적장표' 시트와 동일한 모든 항목을 1건 단위로 저장합니다" showScopeToggle={false} showPeriodFilter />

      {/* 엑셀 업로드 */}
      <section className="glass rounded-2xl p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-card-elevated">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
            <FileSpreadsheet className="size-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              엑셀 일괄 업로드
              <span className="text-[10px] font-normal text-muted-foreground">{lastUpdated.text}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              '실적장표' 시트(.xlsx)를 그대로 업로드하면 모든 행이 자동 저장됩니다.
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={mappingFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={onMappingFile}
          />
          <Button
            type="button"
            onClick={() => quickExport.exportNow("sales", { start_date: startDate, end_date: endDate })}
            disabled={busy || quickExport.busy === "sales"}
            variant="outline"
            className="rounded-xl"
            title="현재 적용된 기간 필터로 즉시 엑셀 추출"
          >
            <Download className="size-4 mr-2" />
            {quickExport.busy === "sales" ? "생성 중…" : "현재 필터로 다운로드"}
          </Button>
          <Button
            type="button"
            onClick={downloadTemplate}
            disabled={busy}
            variant="outline"
            className="rounded-xl border-primary/40 text-primary-glow hover:bg-primary/10"
          >
            <Download className="size-4 mr-2" />
            양식 샘플 다운로드
          </Button>
          {isAdmin && (
            <Button
              type="button"
              onClick={() => setTemplateEditorOpen(true)}
              disabled={busy}
              variant="outline"
              className="rounded-xl"
            >
              <Pencil className="size-4 mr-2" />
              양식 편집
            </Button>
          )}
          <Button
            type="button"
            onClick={() => mappingFileRef.current?.click()}
            disabled={busy}
            variant="outline"
            className="rounded-xl border-primary/40 text-primary-glow hover:bg-primary/10"
          >
            <Sparkles className="size-4 mr-2" />
            엑셀 업로드 (스마트 매핑 + 검증)
          </Button>
          <Button
            type="button"
            onClick={handleExportOffers}
            disabled={busy}
            variant="outline"
            className="rounded-xl border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
          >
            <Download className="size-4 mr-2" />
            오퍼(지원금) 다운로드
          </Button>
        </div>
      </section>

      {/* 입력 폼 */}
      <form onSubmit={onSubmit} className="space-y-5 pb-10">
        <FormSection title="기본 정보" icon={<Zap className="size-3" />}>
          <Grid cols={3}>
            <Field label="인입경로 *">
              <Select value={form.channel ?? ""} onValueChange={(v) => set("channel", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="담당자 *">
              <Input value={form.manager ?? ""} onChange={(e) => set("manager", e.target.value)} className="h-11 bg-input/60" required />
            </Field>
            <Field label="개통년월">
              <Input value={form.open_month ?? ""} onChange={(e) => set("open_month", e.target.value)} placeholder="2026. 4. 10" className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <div className="flex items-center gap-3 pt-2">
            <Switch checked={!!form.moyo_excluded} onCheckedChange={(v) => set("moyo_excluded", v)} />
            <Label className="text-xs">모요 미적용</Label>
          </div>
        </FormSection>

        <FormSection title="가입 정보">
          <Grid cols={3}>
            <Field label="가입상품 *">
              <Select
                value={form.product ?? ""}
                onValueChange={(v) => {
                  // 상품 변경 시, 기존 요금제가 새 상품 매핑에 없으면 초기화
                  setForm((f) => {
                    const allowed = getPlansForProduct(v);
                    const keepRate =
                      !f.rate_plan || allowed.length === 0 || allowed.includes(f.rate_plan);
                    return { ...f, product: v, rate_plan: keepRate ? f.rate_plan : null };
                  });
                  // Auto-fill defaults from product master
                  const defaults = getDefaultsForProduct(v);
                  if (defaults) {
                    const filled = new Set<string>();
                    setForm((f) => {
                      const updates: Partial<SaleRow> = {};
                      if (defaults.default_sale_type && !f.sale_type) {
                        updates.sale_type = defaults.default_sale_type;
                        filled.add("sale_type");
                      }
                      if (defaults.default_vas1 && !f.vas1) {
                        updates.vas1 = defaults.default_vas1;
                        filled.add("vas1");
                      }
                      if (defaults.default_vas2 && !f.vas2) {
                        updates.vas2 = defaults.default_vas2;
                        filled.add("vas2");
                      }
                      return { ...f, ...updates };
                    });
                    setAutoFilledFields(filled);
                  }
                }}
              >
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="판매유형 *">
              {(() => {
                const allowed = getAllowedSaleTypes(form.product);
                const types = allowed.length > 0 ? SALE_TYPES.filter((s) => allowed.includes(s)) : SALE_TYPES;
                const defaults = getDefaultsForProduct(form.product);
                const mismatch = defaults?.default_sale_type && form.sale_type && form.sale_type !== defaults.default_sale_type && !autoFilledFields.has("sale_type");
                return (
                  <div>
                    <Select value={form.sale_type ?? ""} onValueChange={(v) => set("sale_type", v)}>
                      <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>{types.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    {mismatch && (
                      <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                        <AlertTriangle className="size-3" /> 기본 설정({defaults.default_sale_type})과 다릅니다
                      </p>
                    )}
                  </div>
                );
              })()}
            </Field>
            <Field label="개통방식">
              <Select value={form.open_method ?? ""} onValueChange={(v) => set("open_method", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{OPEN_METHODS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="최종상태">
              <Select value={form.status ?? "개통완료"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="개통일자">
              <Input type="date" value={form.open_date ?? ""} onChange={(e) => set("open_date", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="동판/번들">
              <Input value={form.bundle ?? ""} onChange={(e) => set("bundle", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="고객명 *">
              <Input value={form.customer_name ?? ""} onChange={(e) => set("customer_name", e.target.value)} className="h-11 bg-input/60" required />
            </Field>
            <Field label="생년월일">
              <Input value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} placeholder="900101" className="h-11 bg-input/60" />
            </Field>
            <Field label="연락처">
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" className="h-11 bg-input/60" />
            </Field>
          </Grid>
          {/* 가입번호 + 간단 메모 */}
          <Grid cols={2}>
            <Field label="가입 번호">
              <Input
                value={customFields.subscription_no ?? ""}
                onChange={(e) => setCustomFields((f) => ({ ...f, subscription_no: e.target.value }))}
                placeholder="010-0000-0000"
                className="h-11 bg-input/60"
                maxLength={13}
              />
            </Field>
            <Field label="간단 메모">
              <Input
                value={customFields.quick_memo ?? ""}
                onChange={(e) => setCustomFields((f) => ({ ...f, quick_memo: e.target.value }))}
                placeholder="메모 입력"
                className="h-11 bg-input/60"
                maxLength={100}
              />
            </Field>
          </Grid>
          <Grid cols={2}>
            <Field label="단말기">
              <ModelAutocomplete
                value={form.device_model ?? ""}
                onChange={(v) => set("device_model", v)}
                placeholder="942 / S26 / SM-S942N 등"
              />
            </Field>
            <Field label="단말 일련번호">
              <Input value={form.device_serial ?? ""} onChange={(e) => set("device_serial", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="USIM">
              <Input value={form.usim_model ?? ""} onChange={(e) => set("usim_model", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="USIM 일련번호">
              <Input value={form.usim_serial ?? ""} onChange={(e) => set("usim_serial", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="개통요금제">
              {(() => {
                const mapped = getPlansForProduct(form.product);
                const plans = mapped.length > 0 ? mapped : RATE_PLANS;
                const placeholder = !form.product
                  ? "가입상품을 먼저 선택하세요"
                  : mapped.length === 0
                    ? "전체 요금제 (매핑 미설정)"
                    : "선택";
                return (
                  <Select value={form.rate_plan ?? ""} onValueChange={(v) => set("rate_plan", v)}>
                    <SelectTrigger className="h-11 bg-input/60">
                      <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </Field>
          </Grid>
          {/* 부가서비스 - 조건부 렌더링 */}
          {(() => {
            const defaults = getDefaultsForProduct(form.product);
            const vasRequired = defaults?.vas_required ?? true;
            if (!vasRequired && form.product) return (
              <div className="text-xs text-muted-foreground italic px-1 py-2">
                이 상품은 부가서비스 입력이 필요하지 않습니다
              </div>
            );
            return (
              <div className={cn(
                "transition-all duration-300 ease-out overflow-hidden",
                form.product && vasRequired ? "max-h-[200px] opacity-100" : !form.product ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
              )}>
                <Grid cols={2}>
                  <Field label="부가서비스 1 (주셋톱)">
                    {(() => {
                      const mismatch = defaults?.default_vas1 && form.vas1 && form.vas1 !== defaults.default_vas1 && !autoFilledFields.has("vas1");
                      const locked = defaults?.vas1_locked && defaults?.default_vas1;
                      return (
                        <div>
                          <Input
                            value={form.vas1 ?? ""}
                            onChange={(e) => set("vas1", e.target.value)}
                            className={cn("h-11 bg-input/60", locked && "opacity-70 cursor-not-allowed")}
                            readOnly={!!locked}
                          />
                          {locked && (
                            <p className="text-[10px] text-muted-foreground mt-1">🔒 자동 설정됨 (수정 불가)</p>
                          )}
                          {!locked && mismatch && (
                            <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> 기본 설정({defaults?.default_vas1})과 다릅니다
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </Field>
                  <Field label="부가서비스 2 (부셋톱)">
                    {(() => {
                      const mismatch = defaults?.default_vas2 && form.vas2 && form.vas2 !== defaults.default_vas2 && !autoFilledFields.has("vas2");
                      const locked = defaults?.vas2_locked && defaults?.default_vas2;
                      return (
                        <div>
                          <Input
                            value={form.vas2 ?? ""}
                            onChange={(e) => set("vas2", e.target.value)}
                            className={cn("h-11 bg-input/60", locked && "opacity-70 cursor-not-allowed")}
                            readOnly={!!locked}
                          />
                          {locked && (
                            <p className="text-[10px] text-muted-foreground mt-1">🔒 자동 설정됨 (수정 불가)</p>
                          )}
                          {!locked && mismatch && (
                            <p className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> 기본 설정({defaults?.default_vas2})과 다릅니다
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </Field>
                </Grid>
              </div>
            );
          })()}
        </FormSection>

        <FormSection title="수익성 / 단가">
          <Grid cols={4}>
            <Field label="단가표 기준 (₩)">
              <MoneyInput value={form.unit_price} onChange={(v) => set("unit_price", v)} />
            </Field>
            <Field label="부가서비스 수수료 (₩)">
              <MoneyInput value={form.vas_fee} onChange={(v) => set("vas_fee", v)} />
            </Field>
            <Field label="미수금 (₩)">
              <MoneyInput value={form.receivable_amount} onChange={(v) => set("receivable_amount", v)} />
            </Field>
            <Field label="수급 상태">
              <div className="flex items-center gap-2 h-11">
                <Switch
                  checked={form.receivable_paid === "완료"}
                  onCheckedChange={(v) => set("receivable_paid", v ? "완료" : "미수급")}
                />
                <span className={cn("text-sm font-medium", form.receivable_paid === "완료" ? "text-primary" : "text-destructive")}>
                  {form.receivable_paid === "완료" ? "수급 완료" : "미수급"}
                </span>
              </div>
            </Field>
          </Grid>
          {/* 수익 중복 입력 경고 */}
          {(form.vas_fee ?? 0) > 0 && (form.unit_price ?? 0) > 0 && (form.vas_fee ?? 0) > (form.unit_price ?? 0) && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 mt-2 mb-2 flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>부가서비스 수수료가 단가표 기준보다 높습니다. <strong>수익 중복 입력 여부를 확인하세요.</strong></span>
            </div>
          )}
          {/* 정산 시뮬레이션 */}
          {((form.unit_price ?? 0) > 0 || (form.vas_fee ?? 0) > 0 || (form.distributor_amount ?? 0) > 0) && (
            <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 mt-2 mb-2">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">📊 정산 시뮬레이션</p>
              <div className="text-xs space-y-0.5 font-mono tabular-nums">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">기본 수수료 (단가표)</span>
                  <span>₩{(form.unit_price ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">+ 부가서비스 수수료</span>
                  <span>₩{(form.vas_fee ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-1 mt-1">
                  <span className="text-muted-foreground font-medium">총 수익</span>
                  <span className="text-primary font-semibold">₩{((form.unit_price ?? 0) + (form.vas_fee ?? 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">- 유통망지원금</span>
                  <span className="text-destructive">₩{(form.distributor_amount ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">- 현금지원금</span>
                  <span className="text-destructive">₩{(form.cash_support_amount ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">- 추가보조금</span>
                  <span className="text-destructive">₩{(form.extra_subsidy ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">- 고객입금(반환)</span>
                  <span className="text-destructive">₩{(form.receivable_amount ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-border/30 pt-1 mt-1">
                  <span className="font-semibold">최종 순이익</span>
                  {(() => {
                    const net = (form.unit_price ?? 0) + (form.vas_fee ?? 0) - (form.distributor_amount ?? 0) - (form.cash_support_amount ?? 0) - (form.extra_subsidy ?? 0) - (form.receivable_amount ?? 0);
                    return <span className={`font-bold ${net >= 0 ? "text-primary" : "text-destructive"}`}>₩{net.toLocaleString()}</span>;
                  })()}
                </div>
              </div>
            </div>
          )}
          <Grid cols={4}>
            <Field label="상품권">
              <Select value={form.voucher ?? ""} onValueChange={(v) => set("voucher", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {["신세계", "롯데", "모바일", "기타"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="상품권 금액 (₩)">
              <MoneyInput value={form.extra_subsidy} onChange={(v) => set("extra_subsidy", v)} />
            </Field>
            <Field label="반납 상태">
              <div className="flex items-center gap-2 h-11">
                <Switch
                  checked={form.voucher_returned === "유"}
                  onCheckedChange={(v) => set("voucher_returned", v ? "유" : "무")}
                />
                <span className={cn("text-sm font-medium", form.voucher_returned === "유" ? "text-primary" : "text-destructive")}>
                  {form.voucher_returned === "유" ? "반납 완료" : "미반납"}
                </span>
              </div>
            </Field>
          </Grid>
        </FormSection>

        <FormSection title="오퍼(지원금) 관리" icon={<Wallet className="size-3" />}>
          <p className="text-[11px] text-muted-foreground -mt-2 mb-3">
            아래 3개 항목은 <span className="text-foreground font-medium">지출 대시보드</span>에 자동 집계됩니다.
            숫자만 입력 가능하며 천 단위 콤마가 자동 표시됩니다.
          </p>
          <Grid cols={3}>
            <Field label="① 유통망 지원금 (₩)">
              <MoneyInput
                value={form.distributor_amount}
                onChange={(v) => set("distributor_amount", v)}
              />
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Building2 className="size-3" /> 회사가 유통망 차원에서 지급한 지원금 (지출 합산)
              </div>
            </Field>
            <Field label="② 현금개통 금액 (₩)">
              <MoneyInput
                value={form.cash_support_amount}
                onChange={(v) => {
                  set("cash_support_amount", v);
                  set("cash_open", v > 0);
                }}
              />
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Banknote className="size-3" /> 고객이 기기값을 현금 완납하여 개통한 금액 (현금시재)
              </div>
            </Field>
            <Field label="③ 고객입금 금액 (₩)">
              <MoneyInput
                value={form.receivable_amount}
                onChange={(v) => set("receivable_amount", v)}
              />
              <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Wallet className="size-3" /> 수납·기타 사유로 고객에게 직접 입금받은 금액
              </div>
            </Field>
          </Grid>
          <Grid cols={2}>
            <Field label="입금 유/무 (입금일 또는 표시값)">
              <Input
                value={form.receivable_paid ?? ""}
                onChange={(e) => set("receivable_paid", e.target.value)}
                placeholder="유 / 완료 / 2026-04-19"
                className="h-11 bg-input/60"
              />
            </Field>
            <Field label="추가지원금 (₩)">
              <MoneyInput value={form.extra_subsidy} onChange={(v) => set("extra_subsidy", v)} />
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="은행">
              <Select value={form.cash_bank ?? ""} onValueChange={(v) => set("cash_bank", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="입금계좌">
              <Input value={form.cash_account ?? ""} onChange={(e) => set("cash_account", e.target.value)} className="h-11 bg-input/60" />
            </Field>
            <Field label="예금주">
              <Input value={form.cash_holder ?? ""} onChange={(e) => set("cash_holder", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>

          {/* 법인카드 결제 */}
          <div className="border-t border-border/30 pt-4 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="size-4 text-primary" />
              <span className="text-sm font-semibold">법인카드 결제</span>
              <Switch
                checked={customFields.card_payment === true}
                onCheckedChange={(v) => {
                  setCustomFields((f) => ({
                    ...f,
                    card_payment: v,
                    ...(v ? {} : { card_company: "", card_last4: "", card_amount: 0 }),
                  }));
                }}
              />
            </div>
            {customFields.card_payment && (
              <div className="animate-fade-in">
                <Grid cols={3}>
                  <Field label="카드사">
                    <Select
                      value={customFields.card_company ?? ""}
                      onValueChange={(v) => setCustomFields((f) => ({ ...f, card_company: v }))}
                    >
                      <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        {["국민", "신한", "현대", "삼성", "롯데", "하나", "우리", "BC", "NH농협"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="카드 뒷 4자리">
                    <Input
                      value={customFields.card_last4 ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setCustomFields((f) => ({ ...f, card_last4: v }));
                      }}
                      placeholder="0000"
                      maxLength={4}
                      className="h-11 bg-input/60 tabular-nums"
                    />
                  </Field>
                  <Field label="카드 결제금액 (₩)">
                    <MoneyInput
                      value={customFields.card_amount ?? 0}
                      onChange={(v) => setCustomFields((f) => ({ ...f, card_amount: v }))}
                    />
                  </Field>
                </Grid>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="최종 / 배송">
          <Grid cols={3}>
            <Field label="발송유형">
              <Select value={form.delivery_type ?? ""} onValueChange={(v) => set("delivery_type", v)}>
                <SelectTrigger className="h-11 bg-input/60"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{DELIVERY_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="운송장">
              <Input value={form.tracking_no ?? ""} onChange={(e) => set("tracking_no", e.target.value)} className="h-11 bg-input/60" />
            </Field>
          </Grid>
          <Field label="특이사항">
            <Textarea value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} rows={2} className="bg-input/60" />
          </Field>
        </FormSection>

        {/* 미처리 항목 */}
        <FormSection title="미처리 항목" icon={<AlertTriangle className="size-3" />}>
          <PendingItemsEditor
            items={pendingItems}
            note={pendingNote}
            resolved={pendingResolved}
            onItemsChange={setPendingItems}
            onNoteChange={setPendingNote}
            onResolvedChange={setPendingResolved}
            showResolvedToggle={!!editingId}
          />
        </FormSection>

        {/* 관리자 동적 필드 */}
        {dynamicFields.length > 0 && (
          <FormSection title="추가 항목 (관리자 정의)">
            <Grid cols={3}>
              <DynamicFieldRenderer
                fields={dynamicFields}
                values={customFields}
                onChange={setCustomFields}
              />
            </Grid>
          </FormSection>
        )}

        {/* 가입 서류 — 저장된 실적에 한해 업로드 가능 */}
        {editingId ? (
          <FormSection title="가입 서류" icon={<Upload className="size-3" />}>
            <SaleDocuments
              saleId={editingId}
              saleMeta={{
                open_date: form.open_date as string | null | undefined,
                customer_name: form.customer_name as string | null | undefined,
              }}
            />
          </FormSection>
        ) : (
          <div className="rounded-xl border border-dashed border-border/40 p-3 text-center text-xs text-muted-foreground">
            💡 가입 서류는 실적을 먼저 저장한 뒤 수정 모드에서 업로드할 수 있습니다.
          </div>
        )}

        <div className="text-[11px] text-muted-foreground text-right -mb-2">
          수익 자동계산 수식: <code className="font-mono text-primary/80">{netFeeFormula}</code>
        </div>

        <div className="flex gap-3">
          {editingId && (
            <Button type="button" variant="outline" onClick={reset} className="h-12 rounded-2xl">
              <X className="size-4 mr-2" /> 취소
            </Button>
          )}
          <Button type="submit" disabled={busy} className="flex-1 h-12 bg-gradient-primary shadow-glow rounded-2xl text-base font-semibold">
            <Check className="size-5 mr-2" /> {editingId ? "수정 저장" : "판매 1건 저장"}
          </Button>
        </div>
      </form>

      <ExcelUploadWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        tableName="sales"
        templateKey={TEMPLATE_KEY}
        file={wizardFile}
        targets={targets}
        rules={SALES_RULES}
        onCommit={handleWizardCommit}
      />

      <ExcelTemplateEditor
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        settingKey={TEMPLATE_KEY}
        title="실적 엑셀 양식 편집"
        defaultHeaders={FALLBACK_HEADERS}
        defaultSheetName="실적장표"
        defaultGuide="실적장표 — 이 행은 안내용입니다 (삭제하지 마세요). 데이터는 3행부터 입력하세요."
      />

      {/* 최근 판매 원장 */}
      <section className="glass-strong rounded-2xl p-5 md:p-6 shadow-card-elevated">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-semibold">판매 원장 — {periodLabel}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              개통일 기준 · 본인 입력 건만 수정·삭제 가능 · <span className="text-foreground/80">최종 수익 = 리베이트 단가 − 오퍼(지원금)</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport} className="rounded-xl gap-2">
              <Download className="size-4" /> 엑셀로 내보내기
            </Button>
            <Badge className="bg-primary/15 text-primary-glow border-primary/30">총 {summary.count.toLocaleString()}건</Badge>
          </div>
        </div>

        {/* 통합 검색 + 관리자 삭제 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {statusFilter && (
            <Badge
              variant="outline"
              className="border-warning/40 text-warning bg-warning/10 gap-1 cursor-pointer hover:bg-warning/20"
              onClick={() => setStatusFilter(null)}
            >
              필터: {statusFilter} ✕
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn(
              "gap-1 cursor-pointer transition-colors",
              quickFilter === "unpaid"
                ? "border-destructive/60 text-destructive bg-destructive/15"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
            onClick={() => setQuickFilter(quickFilter === "unpaid" ? null : "unpaid")}
          >
            💰 미수금 건
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 cursor-pointer transition-colors",
              quickFilter === "unreturned"
                ? "border-destructive/60 text-destructive bg-destructive/15"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
            onClick={() => setQuickFilter(quickFilter === "unreturned" ? null : "unreturned")}
          >
            🎫 상품권 미반납
          </Badge>
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="고객 성함 또는 연락처 뒷자리 검색…"
              className="h-10 pl-9 bg-input/60"
            />
          </div>
          {isAdmin && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selected.size === 0}
                    className="rounded-xl gap-2 border-destructive/40 text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4" /> 선택 삭제 ({selected.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <ShieldAlert className="size-5 text-destructive" /> 선택한 {selected.size}건을 삭제합니다
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      이 작업은 되돌릴 수 없으며 관련 검수·서류 정보도 함께 영향을 받을 수 있습니다.
                    </AlertDialogDescription>
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

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm"
                    className="rounded-xl gap-2 border-destructive/60 text-destructive hover:bg-destructive/15">
                    <ShieldAlert className="size-4" /> 전체 데이터 삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <ShieldAlert className="size-5 text-destructive" /> 정말로 모든 데이터를 삭제하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      현재 기간({periodLabel})의 <strong className="text-destructive">{total.toLocaleString()}건</strong> 모든 판매 데이터가 영구 삭제됩니다.
                      이 작업은 되돌릴 수 없습니다.
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
            </>
          )}
        </div>

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
          <SummaryCard
            icon={Banknote}
            label="미수금 건"
            value={`${unpaidCount}건`}
            accent={unpaidCount > 0 ? "destructive" : "primary"}
          />
          <SummaryCard
            icon={Gift}
            label="상품권 미반납"
            value={`${unreturnedCount}건`}
            accent={unreturnedCount > 0 ? "destructive" : "primary"}
          />
        </div>

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
                <th className="text-right px-3 py-2 font-medium">리베이트 단가</th>
                <th className="text-right px-3 py-2 font-medium">오퍼(지원금)</th>
                <th className="text-right px-3 py-2 font-medium">최종 수익</th>
                <th className="text-right px-3 py-2 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const mine = r.created_by === user?.id;
                const hasPending = (r.pending_items?.length ?? 0) > 0 && r.pending_resolved === false;
                const offer = offerOf(r);
                const profit = profitOf(r);
                const negative = profit < 0;
                return (
                  <tr key={r.id} className={cn(
                    "border-b border-border/20 hover:bg-white/[0.03]",
                    mine && "bg-primary/[0.04]",
                    hasPending && "bg-amber-500/[0.07] hover:bg-amber-500/[0.12]"
                  )}>
                    {isAdmin && (
                      <td className="px-3 py-2.5">
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label={`${r.customer_name ?? ""} 선택`}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.channel ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.manager ?? "-"}</td>
                    <td className="px-3 py-2.5">{r.product ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{r.customer_name ?? "-"}</span>
                        {hasPending && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-500/40 text-amber-300 bg-amber-500/10 px-1.5 py-0">
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
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.phone ?? "-"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.device_model ?? "-"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{(r.unit_price ?? 0).toLocaleString("ko-KR")}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-warning">{offer.toLocaleString("ko-KR")}</td>
                    <td className={cn(
                      "px-3 py-2.5 text-right tabular-nums font-semibold",
                      negative ? "text-destructive" : "text-revenue"
                    )}>
                      {profit.toLocaleString("ko-KR")}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {mine ? (
                        <div className="inline-flex gap-1">
                          <button onClick={() => onEdit(r)} className="size-7 rounded-lg grid place-items-center text-primary-glow hover:bg-primary/10">
                            <Pencil className="size-3.5" />
                          </button>
                          <button onClick={() => onDelete(r.id)} className="size-7 rounded-lg grid place-items-center text-destructive hover:bg-destructive/10">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">읽기전용</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr><td colSpan={isAdmin ? 12 : 11} className="text-center py-10 text-muted-foreground">
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

const FormSection = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <section className="glass rounded-2xl p-5 md:p-6 space-y-4 shadow-card-elevated">
    <div className="flex items-center gap-2">
      {icon && <Badge className="bg-gradient-primary text-primary-foreground border-0">{icon}</Badge>}
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
    </div>
    {children}
  </section>
);

const Grid = ({ cols, children }: { cols: 2 | 3 | 4; children: React.ReactNode }) => (
  <div className={cn("grid gap-3", cols === 2 && "grid-cols-1 md:grid-cols-2", cols === 3 && "grid-cols-1 md:grid-cols-3", cols === 4 && "grid-cols-2 md:grid-cols-4")}>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
    {children}
  </div>
);

export default InputPage;
