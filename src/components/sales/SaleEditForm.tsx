// Auto-extracted reusable form for sale create/edit. Mirrors src/pages/InputPage.tsx so the
// inspection (검수) panel offers an identical UX to the data-entry screen.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Upload, Pencil, X, Camera, Plus, Trash2, Tv, Sparkles, AlertTriangle, Wallet, Banknote, CreditCard, Smartphone, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { useProductRatePlans } from "@/hooks/useProductRatePlans";
import { useEquipmentCatalog } from "@/hooks/useEquipmentCatalog";
import { cn } from "@/lib/utils";
import { useFieldDefinitions } from "@/hooks/useFieldDefinitions";
import { useNetFeeFormula, sumRevenue, sumOffer } from "@/hooks/useNetFeeFormula";
import { DynamicFieldRenderer } from "@/components/admin/DynamicFieldRenderer";
import { SaleDocuments } from "@/components/sales/SaleDocuments";
import { PendingItemsEditor } from "@/components/sales/PendingItemsEditor";
import { MoneyInput } from "@/components/ui/money-input";
import { ModelAutocomplete } from "@/components/ui/model-autocomplete";
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { formatPhone } from "@/lib/phoneFormat";
import { verifyLoadedSale, findMissingBoundKeys } from "@/components/sales/saleFormLoader";

export type SaleRow = {
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

interface SaleEditFormProps {
  /** When provided, the form auto-loads this sale and runs in edit mode. */
  saleId?: string | null;
  /** Embedded mode skips the "판매원장 이동" CTA + auto-navigate after save. */
  embedded?: boolean;
  /** Called after a successful save (insert or update). */
  onSaved?: (saleId: string) => void;
  /** Called when user explicitly cancels editing (only relevant in edit mode). */
  onCancel?: () => void;
  /** Hide the gradient submit footer (caller renders its own). */
  hideSubmit?: boolean;
}

/**
 * 약정 정보(선택약정/이통사지원금) 입력 대상 상품 판별.
 * 모바일 / 2nd(세컨) / USIM 카테고리에서만 약정 입력을 활성화한다.
 */
const isContractProduct = (product: string | null | undefined): boolean => {
  if (!product) return false;
  const p = String(product).toUpperCase();
  if (p === "2ND") return true;
  if (p.includes("USIM")) return true;
  if (p.includes("세컨") || p.includes("2ND")) return true;
  if (product.includes("모바일")) return true;
  return false;
};

const SALE_FORM_KEYS = [
  "seq", "channel", "channel_company", "moyo_excluded", "manager", "open_month", "product",
  "sale_type", "open_method", "status", "open_date", "customer_name", "birth_date", "phone",
  "device_model", "device_serial", "usim_model", "usim_serial", "rate_plan", "vas1", "vas2",
  "unit_price", "vas_fee", "voucher", "voucher_returned", "receivable_amount", "receivable_paid",
  "cash_open", "distributor_amount", "extra_subsidy", "cash_support_amount", "cash_bank",
  "cash_account", "cash_holder", "net_fee", "delivery_type", "tracking_no", "note", "bundle",
  "trade_in_enabled", "trade_in_model", "trade_in_estimate", "trade_in_confirmed",
  "customer_support_amount", "corp_card_amount",
] as const;

const NUMERIC_FORM_KEYS = new Set<string>([
  "unit_price", "vas_fee", "receivable_amount", "distributor_amount", "extra_subsidy",
  "cash_support_amount", "net_fee", "trade_in_estimate", "trade_in_confirmed",
  "customer_support_amount", "corp_card_amount",
]);

const BOOLEAN_FORM_KEYS = new Set<string>(["moyo_excluded", "cash_open", "trade_in_enabled"]);

const bindSaleToForm = (sale: Record<string, any>): Partial<SaleRow> => {
  const bound: Record<string, any> = {};
  for (const key of SALE_FORM_KEYS) {
    if (BOOLEAN_FORM_KEYS.has(key)) bound[key] = sale[key] ?? false;
    else if (NUMERIC_FORM_KEYS.has(key)) bound[key] = sale[key] ?? 0;
    else bound[key] = sale[key] ?? null;
  }
  return bound as Partial<SaleRow>;
};

const BOUND_SALE_REQUIRED_KEYS = [
  "channel", "manager", "customer_name", "open_date", "phone",
  "product", "status", "device_model", "rate_plan",
] as const;

export function SaleEditForm({ saleId, embedded = false, onSaved, onCancel, hideSubmit = false }: SaleEditFormProps) {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialEditId = !embedded ? searchParams.get("edit") : null;
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
  const [loadingSale, setLoadingSale] = useState<boolean>(!!saleId || !!initialEditId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [pendingNote, setPendingNote] = useState<string>("");
  const [pendingResolved, setPendingResolved] = useState<boolean>(true);
  const [editingId, setEditingId] = useState<string | null>(saleId ?? initialEditId);
  const [busy, setBusy] = useState(false);
  // 원본 스냅샷 — 수정 모드에서 누락 필드(특히 담당자/인입경로)가 null로 덮어씌워지는 것을 방지
  const originalRef = useRef<any>(null);
  const { fields: dynamicFields } = useFieldDefinitions("sales");
  const { calc: calcNetFee, formula: netFeeFormula } = useNetFeeFormula();
  const { models: deviceModels } = useDeviceModels(true);
  const [staffOptions, setStaffOptions] = useState<{ user_id: string; display_name: string; store: string | null }[]>([]);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [linkedInquiryId, setLinkedInquiryId] = useState<string | null>(null);

  // 인입 → 실적 자동 채움 (URL 파라미터) — embedded 모드에서는 비활성
  useEffect(() => {
    if (embedded) return;
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
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수정 모드: URL ?edit=<id> (embedded 모드에서는 saleId prop 사용)
  useEffect(() => {
    if (embedded || saleId) return;
    const editId = searchParams.get("edit");
    if (!editId) return;
    setEditingId(editId);
    setLoadingSale(true);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyLoadedSale = (sale: any) => {
    originalRef.current = sale;
    const v = verifyLoadedSale(sale);
    if (!v.ok) {
      console.warn("[SaleEditForm] loaded sale missing critical fields", v.missing, sale);
      toast.error("실적 데이터가 비정상입니다", { description: `누락 필드: ${v.missing.join(", ")}` });
    }
    const bound = bindSaleToForm(sale);
    setEditingId(sale.id);
    setForm(bound);
    setCustomFields(sale.custom_fields ?? {});
    setPendingItems(Array.isArray(sale.pending_items) ? sale.pending_items : []);
    setPendingNote(sale.pending_note ?? "");
    setPendingResolved(sale.pending_resolved ?? true);
    setLoadError(null);
    setLoadingSale(false);
    setTimeout(() => {
      setForm((curr) => {
        const missing = findMissingBoundKeys(sale, curr as any);
        if (missing.length === 0) return curr;
        console.warn("[SaleEditForm] bound form lost fields after load", missing);
        toast.warning("일부 항목이 비어있어 원본값으로 복구했습니다", { description: missing.join(", ") });
        const restored = { ...curr } as Record<string, any>;
        for (const key of missing) restored[key] = (bound as Record<string, any>)[key] ?? sale[key] ?? null;
        return restored;
      });
    }, 50);
  };

  // editingId가 잡히면(수정모드 진입) 데이터 로드 — saleId prop과 동일한 로직
  useEffect(() => {
    if (saleId) return; // saleId effect가 처리
    if (!editingId) return;
    if (authLoading || !user) return;
    setLoadingSale(true);
    setLoadError(null);
    (async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("id", editingId)
        .maybeSingle();
      if (error || !data) {
        const message = error?.message ?? "대상 실적을 찾을 수 없습니다";
        toast.error("실적 데이터를 불러올 수 없습니다", { description: message });
        setLoadError(message);
        setLoadingSale(false);
        return;
      }
      applyLoadedSale(data as any);
    })();
  }, [editingId, saleId, authLoading, user?.id]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, store")
        .eq("status", "active")
        .order("display_name", { ascending: true });
      const list = (data ?? []) as { user_id: string; display_name: string; store: string | null }[];
      setStaffOptions(list);
      setForm((f) => {
        // 수정 모드(saleId prop OR editingId OR URL ?edit=)에서는
        // 절대 본인 user.id로 manager를 덮어쓰지 않는다.
        // 신규 입력 모드일 때만 본인을 기본 담당자로 자동 채움.
        const isEditMode =
          !!saleId ||
          !!editingId ||
          (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("edit"));
        if (f.manager || !user || isEditMode || loadingSale) return f;
        const me = list.find((p) => p.user_id === user.id);
        return me ? { ...f, manager: me.user_id } : f;
      });
    })();
  }, [user, saleId, editingId, loadingSale]);

  // 외부 saleId가 바뀔 때 데이터 로드
  useEffect(() => {
    if (!saleId) return;
    if (authLoading || !user) return;
    setLoadingSale(true);
    setLoadError(null);
    (async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .eq("id", saleId)
        .maybeSingle();
      if (error || !data) {
        const message = error?.message ?? "대상 실적을 찾을 수 없습니다";
        toast.error("실적 데이터를 불러올 수 없습니다", { description: message });
        setLoadError(message);
        setLoadingSale(false);
        return;
      }
      applyLoadedSale(data as any);
    })();
  }, [saleId, authLoading, user?.id]);

  const set = <K extends keyof SaleRow>(k: K, v: SaleRow[K] | undefined) =>
    setForm((f) => {
      if (autoFilledFields.has(k as string)) {
        setAutoFilledFields((prev) => { const n = new Set(prev); n.delete(k as string); return n; });
      }
      return { ...f, [k]: v };
    });

  const num = (v: unknown) => {
    if (v === "" || v == null) return 0;
    const n = Number(String(v).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const reset = () => {
    if (saleId) {
      // controlled by parent — let parent decide
      onCancel?.();
      return;
    }
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
    // 데이터 로딩 중 저장 차단 — 빈 값이 전송되어 기존 데이터가 유실되는 것을 방지
    if (loadingSale) {
      toast.warning("데이터 로딩 중입니다. 잠시만 기다려주세요.");
      return;
    }
    // 수정 모드인데 원본을 아직 못 받은 경우(네트워크 지연 등) 안전 차단
    if (editingId && !originalRef.current) {
      toast.warning("기존 데이터를 불러오는 중입니다. 다시 시도해주세요.");
      return;
    }
    // 약정 정보(선택약정/이통사지원금)는 [모바일/2nd/USIM] 상품에서만 필수
    const contractRequired = isContractProduct(form.product);
    if (contractRequired && !customFields.contract_type) {
      toast.error("약정 정보를 선택해주세요", { description: "[모바일/2nd/USIM] 상품은 선택약정 또는 이통사지원금 중 하나를 선택해야 합니다." });
      return;
    }
    // 단말기 모델: 마스터에 등록된 정확한 펫네임만 허용
    if (form.device_model && form.device_model.trim().length > 0) {
      const ok = deviceModels.some((m) => m.model_name === form.device_model);
      if (!ok) {
        toast.error("단말기 모델을 확정해주세요", {
          description: "검색 후 목록에서 직접 선택한 모델만 저장할 수 있습니다.",
        });
        return;
      }
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
    const selectedStaff = staffOptions.find((s) => s.user_id === form.manager || s.display_name === form.manager);
    const orig = originalRef.current ?? {};
    // 핵심 필드 보존: 폼이 비어있으면 원본 값을 유지 (담당자/인입경로 유실 방지)
    const preservedManager =
      (selectedStaff?.user_id ?? form.manager) || orig.manager || null;
    const preservedChannel = form.channel || orig.channel || null;
    const payload: any = {
      ...form,
      created_by: editingId ? (orig.created_by ?? user.id) : user.id,
      manager: preservedManager,
      channel: preservedChannel,
      ...baseNumeric,
      net_fee: form.net_fee != null && form.net_fee !== 0
        ? num(form.net_fee)
        : calcNetFee(baseNumeric),
      custom_fields: {
        ...(orig.custom_fields ?? {}),
        ...customFields,
        // 약정 정보: 활성 상품(모바일/2nd/USIM)이 아니면 비활성 필드이므로 null 로 안전 저장
        contract_type: isContractProduct(form.product) ? (customFields.contract_type || null) : null,
      },
      pending_items: pendingItems,
      pending_note: pendingNote || null,
      pending_resolved: pendingItems.length === 0 ? true : pendingResolved,
      trade_in_enabled: !!form.trade_in_enabled,
      trade_in_model: form.trade_in_enabled ? (form.trade_in_model || null) : null,
      open_month: form.open_date ? String(form.open_date).slice(0, 7) : null,
    };
    // 저장 시점 강제 갱신: 동일값 저장이라도 변경 인식되도록 updated_at 을 갱신한다.
    (payload as any).updated_at = new Date().toISOString();
    // 수정 모드: undefined/빈 값 필드는 원본 값을 사용해 의도치 않은 초기화 방지
    if (editingId && orig) {
      const PROTECT_KEYS = [
        "manager", "channel", "channel_company", "product", "sale_type",
        "open_method", "status", "open_date", "customer_name", "phone",
        "device_model", "rate_plan",
      ];
      for (const k of PROTECT_KEYS) {
        const v = (payload as any)[k];
        if (v === undefined || v === null || v === "") {
          if (orig[k] !== undefined && orig[k] !== null && orig[k] !== "") {
            (payload as any)[k] = orig[k];
          }
        }
      }
    }
    try {
      let resultId = editingId;
      if (editingId) {
        // .select()로 실제 업데이트된 행을 받아와 DB 반영 여부를 검증한다.
        // RLS 등으로 0행만 영향을 받았는데도 error 없이 통과하던 현상을 막는다.
        const { data: updated, error } = await supabase
          .from("sales")
          .update(payload)
          .eq("id", editingId)
          .select("id");
        if (error) throw error;
        if (!updated || updated.length === 0) {
          throw new Error("저장 권한이 없거나 대상 데이터가 변경되지 않았습니다. 새로고침 후 다시 시도해주세요.");
        }
        // 저장된 최신 값으로 originalRef 갱신 (다음 저장에 반영)
        const { data: fresh } = await supabase
          .from("sales")
          .select("*")
          .eq("id", editingId)
          .maybeSingle();
        if (fresh) originalRef.current = fresh;
        toast.success("저장되었습니다");
      } else {
        const { data: inserted, error } = await supabase.from("sales").insert(payload).select("id").single();
        if (error) throw error;
        resultId = inserted?.id ?? null;
        if (linkedInquiryId && resultId) {
          await supabase
            .from("inquiries")
            .update({ status: "개통완료", converted_sale_id: resultId })
            .eq("id", linkedInquiryId);
          setLinkedInquiryId(null);
        }
        toast.success("실적이 성공적으로 등록되었으며, 즉시 장표에 반영되었습니다", {
          description: "검수/승인 여부와 무관하게 모든 합계·리스트에 즉시 노출됩니다.",
        });
      }
      if (!embedded) reset();
      if (resultId) onSaved?.(resultId);
    } catch (err) {
      toast.error("저장 실패", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };


  const isEditModeLoading = !!editingId && (authLoading || loadingSale || !originalRef.current);

  if (isEditModeLoading || loadError) {
    return (
      <div className="glass rounded-2xl p-6 text-center space-y-3 shadow-card-elevated">
        <div className="text-sm font-semibold">
          {loadError ? "실적 데이터를 불러올 수 없습니다" : "실적 데이터를 불러오는 중…"}
        </div>
        <div className="text-xs text-muted-foreground">
          {loadError ?? "기존 행 데이터가 준비된 뒤 수정 폼을 표시합니다."}
        </div>
        {loadError && (
          <Button type="button" variant="outline" onClick={onCancel ?? (() => setEditingId(null))}>
            <X className="size-4 mr-2" /> 닫기
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3 pb-8">
        <FormSection title="기본 정보" icon={<Zap className="size-3" />}>
          <Grid cols={5}>
            <Field label="인입경로 *">
              <Select value={form.channel ?? ""} onValueChange={(v) => set("channel", v)}>
                <SelectTrigger className="h-9 bg-input/60 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {(() => {
              const ch = form.channel ?? "";
              const isSeg = /SEG|법인/i.test(ch);
              return (
                <Field label={isSeg ? "업체명 (필수권장)" : "업체명"}>
                  <Input
                    value={(form as any).channel_company ?? ""}
                    onChange={(e) => set("channel_company" as any, e.target.value)}
                    placeholder={isSeg ? "업체명을 입력하세요" : "예: 삼성전자 (선택)"}
                    className={`h-9 bg-input/60 text-xs ${isSeg ? "border-primary/60 ring-1 ring-primary/30 focus-visible:ring-primary/50" : ""}`}
                  />
                </Field>
              );
            })()}
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
                  {form.manager && !staffOptions.some((s) => s.user_id === form.manager) && (
                    <SelectItem value={form.manager}>
                      {staffOptions.find((s) => s.display_name === form.manager)?.display_name ?? form.manager}
                      <span className="text-muted-foreground text-[10px]"> (기존값)</span>
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
                  // 활성 상품(모바일/2nd/USIM)이 아니면 약정 정보(contract_type) 초기화 — 비활성 필드의 잔존값 제거
                  if (!isContractProduct(v)) {
                    setCustomFields((cf) => {
                      if (!("contract_type" in cf)) return cf;
                      const next = { ...cf };
                      delete next.contract_type;
                      return next;
                    });
                  }
                  const defaults = getDefaultsForProduct(v);
                  if (defaults) {
                    const filled = new Set<string>();
                    setForm((f) => {
                      const updates: Partial<SaleRow> = {};
                      if (defaults.default_sale_type && !f.sale_type) {
                        updates.sale_type = defaults.default_sale_type;
                        filled.add("sale_type");
                      }
                      // 부가서비스는 자유 입력 방식으로 전환됨 — 자동 채움 비활성화
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
              <Input value={form.phone ?? ""} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="010-0000-0000" className="h-9 bg-input/60 text-xs" inputMode="numeric" type="tel" maxLength={13} />
            </Field>
            <Field label="가입 번호">
              <Input
                value={customFields.subscription_no ?? ""}
                onChange={(e) => setCustomFields((f) => ({ ...f, subscription_no: e.target.value.replace(/\D+/g, "").slice(0, 12) }))}
                placeholder="숫자만 입력 (최대 12자리)"
                className="h-9 bg-input/60 text-xs" inputMode="numeric"
                maxLength={12}
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
              {customFields.is_youth ? "✓ " : ""}청소년/시니어
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
              <Field label={isContractProduct(form.product) ? "약정 정보 *" : "약정 정보"}>
                {(() => {
                  const enabled = isContractProduct(form.product);
                  const disabledTip = "해당 상품은 약정 정보 입력 대상이 아닙니다";
                  return (
                    <>
                      <div
                        title={!enabled ? disabledTip : undefined}
                        aria-disabled={!enabled}
                        className={cn(
                          "inline-flex h-9 w-full rounded-md border p-0.5 text-xs transition-colors",
                          !enabled
                            ? "bg-muted/60 border-border/30 cursor-not-allowed opacity-70"
                            : customFields.contract_type
                              ? "bg-input/60 border-border/40"
                              : "bg-input/60 border-destructive/60",
                        )}
                      >
                        {[
                          { v: "선택약정", label: "선택약정" },
                          { v: "이통사지원금", label: "이통사지원금" },
                        ].map((opt) => {
                          const active = enabled && customFields.contract_type === opt.v;
                          return (
                            <button
                              key={opt.v}
                              type="button"
                              disabled={!enabled}
                              title={!enabled ? disabledTip : undefined}
                              onClick={() =>
                                enabled && setCustomFields((f) => ({ ...f, contract_type: opt.v }))
                              }
                              className={cn(
                                "flex-1 rounded-[5px] font-medium transition-colors",
                                !enabled
                                  ? "text-muted-foreground/60 cursor-not-allowed"
                                  : active
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      {!enabled && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {disabledTip}
                        </p>
                      )}
                    </>
                  );
                })()}
              </Field>
            </div>
          </div>
          {/* 부가서비스 - 자유 텍스트 입력 (선택 사항) */}
          <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 md:col-span-4">
                    <Field label="부가서비스 1 (선택)">
                      <Input
                        value={form.vas1 ?? ""}
                        onChange={(e) => set("vas1", e.target.value || null)}
                        placeholder="자유 입력 (예: 음악감상, 데이터팩 등)"
                        className="h-9 bg-input/60 text-xs"
                        maxLength={200}
                      />
                    </Field>
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <Field label="부가서비스 2 (선택)">
                      <Input
                        value={form.vas2 ?? ""}
                        onChange={(e) => set("vas2", e.target.value || null)}
                        placeholder="여러 개는 쉼표(,)로 구분"
                        className="h-9 bg-input/60 text-xs"
                        maxLength={200}
                      />
                    </Field>
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <Field label="복지할인">
                      <Select
                        value={customFields.welfare_discount ?? "해당없음"}
                        onValueChange={(v) => setCustomFields((f) => ({ ...f, welfare_discount: v }))}
                      >
                        <SelectTrigger className="h-9 bg-input/60 text-xs">
                          <SelectValue placeholder="해당없음" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="해당없음">해당없음</SelectItem>
                          <SelectItem value="기초생활수급자">기초생활수급자</SelectItem>
                          <SelectItem value="차상위계층">차상위계층</SelectItem>
                          <SelectItem value="장애인">장애인</SelectItem>
                          <SelectItem value="국가유공자">국가유공자</SelectItem>
                          <SelectItem value="기초연금수급자">기초연금수급자</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
          </div>

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
          {(() => {
            const method: "account" | "card" =
              customFields.autopay_method === "card" ? "card" : "account";
            const thirdParty = !!customFields.autopay_third_party;
            const setMethod = (m: "account" | "card") =>
              setCustomFields((f) => ({ ...f, autopay_method: m }));
            const formatCardNumber = (raw: string) => {
              const d = raw.replace(/\D/g, "").slice(0, 16);
              return d.replace(/(.{4})/g, "$1-").replace(/-$/, "");
            };
            const formatExpiry = (raw: string) => {
              const d = raw.replace(/\D/g, "").slice(0, 4);
              return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
            };
            return (
              <div className="border border-border/30 rounded-xl p-3 mt-2 mb-2 bg-muted/10 transition-all duration-300 ease-out">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Banknote className="size-3.5 text-primary" />
                  <span className="text-xs font-semibold">자동이체 정보</span>
                  <span className="text-[10px] text-muted-foreground">월 요금 자동 출금 수단</span>
                  {/* 결제수단 토글 */}
                  <div className="ml-auto flex items-center gap-1 rounded-lg border border-border/40 bg-background/60 p-0.5">
                    <button
                      type="button"
                      onClick={() => setMethod("account")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        method === "account"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/40"
                      }`}
                    >계좌이체</button>
                    <button
                      type="button"
                      onClick={() => setMethod("card")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        method === "card"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/40"
                      }`}
                    >신용카드</button>
                  </div>
                  {/* 제3자 결제 토글 */}
                  <button
                    type="button"
                    onClick={() => setCustomFields((f) => ({ ...f, autopay_third_party: !f.autopay_third_party }))}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      thirdParty
                        ? "border-amber-500/60 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                        : "border-border/40 bg-background/60 text-muted-foreground hover:bg-muted/40"
                    }`}
                    title="가입자와 결제 명의자가 다를 경우 ON"
                  >
                    {thirdParty ? "● 제3자 결제" : "○ 제3자 결제"}
                  </button>
                </div>

                {/* 결제수단별 동적 폼 */}
                <div className="animate-fade-in">
                  {method === "account" ? (
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
                  ) : (
                    <Grid cols={3}>
                      <Field label="카드사">
                        <Input
                          value={customFields.autopay_card_company ?? ""}
                          onChange={(e) =>
                            setCustomFields((f) => ({ ...f, autopay_card_company: e.target.value.slice(0, 30) }))
                          }
                          placeholder="국민/신한/현대 등"
                          className="h-9 bg-input/60 text-xs"
                          maxLength={30}
                        />
                      </Field>
                      <Field label="카드번호">
                        <Input
                          value={customFields.autopay_card_number ?? ""}
                          onChange={(e) =>
                            setCustomFields((f) => ({ ...f, autopay_card_number: formatCardNumber(e.target.value) }))
                          }
                          placeholder="1234-5678-9012-3456"
                          className="h-9 bg-input/60 text-xs tabular-nums"
                          inputMode="numeric"
                          maxLength={19}
                        />
                      </Field>
                      <Field label="유효기간 (MM/YY)">
                        <Input
                          value={customFields.autopay_card_expiry ?? ""}
                          onChange={(e) =>
                            setCustomFields((f) => ({ ...f, autopay_card_expiry: formatExpiry(e.target.value) }))
                          }
                          placeholder="MM/YY"
                          className="h-9 bg-input/60 text-xs tabular-nums"
                          inputMode="numeric"
                          maxLength={5}
                        />
                      </Field>
                    </Grid>
                  )}
                </div>

                {/* 제3자 결제 정보 (조건부) */}
                {thirdParty && (
                  <div className="mt-3 pt-3 border-t border-dashed border-border/40 animate-fade-in">
                    <div className="text-[10px] text-amber-700 dark:text-amber-400 mb-1.5 font-medium">
                      ⚠ 가입자와 결제 명의자가 다른 경우 — 명의자 정보를 입력하세요
                    </div>
                    <Grid cols={3}>
                      <Field label="명의자 성함">
                        <Input
                          value={customFields.autopay_owner_name ?? ""}
                          onChange={(e) =>
                            setCustomFields((f) => ({ ...f, autopay_owner_name: e.target.value.slice(0, 30) }))
                          }
                          placeholder="홍길동"
                          className="h-9 bg-input/60 text-xs"
                          maxLength={30}
                        />
                      </Field>
                      <Field label="가입자와의 관계">
                        <Select
                          value={customFields.autopay_owner_relation ?? ""}
                          onValueChange={(v) => setCustomFields((f) => ({ ...f, autopay_owner_relation: v }))}
                        >
                          <SelectTrigger className="h-9 bg-input/60 text-xs">
                            <SelectValue placeholder="관계 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {["배우자", "부모", "자녀", "형제/자매", "본인", "친척", "지인", "기타"].map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="명의자 생년월일">
                        <Input
                          type="date"
                          value={customFields.autopay_owner_birth ?? ""}
                          onChange={(e) => setCustomFields((f) => ({ ...f, autopay_owner_birth: e.target.value }))}
                          className="h-9 bg-input/60 text-xs"
                        />
                      </Field>
                    </Grid>
                  </div>
                )}
              </div>
            );
          })()}

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

        {!hideSubmit && (
          <div className="flex gap-3">
            {editingId && (
              <Button type="button" variant="outline" onClick={reset} className="h-10 rounded-2xl text-sm">
                <X className="size-4 mr-2" /> 취소
              </Button>
            )}
            <Button type="submit" disabled={busy || loadingSale} className="flex-1 h-10 bg-gradient-primary shadow-glow rounded-2xl text-sm font-semibold">
              <Check className="size-4 mr-2" /> {loadingSale ? "불러오는 중…" : (editingId ? "수정 저장" : "판매 1건 저장")}
            </Button>
          </div>
        )}
      </form>
    </>
  );
}

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

export default SaleEditForm;
