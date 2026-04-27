import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom"; 
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
import { Check, Upload, Zap, Pencil, X, FileSpreadsheet, Download, Search, Camera, Plus, Trash2, Tv } from "lucide-react";
import { exportToExcel, SALES_COLUMNS, OFFER_COLUMNS } from "@/lib/excelExport";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { useProductRatePlans } from "@/hooks/useProductRatePlans";
import { useEquipmentCatalog } from "@/hooks/useEquipmentCatalog";
import { usePeriod } from "@/contexts/PeriodContext";
import { cn } from "@/lib/utils";
import { useFieldDefinitions } from "@/hooks/useFieldDefinitions";
import { useNetFeeFormula, sumRevenue, sumOffer } from "@/hooks/useNetFeeFormula";
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
import { CreditCard, Smartphone } from "lucide-react";

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
  customer_support_amount: number | null;
  corp_card_amount: number | null;
  tracking_no: string | null;
  note: string | null;
  bundle: string | null;
  pending_items?: string[] | null;
  pending_note?: string | null;
  pending_resolved?: boolean | null;
  trade_in_enabled?: boolean | null;
  trade_in_model?: string | null;
  trade_in_estimate?: number | null;
  trade_in_confirmed?: number | null;
};

const emptyForm: Partial<SaleRow> = {
  status: "개통완료",
  moyo_excluded: false,
  cash_open: false,
  trade_in_enabled: false,
};

const InputPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { options: CHANNELS } = useFieldOptions("channel");
  const { options: PRODUCTS } = useFieldOptions("product");
  const { options: SALE_TYPES } = useFieldOptions("sale_type");
  const { options: OPEN_METHODS } = useFieldOptions("open_method");
  const { options: STATUSES } = useFieldOptions("status");
  const { options: RATE_PLANS } = useFieldOptions("rate_plan");
  const { mappings, getPlansForProduct, getDefaultsForProduct, getAllowedSaleTypes } = useProductRatePlans();
  const { getByCategory: getEquipmentByCategory } = useEquipmentCatalog();
  const { options: DELIVERY_TYPES } = useFieldOptions("delivery_type");
  const { options: BANKS } = useFieldOptions("bank");
  const [form, setForm] = useState<Partial<SaleRow>>(emptyForm);
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [pendingNote, setPendingNote] = useState<string>("");
  const [pendingResolved, setPendingResolved] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [linkedInquiryId, setLinkedInquiryId] = useState<string | null>(null);
  // === 담당자 후보: 시스템에 등록된 active 직원 ===
  const [staffOptions, setStaffOptions] = useState<{ user_id: string; display_name: string; store: string | null }[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, store")
        .eq("status", "active")
        .order("display_name", { ascending: true });
      const list = (data ?? []) as { user_id: string; display_name: string; store: string | null }[];
      setStaffOptions(list);
      // 신규 입력일 때 본인 UID 자동 세팅
      setForm((f) => {
        if (f.manager || !user) return f;
        const me = list.find((p) => p.user_id === user.id);
        return me ? { ...f, manager: me.user_id } : f;
      });
    })();
  }, [user]);
  // 인입 → 실적 자동 채움 (URL 파라미터)
  useEffect(() => {
    const fromInquiry = searchParams.get("from_inquiry");
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

  // 수정 모드: URL ?edit=<id> 로 진입 시 기존 데이터 로드
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    (async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("id", editId)
        .maybeSingle();
      if (error || !data) {
        toast.error("실적 데이터를 불러올 수 없습니다");
        return;
      }
      const s = data as any;
      setEditingId(s.id);
      setForm({
        seq: s.seq,
        channel: s.channel,
        moyo_excluded: s.moyo_excluded ?? false,
        manager: s.manager,
        open_month: s.open_month,
        product: s.product,
        sale_type: s.sale_type,
        open_method: s.open_method,
        status: s.status,
        open_date: s.open_date,
        customer_name: s.customer_name,
        birth_date: s.birth_date,
        phone: s.phone,
        device_model: s.device_model,
        device_serial: s.device_serial,
        usim_model: s.usim_model,
        usim_serial: s.usim_serial,
        rate_plan: s.rate_plan,
        vas1: s.vas1,
        vas2: s.vas2,
        unit_price: s.unit_price ?? 0,
        vas_fee: s.vas_fee ?? 0,
        voucher: s.voucher,
        voucher_returned: s.voucher_returned,
        receivable_amount: s.receivable_amount ?? 0,
        receivable_paid: s.receivable_paid,
        cash_open: s.cash_open ?? false,
        distributor_amount: s.distributor_amount ?? 0,
        extra_subsidy: s.extra_subsidy ?? 0,
        cash_support_amount: s.cash_support_amount ?? 0,
        cash_bank: s.cash_bank,
        cash_account: s.cash_account,
        cash_holder: s.cash_holder,
        net_fee: s.net_fee ?? 0,
        delivery_type: s.delivery_type,
        tracking_no: s.tracking_no,
        note: s.note,
        bundle: s.bundle,
        trade_in_enabled: s.trade_in_enabled ?? false,
        trade_in_model: s.trade_in_model,
        trade_in_estimate: s.trade_in_estimate ?? 0,
        trade_in_confirmed: s.trade_in_confirmed ?? 0,
        customer_support_amount: (s as any).customer_support_amount ?? 0,
        corp_card_amount: (s as any).corp_card_amount ?? 0,
      });
      setCustomFields(s.custom_fields ?? {});
      setPendingItems(Array.isArray(s.pending_items) ? s.pending_items : []);
      setPendingNote(s.pending_note ?? "");
      setPendingResolved(s.pending_resolved ?? true);
      // URL 정리 (edit 파라미터 제거하되 상태 유지)
      setSearchParams({}, { replace: true });
      toast.info("실적 수정 모드", { description: `${s.customer_name ?? "고객"} — 기존 데이터를 불러왔습니다.` });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!customFields.contract_type) {
      toast.error("약정 정보를 선택해주세요", { description: "선택약정 또는 이통사지원금 중 하나를 선택해야 합니다." });
      return;
    }
    setBusy(true);
    const baseNumeric = {
      unit_price: num(form.unit_price),
      vas_fee: num(form.vas_fee),
      receivable_amount: num(form.receivable_amount),
      distributor_amount: num(form.distributor_amount),
      extra_subsidy: num(form.extra_subsidy),
      cash_support_amount: num(form.cash_support_amount),
      trade_in_estimate: num(form.trade_in_estimate),
      trade_in_confirmed: num(form.trade_in_confirmed),
      customer_support_amount: num(form.customer_support_amount),
      corp_card_amount: num(form.corp_card_amount),
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
      trade_in_enabled: !!form.trade_in_enabled,
      trade_in_model: form.trade_in_enabled ? (form.trade_in_model || null) : null,
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
      navigate("/sales-ledger");
    } catch (err) {
      toast.error("저장 실패", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
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
    toast.success("업로드 완료");
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
        ["unit_price", "vas_fee", "receivable_amount", "distributor_amount", "extra_subsidy", "cash_support_amount", "net_fee", "customer_support_amount", "corp_card_amount"].forEach((k) => {
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
    } catch (err) {
      toast.error("엑셀 업로드 실패", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Header title={editingId ? "실적 수정" : "실적 입력 / 원장"} subtitle={editingId ? "기존 데이터를 수정하고 있습니다. 완료 후 '수정 저장'을 눌러주세요." : "엑셀 '실적장표' 시트와 동일한 모든 항목을 1건 단위로 저장합니다"} showScopeToggle={false} showPeriodFilter />

      {editingId && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 flex items-center gap-2 text-sm">
          <Pencil className="size-4 text-warning shrink-0" />
          <span className="font-semibold text-warning">실적 수정 중</span>
          <span className="text-muted-foreground">— 변경 후 하단의 '수정 저장' 버튼을 눌러 반영하세요.</span>
          <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={() => { reset(); navigate("/sales-ledger"); }}>
            <X className="size-3.5 mr-1" /> 수정 취소
          </Button>
        </div>
      )}

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
            className="rounded-xl border-amber-400 text-amber-700 hover:bg-amber-50"
          >
            <Download className="size-4 mr-2" />
            오퍼(지원금) 다운로드
          </Button>
        </div>
      </section>

      {/* 입력 폼 */}
      <form onSubmit={onSubmit} className="space-y-3 pb-8">
        <FormSection title="기본 정보" icon={<Zap className="size-3" />}>
          <Grid cols={4}>
            <Field label="인입경로 *">
              <Select value={form.channel ?? ""} onValueChange={(v) => set("channel", v)}>
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="담당자 *">
              <Select
                value={form.manager ?? ""}
                onValueChange={(v) => set("manager", v)}
              >
                <SelectTrigger className="h-9 bg-input/60 text-xs">
                  <SelectValue placeholder="직원 선택" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {/* 레거시 값(직원 리스트에 없는 기존 텍스트)도 유지해서 보여줌 */}
                  {form.manager && !staffOptions.some((s) => s.user_id === form.manager || s.display_name === form.manager) && (
                    <SelectItem value={form.manager}>
                      {form.manager} <span className="text-muted-foreground text-[10px]">(미등록)</span>
                    </SelectItem>
                  )}
                  {staffOptions.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.display_name}
                      {s.store && <span className="text-muted-foreground text-[10px] ml-1">({s.store})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="개통년월">
              <Input value={form.open_month ?? ""} onChange={(e) => set("open_month", e.target.value)} placeholder="2026. 4. 10" className="h-9 bg-input/60 text-xs" />
            </Field>
            <Field label="옵션">
              <div className="flex items-center gap-2 h-9">
                <Switch checked={!!form.moyo_excluded} onCheckedChange={(v) => set("moyo_excluded", v)} />
                <span className="text-[11px] text-muted-foreground">모요 미적용</span>
              </div>
            </Field>
          </Grid>
        </FormSection>

        <FormSection title="가입 및 기기 정보">
          <Grid cols={6}>
            <Field label="가입상품 *">
              <Select
                value={form.product ?? ""}
                onValueChange={(v) => {
                  setForm((f) => {
                    const allowed = getPlansForProduct(v);
                    const keepRate =
                      !f.rate_plan || allowed.length === 0 || allowed.includes(f.rate_plan);
                    return { ...f, product: v, rate_plan: keepRate ? f.rate_plan : null };
                  });
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
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="판매유형">
              {(() => {
                const allowed = getAllowedSaleTypes(form.product);
                const types = allowed.length > 0 ? SALE_TYPES.filter((s) => allowed.includes(s)) : SALE_TYPES;
                const defaults = getDefaultsForProduct(form.product);
                const mismatch = defaults?.default_sale_type && form.sale_type && form.sale_type !== defaults.default_sale_type && !autoFilledFields.has("sale_type");
                // 유선 상품(인터넷/TV프리/스마트홈)은 판매유형이 의미가 없어 비활성화 + 흐림 처리
                const wiredProducts = ["인터넷", "TV프리", "스마트홈"];
                const isWired = !!form.product && wiredProducts.includes(form.product);
                return (
                  <div className={isWired ? "opacity-50" : ""}>
                    <Select
                      value={form.sale_type ?? ""}
                      onValueChange={(v) => set("sale_type", v)}
                      disabled={isWired}
                    >
                      <SelectTrigger className="h-9 bg-input/60 text-xs">
                        <SelectValue placeholder={isWired ? "해당 없음" : "선택 (선택 사항)"} />
                      </SelectTrigger>
                      <SelectContent>{types.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    {!isWired && mismatch && (
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
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{OPEN_METHODS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="최종상태">
              <Select value={form.status ?? "개통완료"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="개통일자">
              <Input type="date" value={form.open_date ?? ""} onChange={(e) => set("open_date", e.target.value)} className="h-9 bg-input/60 text-xs" />
            </Field>
          </Grid>
          <Grid cols={5}>
            <Field label="고객명 *">
              <Input value={form.customer_name ?? ""} onChange={(e) => set("customer_name", e.target.value)} className="h-9 bg-input/60 text-xs" required />
            </Field>
            <Field label="생년월일">
              <Input value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} placeholder="900101" className="h-9 bg-input/60 text-xs" />
            </Field>
            <Field label="연락처">
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" className="h-9 bg-input/60 text-xs" inputMode="tel" />
            </Field>
            <Field label="가입 번호">
              <Input
                value={customFields.subscription_no ?? ""}
                onChange={(e) => setCustomFields((f) => ({ ...f, subscription_no: e.target.value }))}
                placeholder="010-0000-0000"
                className="h-9 bg-input/60 text-xs" inputMode="tel"
                maxLength={13}
              />
            </Field>
            <Field label="간단 메모">
              <Input
                value={customFields.quick_memo ?? ""}
                onChange={(e) => setCustomFields((f) => ({ ...f, quick_memo: e.target.value }))}
                placeholder="메모 입력"
                className="h-9 bg-input/60 text-xs"
                maxLength={100}
              />
            </Field>
          </Grid>
          {/* 분류 토큰 — 기변타겟C / 청소년 */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <span className="text-[11px] text-muted-foreground font-medium mr-1">분류:</span>
            <button
              type="button"
              onClick={() => setCustomFields((f) => ({ ...f, target_c: !f.target_c }))}
              className={cn(
                "px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all",
                customFields.target_c
                  ? "border-primary bg-primary/15 text-primary shadow-sm"
                  : "border-border/40 text-muted-foreground hover:border-primary/40",
              )}
              aria-pressed={!!customFields.target_c}
            >
              {customFields.target_c ? "✓ " : ""}기변타겟C
            </button>
            <button
              type="button"
              onClick={() => setCustomFields((f) => ({ ...f, is_youth: !f.is_youth }))}
              className={cn(
                "px-3 py-1.5 rounded-full border text-[11px] font-medium transition-all",
                customFields.is_youth
                  ? "border-amber-400 bg-amber-50 text-amber-700 shadow-sm"
                  : "border-border/40 text-muted-foreground hover:border-amber-400/60",
              )}
              aria-pressed={!!customFields.is_youth}
            >
              {customFields.is_youth ? "✓ " : ""}청소년
            </button>
          </div>
          <div className="border-t border-border/30 pt-3 mt-1" />
          <Grid cols={4}>
            <Field label="단말기">
              <ModelAutocomplete
                value={form.device_model ?? ""}
                onChange={(v) => set("device_model", v)}
                placeholder="942 / S26 / SM-S942N 등"
              />
            </Field>
            <Field label="단말 일련번호">
              <div className="flex gap-1.5">
                <Input value={form.device_serial ?? ""} onChange={(e) => set("device_serial", e.target.value)} className="h-9 bg-input/60 text-xs flex-1" inputMode="text" />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 lg:hidden" onClick={() => toast.info("카메라 스캔은 네이티브 앱에서 지원됩니다")}>
                  <Camera className="size-4" />
                </Button>
              </div>
            </Field>
            <Field label="USIM">
              <Input value={form.usim_model ?? ""} onChange={(e) => set("usim_model", e.target.value)} className="h-9 bg-input/60 text-xs" />
            </Field>
            <Field label="USIM 일련번호">
              <div className="flex gap-1.5">
                <Input value={form.usim_serial ?? ""} onChange={(e) => set("usim_serial", e.target.value)} className="h-9 bg-input/60 text-xs flex-1" inputMode="text" />
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 lg:hidden" onClick={() => toast.info("카메라 스캔은 네이티브 앱에서 지원됩니다")}>
                  <Camera className="size-4" />
                </Button>
              </div>
            </Field>
          </Grid>
          {/* 개통요금제 / 할부 / 동판·번들 / 약정 - 한 줄 슬림 배치 */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 md:col-span-5">
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
                    <SelectTrigger className="h-9 bg-input/60 text-xs">
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
            </div>
            <div className="col-span-3 md:col-span-1">
              <Field label="할부(개월)">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="24"
                  className="h-9 bg-input/60 text-xs text-center px-2"
                  value={customFields.installment_months ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "").slice(0, 2);
                    setCustomFields((f) => ({ ...f, installment_months: v }));
                  }}
                />
              </Field>
            </div>
            <div className="col-span-9 md:col-span-3">
              <Field label="동판/번들">
                <div className="flex items-center gap-2 h-9 px-2.5 rounded-md border border-border/40 bg-input/60">
                  <Switch
                    checked={form.bundle === "Y"}
                    onCheckedChange={(v) => set("bundle", v ? "Y" : null)}
                  />
                  <span className={cn("text-xs font-medium truncate", form.bundle === "Y" ? "text-primary" : "text-muted-foreground")}>
                    {form.bundle === "Y" ? "동판/번들" : "해당없음"}
                  </span>
                </div>
              </Field>
            </div>
            <div className="col-span-12 md:col-span-3">
              <Field label="약정 정보 *">
                <div className={cn(
                  "inline-flex h-9 w-full rounded-md border bg-input/60 p-0.5 text-xs",
                  customFields.contract_type ? "border-border/40" : "border-destructive/60"
                )}>
                  {[
                    { v: "선택약정", label: "선택약정" },
                    { v: "이통사지원금", label: "이통사지원금" },
                  ].map((opt) => {
                    const active = customFields.contract_type === opt.v;
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setCustomFields((f) => ({ ...f, contract_type: opt.v }))}
                        className={cn(
                          "flex-1 rounded-[5px] font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </div>
          {/* 부가서비스 - 조건부 렌더링 */}
          {(() => {
            const defaults = getDefaultsForProduct(form.product);
            const vasRequired = defaults?.vas_required ?? true;
            if (!vasRequired && form.product) return (
              <div className="text-[11px] text-muted-foreground italic px-1 py-1">
                이 상품은 부가서비스 입력이 필요하지 않습니다
              </div>
            );
            return (
              <div className={cn(
                "transition-all duration-300 ease-out overflow-hidden",
                form.product && vasRequired ? "max-h-[200px] opacity-100" : !form.product ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
              )}>
                 {(() => {
                   const vasPlans = Array.from(new Set(
                     (mappings ?? [])
                       .filter((m: any) => m.active && typeof m.product === "string"
                         && (m.product.includes("부가서비스") || m.product.toUpperCase().includes("VAS")))
                       .map((m: any) => m.rate_plan as string),
                   ));
                   return (
                 <Grid cols={2}>
                  <Field label="부가서비스 1">
                    {(() => {
                      const mismatch = defaults?.default_vas1 && form.vas1 && form.vas1 !== defaults.default_vas1 && !autoFilledFields.has("vas1");
                      const locked = defaults?.vas1_locked && defaults?.default_vas1;
                      return (
                        <div>
                          <Select
                            value={form.vas1 ?? ""}
                            onValueChange={(v) => set("vas1", v)}
                            disabled={!!locked}
                          >
                            <SelectTrigger className={cn("h-9 bg-input/60 text-xs", locked && "opacity-70 cursor-not-allowed")}>
                              <SelectValue placeholder={vasPlans.length === 0 ? "부가서비스 미등록 (어드민)" : "선택"} />
                            </SelectTrigger>
                            <SelectContent>
                              {vasPlans.map((p) => (
                                <SelectItem key={`v1-${p}`} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                  <Field label="부가서비스 2">
                    {(() => {
                      const mismatch = defaults?.default_vas2 && form.vas2 && form.vas2 !== defaults.default_vas2 && !autoFilledFields.has("vas2");
                      const locked = defaults?.vas2_locked && defaults?.default_vas2;
                      return (
                        <div>
                          <Select
                            value={form.vas2 ?? ""}
                            onValueChange={(v) => set("vas2", v)}
                            disabled={!!locked}
                          >
                            <SelectTrigger className={cn("h-9 bg-input/60 text-xs", locked && "opacity-70 cursor-not-allowed")}>
                              <SelectValue placeholder={vasPlans.length === 0 ? "부가서비스 미등록 (어드민)" : "선택"} />
                            </SelectTrigger>
                            <SelectContent>
                              {vasPlans.map((p) => (
                                <SelectItem key={`v2-${p}`} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                   );
                 })()}
              </div>
            );
          })()}

          {/* TV 추가 (인터넷/유선결합 상품) */}
          {(() => {
            // 스마트홈은 TV 추가 대상 아님 — 인터넷/TV결합 상품에서만 노출
            const wiredAddonProducts = ["인터넷", "TV프리", "유선결합", "TV"];
            const product = form.product ?? "";
            const isSmartHome = product.includes("스마트홈");
            const isWired = !isSmartHome && wiredAddonProducts.some((p) => product.includes(p));
            if (!isWired) return null;

            const tvLines: Array<{ rate_plan?: string; settop?: string }> = Array.isArray(customFields.tv_lines)
              ? customFields.tv_lines
              : [];

            // TV 카테고리 요금제 (상품명에 'TV' 포함)
            const tvPlans = Array.from(
              new Set(
                (mappings ?? [])
                  .filter((m: any) => m.active && typeof m.product === "string" && m.product.toUpperCase().includes("TV"))
                  .map((m: any) => m.rate_plan as string),
              ),
            );
            // 셋톱박스 옵션 (없으면 자유 입력으로 폴백)
            const settopOptions: string[] = getEquipmentByCategory("settop").map((e) => e.equipment_name);

            const updateLines = (next: typeof tvLines) =>
              setCustomFields((f) => ({ ...f, tv_lines: next }));
            const addLine = () => {
              if (tvLines.length >= 3) return;
              updateLines([...tvLines, { rate_plan: "", settop: "" }]);
            };
            const removeLine = (i: number) => updateLines(tvLines.filter((_, idx) => idx !== i));
            const patchLine = (i: number, patch: Partial<{ rate_plan: string; settop: string }>) =>
              updateLines(tvLines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

            return (
              <div className="border border-border/30 rounded-xl p-3 mt-2 bg-muted/10">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Tv className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold">TV 추가 회선</span>
                  <Badge variant="outline" className="text-[10px]">{tvLines.length}/3</Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">인터넷 1회선 + TV {tvLines.length}회선</span>
                </div>

                <div className="space-y-2">
                  {tvLines.map((line, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border/40 bg-background/40 p-2.5 animate-in fade-in slide-in-from-top-1 duration-200"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-semibold text-primary">TV #{i + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => removeLine(i)}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="text-[11px] ml-1">삭제</span>
                        </Button>
                      </div>
                      <Grid cols={2}>
                        <Field label="TV 요금제">
                          <Select
                            value={line.rate_plan ?? ""}
                            onValueChange={(v) => patchLine(i, { rate_plan: v })}
                          >
                            <SelectTrigger className="h-9 bg-input/60 text-xs">
                              <SelectValue placeholder={tvPlans.length === 0 ? "TV 요금제 미등록 (어드민)" : "선택"} />
                            </SelectTrigger>
                            <SelectContent>
                              {tvPlans.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="셋톱박스">
                          {settopOptions.length > 0 ? (
                            <Select
                              value={line.settop ?? ""}
                              onValueChange={(v) => patchLine(i, { settop: v })}
                            >
                              <SelectTrigger className="h-9 bg-input/60 text-xs">
                                <SelectValue placeholder="선택 또는 직접 입력" />
                              </SelectTrigger>
                              <SelectContent>
                                {settopOptions.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={line.settop ?? ""}
                              onChange={(e) => patchLine(i, { settop: e.target.value })}
                              placeholder="셋톱박스 모델 입력"
                              className="h-9 bg-input/60 text-xs"
                            />
                          )}
                        </Field>
                      </Grid>
                    </div>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-border/30">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs"
                    onClick={addLine}
                    disabled={tvLines.length >= 3}
                  >
                    <Plus className="size-3.5" />
                    {tvLines.length >= 3 ? "최대 3대까지 추가 가능" : "TV 추가"}
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* 자동이체 정보 */}
          <div className="border border-border/30 rounded-xl p-3 mt-2 bg-muted/10">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="size-3.5 text-primary" />
              <span className="text-xs font-semibold">자동이체 정보</span>
              <span className="text-[10px] text-muted-foreground">월 요금 자동 출금 계좌</span>
            </div>
            <Grid cols={3}>
              <Field label="은행명">
                <Select
                  value={customFields.autopay_bank ?? ""}
                  onValueChange={(v) => setCustomFields((f) => ({ ...f, autopay_bank: v }))}
                >
                  <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="은행 선택" /></SelectTrigger>
                  <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="계좌번호">
                <Input
                  value={customFields.autopay_account ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d-]/g, "").slice(0, 20);
                    setCustomFields((f) => ({ ...f, autopay_account: v }));
                  }}
                  placeholder="000-0000-0000"
                  className="h-9 bg-input/60 text-xs tabular-nums"
                  inputMode="numeric"
                />
              </Field>
              <Field label="예금주">
                <Input
                  value={customFields.autopay_holder ?? ""}
                  onChange={(e) => setCustomFields((f) => ({ ...f, autopay_holder: e.target.value }))}
                  placeholder="홍길동"
                  className="h-9 bg-input/60 text-xs"
                  maxLength={30}
                />
              </Field>
            </Grid>
          </div>

          {/* 제휴카드 */}
          <div className="border border-border/30 rounded-xl p-3 mt-2 bg-muted/10">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <CreditCard className="size-3.5 text-primary" />
              <span className="text-xs font-semibold">제휴카드</span>
              <button
                type="button"
                onClick={() => setCustomFields((f) => ({
                  ...f,
                  partner_card_enabled: !f.partner_card_enabled,
                  ...(f.partner_card_enabled ? {
                    partner_card_company: "",
                    partner_card_number: "",
                    partner_card_expiry: "",
                    partner_card_discount_type: "",
                  } : {}),
                }))}
                className={cn(
                  "px-3 py-1 rounded-full border text-[11px] font-medium transition-all",
                  customFields.partner_card_enabled
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border/40 text-muted-foreground hover:border-primary/40",
                )}
                aria-pressed={!!customFields.partner_card_enabled}
              >
                {customFields.partner_card_enabled ? "✓ 사용함" : "사용 안 함"}
              </button>
            </div>
            {customFields.partner_card_enabled && (
              <div className="animate-fade-in space-y-2">
                <Grid cols={3}>
                  <Field label="제휴카드사 명">
                    <Input
                      value={customFields.partner_card_company ?? ""}
                      onChange={(e) => setCustomFields((f) => ({ ...f, partner_card_company: e.target.value }))}
                      placeholder="예: KB국민, 현대카드"
                      className="h-9 bg-input/60 text-xs"
                    />
                  </Field>
                  <Field label="카드번호">
                    <Input
                      value={customFields.partner_card_number ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                        const formatted = raw.replace(/(.{4})/g, "$1-").replace(/-$/, "");
                        setCustomFields((f) => ({ ...f, partner_card_number: formatted }));
                      }}
                      placeholder="0000-0000-0000-0000"
                      className="h-9 bg-input/60 text-xs tabular-nums"
                      inputMode="numeric"
                    />
                  </Field>
                  <Field label="유효기간 (MM/YY)">
                    <Input
                      value={customFields.partner_card_expiry ?? ""}
                      onChange={(e) => {
                        let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                        setCustomFields((f) => ({ ...f, partner_card_expiry: v }));
                      }}
                      placeholder="MM/YY"
                      className="h-9 bg-input/60 text-xs tabular-nums"
                      inputMode="numeric"
                      maxLength={5}
                    />
                  </Field>
                </Grid>
                <div className="px-1">
                  <Label className="text-[11px] text-muted-foreground font-medium">할인 방식</Label>
                  <div className="flex gap-2 mt-1.5">
                    {[
                      { v: "device", label: "단말할인" },
                      { v: "billing", label: "청구할인" },
                    ].map((opt) => {
                      const checked = customFields.partner_card_discount_type === opt.v;
                      return (
                        <label
                          key={opt.v}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors flex-1",
                            checked
                              ? "border-primary bg-primary/10 text-primary font-semibold"
                              : "border-border/40 hover:border-primary/30",
                          )}
                        >
                          <input
                            type="radio"
                            name="partner_card_discount_type"
                            value={opt.v}
                            checked={checked}
                            onChange={() => setCustomFields((f) => ({ ...f, partner_card_discount_type: opt.v }))}
                            className="accent-primary"
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="수익 및 정산">
          {/* 중고폰 반납 */}
          <div className="border border-border/30 rounded-xl p-3 mb-2">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="size-3.5 text-primary" />
              <span className="text-xs font-semibold">중고폰 반납</span>
              <Switch
                checked={!!form.trade_in_enabled}
                onCheckedChange={(v) => {
                  set("trade_in_enabled", v);
                  if (!v) {
                    set("trade_in_model", null);
                    set("trade_in_estimate", 0);
                    set("trade_in_confirmed", 0);
                  }
                }}
              />
              <span className={cn("text-[11px] font-medium", form.trade_in_enabled ? "text-primary" : "text-muted-foreground")}>
                {form.trade_in_enabled ? "반납 있음" : "해당 없음"}
              </span>
            </div>
            {form.trade_in_enabled && (
              <div className="animate-fade-in">
                <Grid cols={3}>
                  <Field label="중고폰 모델명">
                    <Input
                      value={form.trade_in_model ?? ""}
                      onChange={(e) => set("trade_in_model", e.target.value)}
                      placeholder="예: iPhone 14, Galaxy S23"
                      className="h-9 bg-input/60 text-xs"
                    />
                  </Field>
                  <Field label="예상 반납 금액 (₩)">
                    <MoneyInput value={form.trade_in_estimate} onChange={(v) => set("trade_in_estimate", v)} />
                  </Field>
                  <Field label="확정 반납 금액 (₩)">
                    <MoneyInput value={form.trade_in_confirmed} onChange={(v) => set("trade_in_confirmed", v)} />
                  </Field>
                </Grid>
              </div>
            )}
          </div>

          <Grid cols={4}>
            <Field label="단가표 기준 (₩)">
              <MoneyInput value={form.unit_price} onChange={(v) => set("unit_price", v)} />
            </Field>
            <Field label="부가서비스 수수료 (₩)">
              <MoneyInput value={form.vas_fee} onChange={(v) => set("vas_fee", v)} />
            </Field>
            <Field label="미수금 (₩)">
              <MoneyInput value={form.receivable_amount} onChange={(v) => set("receivable_amount", v)} />
              <p className="text-[10px] text-muted-foreground mt-0.5">고객에게 아직 받지 못한 기기값/수납금 등 (수익에 포함)</p>
            </Field>
            <Field label="수급 상태">
              <div className="flex items-center gap-2 h-9">
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
            <div className="rounded-lg border border-amber-400 bg-amber-50/50 px-3 py-2 mt-2 mb-2 flex items-center gap-2 text-xs text-amber-600">
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
                  <span className="text-muted-foreground">- 현금개통</span>
                  <span className="text-destructive">₩{(form.cash_support_amount ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">- 추가지원금</span>
                  <span className="text-destructive">₩{(form.extra_subsidy ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">- 고객지원금</span>
                  <span className="text-destructive">₩{(form.customer_support_amount ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">- 법인카드 결제</span>
                  <span className="text-destructive">₩{(form.corp_card_amount ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-destructive/30 pt-1 mt-1">
                  <span className="text-muted-foreground font-medium">총 오퍼(지출) 합계</span>
                  <span className="text-destructive font-semibold">
                    ₩{(
                      (form.distributor_amount ?? 0) +
                      (form.cash_support_amount ?? 0) +
                      (form.extra_subsidy ?? 0) +
                      (form.customer_support_amount ?? 0) +
                      (form.corp_card_amount ?? 0)
                    ).toLocaleString()}
                  </span>
                </div>
                {form.trade_in_enabled && (form.trade_in_confirmed ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">+ 중고폰 반납</span>
                    <span className="text-primary">₩{(form.trade_in_confirmed ?? 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border/30 pt-1 mt-1">
                  <span className="font-semibold">최종 수익 (5대 수익 − 총 오퍼)</span>
                  {(() => {
                    const revenue =
                      (form.unit_price ?? 0) +
                      (form.vas_fee ?? 0) +
                      (form.trade_in_enabled ? (form.trade_in_confirmed ?? 0) : 0) +
                      Number(customFields?.voucher_amount ?? 0);
                    const offerTotal =
                      (form.distributor_amount ?? 0) +
                      (form.cash_support_amount ?? 0) +
                      (form.extra_subsidy ?? 0) +
                      (form.customer_support_amount ?? 0) +
                      (form.corp_card_amount ?? 0);
                    const netFinal = revenue - offerTotal;
                    return <span className={`font-bold ${netFinal >= 0 ? "text-primary" : "text-destructive"}`}>₩{netFinal.toLocaleString()}</span>;
                  })()}
                </div>
                {(form.receivable_amount ?? 0) > 0 && (
                  <div className="flex justify-between mt-1 pt-1 border-t border-border/20">
                    <span className="text-muted-foreground text-[10px]">📌 미수금 (별도 추적)</span>
                    <span className="text-warning font-medium">₩{(form.receivable_amount ?? 0).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <Grid cols={4}>
            <Field label="상품권">
              <Select value={form.voucher ?? ""} onValueChange={(v) => set("voucher", v)}>
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {["신세계", "롯데", "모바일", "기타"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="상품권 금액 (₩)">
              <MoneyInput
                value={Number(customFields?.voucher_amount ?? 0)}
                onChange={(v) => setCustomFields((f) => ({ ...f, voucher_amount: v }))}
              />
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                수익(+)으로 합산됩니다 · 추가지원금과 별개 항목
              </p>
              {form.voucher && String(form.voucher).trim() !== "" && form.voucher_returned !== "유" && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                  ⚠ 미반납 상태입니다 · 반납 완료 시 정산에 반영됩니다
                </p>
              )}
            </Field>
            <Field label="반납 상태">
              <div className="flex items-center gap-2 h-9">
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

        <FormSection title="오퍼 및 카드결제" icon={<Wallet className="size-3" />}>
          <div className="flex items-center justify-between -mt-1 mb-2">
            <p className="text-[10px] text-muted-foreground">지출 대시보드에 자동 집계 · 숫자만 입력 · 천 단위 콤마 자동 표시</p>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-medium", customFields.has_offer === false ? "text-muted-foreground" : "text-foreground")}>오퍼</span>
              <Switch
                checked={customFields.has_offer !== false}
                onCheckedChange={(v) => {
                  setCustomFields((f) => ({ ...f, has_offer: v }));
                  if (!v) {
                    set("distributor_amount", 0);
                    set("extra_subsidy", 0);
                    set("cash_support_amount", 0);
                    set("customer_support_amount", 0);
                    set("corp_card_amount", 0);
                    set("cash_open", false);
                    set("cash_bank", null);
                    set("cash_account", null);
                    set("cash_holder", null);
                  }
                }}
              />
              <Badge variant={customFields.has_offer === false ? "secondary" : "default"} className="text-[10px]">
                {customFields.has_offer === false ? "무오퍼" : "오퍼"}
              </Badge>
            </div>
          </div>
          <Grid cols={3}>
            <Field label="① 유통망 지원금 (₩)">
              <MoneyInput
                value={form.distributor_amount}
                onChange={(v) => set("distributor_amount", v)}
                disabled={customFields.has_offer === false}
              />
            </Field>
            <Field label="② 현금개통 금액 (₩)">
              <MoneyInput
                value={form.cash_support_amount}
                onChange={(v) => {
                  set("cash_support_amount", v);
                  set("cash_open", v > 0);
                }}
                disabled={customFields.has_offer === false}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">고객에게 지급(입금)하는 서비스 금액 (수익에서 차감)</p>
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="③ 추가지원금 (₩)">
              <MoneyInput value={form.extra_subsidy} onChange={(v) => set("extra_subsidy", v)} disabled={customFields.has_offer === false} />
            </Field>
            <Field label="④ 고객지원금 (₩)">
              <MoneyInput value={form.customer_support_amount} onChange={(v) => set("customer_support_amount", v)} disabled={customFields.has_offer === false} />
              <p className="text-[10px] text-muted-foreground mt-0.5">고객에게 별도 지급하는 지원금 (수익에서 차감)</p>
            </Field>
            <Field label="⑤ 법인카드 결제금액 (₩)">
              <MoneyInput value={form.corp_card_amount} onChange={(v) => set("corp_card_amount", v)} disabled={customFields.has_offer === false} />
              <p className="text-[10px] text-muted-foreground mt-0.5">법인카드로 결제한 금액 (수익에서 차감)</p>
            </Field>
          </Grid>
          <Grid cols={3}>
            <Field label="은행">
              <Select value={form.cash_bank ?? ""} onValueChange={(v) => set("cash_bank", v)} disabled={customFields.has_offer === false}>
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="입금계좌">
              <Input value={form.cash_account ?? ""} onChange={(e) => set("cash_account", e.target.value)} className="h-9 bg-input/60 text-xs" disabled={customFields.has_offer === false} />
            </Field>
            <Field label="예금주">
              <Input value={form.cash_holder ?? ""} onChange={(e) => set("cash_holder", e.target.value)} className="h-9 bg-input/60 text-xs" disabled={customFields.has_offer === false} />
            </Field>
          </Grid>

          {/* 법인카드 결제 */}
          <div className="border-t border-border/30 pt-3 mt-1">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="size-3.5 text-primary" />
              <span className="text-xs font-semibold">법인카드 결제</span>
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
                      <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
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
                      className="h-9 bg-input/60 text-xs tabular-nums" inputMode="numeric"
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
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{DELIVERY_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="운송장">
              <Input value={form.tracking_no ?? ""} onChange={(e) => set("tracking_no", e.target.value)} className="h-9 bg-input/60 text-xs" />
            </Field>
            <Field label="특이사항">
              <Input value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} className="h-9 bg-input/60 text-xs" placeholder="메모" />
            </Field>
          </Grid>
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

        {/* === 수익/오퍼 합계 요약 === */}
        {(() => {
          const row = {
            ...form,
            ...customFields,
            voucher_amount: Number(customFields?.voucher_amount ?? 0),
            partner_card_discount: Number(customFields?.partner_card_discount ?? 0),
            custom_fields: customFields,
          } as Record<string, any>;
          const revenue = sumRevenue(row);
          const offer = sumOffer(row);
          const net = revenue - offer;
          const fmt = (n: number) =>
            (n < 0 ? "-" : "") + "₩" + Math.abs(Math.round(n)).toLocaleString("ko-KR");
          return (
            <div className="rounded-2xl border border-border/40 bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">수익 합계 (5대 수익)</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  +{fmt(revenue)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">오퍼 합계 (5대 오퍼 + 카드결제)</span>
                <span className="font-mono tabular-nums font-semibold text-destructive">
                  -{fmt(offer)}
                </span>
              </div>
              <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold">최종 순수익</span>
                <span
                  className={cn(
                    "font-mono tabular-nums text-lg font-extrabold",
                    net < 0 ? "text-destructive" : "text-primary",
                  )}
                >
                  {fmt(net)}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground text-right pt-1">
                자동계산 수식: <code className="font-mono text-primary/80">{netFeeFormula}</code>
              </div>
            </div>
          );
        })()}

        <div className="flex gap-3">
          {editingId && (
            <Button type="button" variant="outline" onClick={reset} className="h-10 rounded-2xl text-sm">
              <X className="size-4 mr-2" /> 취소
            </Button>
          )}
          <Button type="submit" disabled={busy} className="flex-1 h-10 bg-gradient-primary shadow-glow rounded-2xl text-sm font-semibold">
            <Check className="size-4 mr-2" /> {editingId ? "수정 저장" : "판매 1건 저장"}
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

      {/* 판매원장 바로가기 */}
      <section className="glass rounded-2xl p-4 text-center">
        <Button variant="outline" onClick={() => navigate("/sales-ledger")} className="rounded-xl gap-2">
          📋 판매원장 관리 페이지로 이동
        </Button>
      </section>
    </>
  );
};

const FormSection = React.forwardRef<HTMLElement, { title: string; icon?: React.ReactNode; children: React.ReactNode }>(({ title, icon, children }, ref) => (
  <section ref={ref} className="glass rounded-2xl p-4 md:p-5 space-y-3 shadow-card-elevated">
    <div className="flex items-center gap-2 pb-1 border-b border-border/30">
      {icon && <Badge className="bg-gradient-primary text-primary-foreground border-0">{icon}</Badge>}
      <h3 className="text-xs font-semibold tracking-tight">{title}</h3>
    </div>
    {children}
  </section>
));
FormSection.displayName = "FormSection";

const Grid = React.forwardRef<HTMLDivElement, { cols: 2 | 3 | 4 | 5 | 6; children: React.ReactNode }>(({ cols, children }, ref) => (
  <div ref={ref} className={cn(
    "grid gap-x-3 gap-y-2",
    cols === 2 && "grid-cols-1 md:grid-cols-2",
    cols === 3 && "grid-cols-1 md:grid-cols-3",
    cols === 4 && "grid-cols-2 md:grid-cols-4",
    cols === 5 && "grid-cols-2 md:grid-cols-5",
    cols === 6 && "grid-cols-2 md:grid-cols-6",
  )}>
    {children}
  </div>
));
Grid.displayName = "Grid";

const Field = React.forwardRef<HTMLDivElement, { label: string; children: React.ReactNode }>(({ label, children }, ref) => (
  <div ref={ref} className="space-y-0.5">
    <Label className="text-[11px] text-muted-foreground font-medium leading-none">{label}</Label>
    {children}
  </div>
));
Field.displayName = "Field";

export default InputPage;
