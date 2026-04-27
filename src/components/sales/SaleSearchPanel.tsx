import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Edit3, FileText, History, Save, Phone, User, Smartphone, Lock,
  ShieldCheck, AlertCircle, CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Bell, CalendarX2, X,
} from "lucide-react";
import { toast } from "sonner";
import { SaleDocuments } from "./SaleDocuments";
import { SaleAuditLog } from "./SaleAuditLog";
import { PendingItemsEditor } from "./PendingItemsEditor";
import { ReviewerPanel } from "./ReviewerPanel";
import { MoneyInput } from "@/components/ui/money-input";
import { useSearchParams } from "react-router-dom";
import { usePeriod } from "@/contexts/PeriodContext";
import { CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";
import { PurgeByFilterDialog, type PurgeFilter } from "@/components/common/PurgeByFilterDialog";

type ApprovalStatus = "승인대기" | "검수완료" | "확정" | "반려" | "수정요청" | "환수" | "취소";

interface SaleHit {
  id: string;
  created_by: string;
  customer_name: string | null;
  phone: string | null;
  device_serial: string | null;
  device_model: string | null;
  channel: string | null;
  product: string | null;
  rate_plan: string | null;
  status: string | null;
  open_date: string | null;
  manager: string | null;
  unit_price: number | null;
  net_fee: number | null;
  note: string | null;
  approval_status: ApprovalStatus | null;
  locked: boolean | null;
  approved_at: string | null;
  pending_items: string[] | null;
  pending_note: string | null;
  pending_resolved: boolean | null;
  approval_override_reason: string | null;
  distributor_amount: number | null;
  cash_support_amount: number | null;
  cash_open: boolean | null;
  receivable_amount: number | null;
  receivable_paid: string | null;
  revision_fields: string[] | null;
  revision_reason: string | null;
  revision_requested_at: string | null;
  re_review_requested_at: string | null;
  // 추가 표시용
  bundle?: string | null;
  sale_type?: string | null;
  open_method?: string | null;
  birth_date?: string | null;
  vas_fee?: number | null;
  extra_subsidy?: number | null;
  moyo_excluded?: boolean | null;
  custom_fields?: Record<string, any> | null;
}

const EDITABLE_FIELDS: Array<{ key: keyof SaleHit; label: string; type?: string }> = [
  { key: "customer_name", label: "고객명" },
  { key: "phone", label: "전화번호" },
  { key: "birth_date", label: "생년월일" },
  { key: "device_model", label: "단말기 모델" },
  { key: "device_serial", label: "단말기 일련번호" },
  { key: "channel", label: "채널" },
  { key: "product", label: "상품" },
  { key: "rate_plan", label: "요금제" },
  { key: "sale_type", label: "가입유형" },
  { key: "open_method", label: "개통방식" },
  { key: "bundle", label: "결합/번들" },
  { key: "status", label: "상태" },
  { key: "manager", label: "담당자" },
  { key: "open_date", label: "개통일", type: "date" },
  { key: "unit_price", label: "단가", type: "number" },
  { key: "vas_fee", label: "부가서비스 수수료", type: "number" },
  { key: "extra_subsidy", label: "추가지원금", type: "number" },
  { key: "note", label: "메모" },
];

const APPROVAL_META: Record<ApprovalStatus, { className: string; icon: typeof CheckCircle2 }> = {
  승인대기: { className: "border-amber-400 text-amber-700 bg-amber-50", icon: AlertCircle },
  검수완료: { className: "border-sky-500/50 text-sky-300 bg-sky-500/10", icon: ShieldCheck },
  확정: { className: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", icon: CheckCircle2 },
  반려: { className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
  수정요청: { className: "border-orange-400 text-orange-700 bg-orange-50", icon: Edit3 },
  환수: { className: "border-orange-400 text-orange-700 bg-orange-50", icon: RotateCcw },
  취소: { className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
};

const SELECT_COLS =
  "id, created_by, customer_name, phone, birth_date, device_serial, device_model, channel, product, rate_plan, sale_type, open_method, bundle, status, open_date, manager, unit_price, vas_fee, extra_subsidy, moyo_excluded, net_fee, note, approval_status, locked, approved_at, pending_items, pending_note, pending_resolved, approval_override_reason, distributor_amount, cash_support_amount, cash_open, receivable_amount, receivable_paid, revision_fields, revision_reason, revision_requested_at, re_review_requested_at, custom_fields";

const PENDING_ACTIVATION_STATUSES = ["청약완료", "택배발송"] as const;
const PENDING_ACTIVATION_STATUS_SET = new Set<string>(PENDING_ACTIVATION_STATUSES);
const PENDING_ACTIVATION_STATUS_OR =
  "status.eq.청약완료,status.eq.택배발송,status.ilike.청약*완료,status.ilike.택배*발송";
const normalizeStatusValue = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, "").trim();
const matchesPendingActivationStatus = (value: string | null | undefined) =>
  PENDING_ACTIVATION_STATUS_SET.has(normalizeStatusValue(value));

// 상품군에 따라 완료 버튼 라벨/저장값 결정
const isHomeProduct = (product: string | null | undefined) => {
  const p = (product ?? "").toString();
  return /홈|인터넷|TV|IOT|스마트홈/i.test(p);
};
const completionStatusFor = (product: string | null | undefined) =>
  isHomeProduct(product) ? "설치완료" : "개통완료";
const completionLabelFor = (product: string | null | undefined) =>
  isHomeProduct(product) ? "설치 완료" : "개통 완료";

const SALE_STATUS_BADGE: Record<string, string> = {
  청약완료: "border-sky-400 text-sky-700 bg-sky-50 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  택배발송: "border-indigo-400 text-indigo-700 bg-indigo-50 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  개통완료: "border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  설치완료: "border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  예약: "border-violet-400 text-violet-700 bg-violet-50 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  보류: "border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  취소: "border-destructive/40 text-destructive bg-destructive/10",
};

interface SaleSearchPanelProps {
  presetStatus?: string | null;
  bypassPeriod?: boolean;
}

export const SaleSearchPanel = ({ presetStatus = null, bypassPeriod = false }: SaleSearchPanelProps = {}) => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { startDate, endDate, label, setSingleDay } = usePeriod();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unhandledOnly, setUnhandledOnly] = useState(false);
  const [unhandledCount, setUnhandledCount] = useState(0);
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [abnormalCount, setAbnormalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<string | null>(null);
  const [todayReviewedCount, setTodayReviewedCount] = useState(0);
  const [results, setResults] = useState<SaleHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SaleHit | null>(null);
  const [editForm, setEditForm] = useState<Partial<SaleHit>>({});
  const [saving, setSaving] = useState(false);
  // 미처리 편집 상태
  const [pendingItems, setPendingItems] = useState<string[]>([]);
  const [pendingNote, setPendingNote] = useState<string>("");
  const [pendingResolved, setPendingResolved] = useState<boolean>(true);
  // 미처리 있는데 확정 시도 시 사유 입력
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingApprovalTarget, setPendingApprovalTarget] = useState<ApprovalStatus | null>(null);

  // bulk
  const resultIds = useMemo(() => results.map((r) => r.id), [results]);
  const bulk = useBulkSelection<string>(resultIds);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  // 개통/설치 완료 처리 중인 행(부드러운 사라짐 애니메이션용)
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  const markCompletion = async (row: SaleHit, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = completionStatusFor(row.product);
    // 1) 애니메이션 트리거
    setCompletingIds((prev) => {
      const n = new Set(prev);
      n.add(row.id);
      return n;
    });
    // 2) DB 업데이트
    const { error } = await supabase
      .from("sales")
      .update({ status: nextStatus })
      .eq("id", row.id);
    if (error) {
      toast.error("완료 처리 실패: " + error.message);
      setCompletingIds((prev) => {
        const n = new Set(prev);
        n.delete(row.id);
        return n;
      });
      return;
    }
    toast.success(`${row.customer_name ?? "고객"} · ${nextStatus} 처리됨`);
    // 3) 애니메이션 후 리스트에서 제거
    setTimeout(() => {
      setResults((prev) => prev.filter((r) => r.id !== row.id));
      setCompletingIds((prev) => {
        const n = new Set(prev);
        n.delete(row.id);
        return n;
      });
      refreshCounts();
    }, 320);
  };

  const purgeFilter: PurgeFilter = useMemo(() => ({
    table: "sales",
    filters: [
      { column: "open_date", op: "gte", value: startDate },
      { column: "open_date", op: "lte", value: endDate },
    ],
    summary: `개통일 ${startDate} ~ ${endDate}`,
  }), [startDate, endDate]);

  const bulkApprove = async (status: ApprovalStatus) => {
    setBulkBusy(true);
    const { error } = await supabase.from("sales").update({ approval_status: status }).in("id", bulk.selectedIds);
    setBulkBusy(false);
    if (error) { toast.error("일괄 처리 실패: " + error.message); return; }
    toast.success(`${bulk.selectedIds.length}건 → ${status}`);
    bulk.clear();
    refreshCounts();
    search();
  };
  const bulkDelete = async () => {
    setBulkBusy(true);
    const { error } = await supabase.from("sales").delete().in("id", bulk.selectedIds);
    setBulkBusy(false);
    if (error) { toast.error("일괄 삭제 실패: " + error.message); return; }
    toast.success(`${bulk.selectedIds.length}건 삭제됨`);
    setBulkDeleteOpen(false);
    bulk.clear();
    refreshCounts();
    search();
  };

  // ※ 잠금 정책 폐지 — 본인 또는 관리자는 언제든 수정 가능 (변경 이력은 sales_audit_log 자동 기록)
  const isInspected =
    !!selected && (selected.approval_status === "확정" || selected.approval_status === "검수완료");
  const canEdit = useMemo(() => {
    if (!selected || !user) return false;
    if (isAdmin) return true;
    return selected.created_by === user.id;
  }, [selected, user, isAdmin]);

  // 미승인 / 미처리 카운트
  const refreshCounts = async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const [{ count: c1 }, { count: c2 }, abnormalRes, reviewedRes] = await Promise.all([
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("approval_status", "승인대기"),
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("pending_resolved", false),
      supabase.from("sales").select("id", { count: "exact", head: true }).contains("custom_fields", { final_verdict: "비정상" }),
      supabase.from("sales").select("id", { count: "exact", head: true })
        .in("approval_status", ["검수완료", "확정"])
        .gte("approved_at", `${todayStr}T00:00:00`),
    ]);
    setPendingCount(c1 ?? 0);
    setUnhandledCount(c2 ?? 0);
    setAbnormalCount(abnormalRes.count ?? 0);
    setTodayReviewedCount(reviewedRes.count ?? 0);
  };

  useEffect(() => {
    refreshCounts();
  }, []);

  const search = async (
    override?: string,
    pendingOverride?: boolean,
    unhandledOverride?: boolean,
    abnormalOverride?: boolean,
    statusOverride?: string | null,
    approvalOverride?: string | null,
    autoOpenIfSingle?: boolean,
  ) => {
    const term = (override ?? q).trim();
    const onlyPending = pendingOverride ?? pendingOnly;
    const onlyUnhandled = unhandledOverride ?? unhandledOnly;
    const onlyAbnormal = abnormalOverride ?? abnormalOnly;
    const stStatus = presetStatus ?? (statusOverride !== undefined ? statusOverride : statusFilter);
    const stApproval = approvalOverride !== undefined ? approvalOverride : approvalFilter;
    const statusList = stStatus?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
    const normalizedStatusList = statusList.map(normalizeStatusValue);
    const isPendingActivationFilter =
      normalizedStatusList.length > 0 && normalizedStatusList.every((s) => PENDING_ACTIVATION_STATUS_SET.has(s));

    setSearching(true);
    let query = supabase.from("sales").select(SELECT_COLS);

    if (term) {
      const like = `%${term}%`;
      query = query.or(
        `customer_name.ilike.${like},phone.ilike.${like},device_serial.ilike.${like}`,
      );
    }
    if (onlyPending) query = query.eq("approval_status", "승인대기");
    if (onlyUnhandled) query = query.eq("pending_resolved", false);
    if (onlyAbnormal) query = query.contains("custom_fields", { final_verdict: "비정상" });
    if (stStatus) {
      if (isPendingActivationFilter) query = query.or(PENDING_ACTIVATION_STATUS_OR);
      else if (statusList.length > 1) query = query.in("status", statusList);
      else if (statusList.length === 1) query = query.eq("status", statusList[0]);
    }
    if (stApproval) {
      const list = stApproval.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 1) query = query.in("approval_status", list);
      else if (list.length === 1) query = query.eq("approval_status", list[0]);
    }
    // 기간 필터 적용 (검색어 없이 기간만으로도 조회 가능)
    // 미완료 항목은 open_date가 비어있는 청약완료 건을 위해 created_at을 보조 기간 기준으로 사용
    if (isPendingActivationFilter) {
      query = query.or(
        `and(open_date.gte.${startDate},open_date.lte.${endDate}),and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`,
      );
    } else if (!bypassPeriod) {
      query = query.gte("open_date", startDate).lte("open_date", endDate);
    }

    const { data, error } = await query
      .order("open_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
    setSearching(false);
    if (error) return toast.error(error.message);
    const rows = ((data ?? []) as SaleHit[]).filter((row) =>
      !isPendingActivationFilter || matchesPendingActivationStatus(row.status),
    );
    setResults(rows);
    if (autoOpenIfSingle && rows.length === 1) {
      openDetail(rows[0]);
    }
  };

  // URL params: ?sale=ID 자동 오픈 / ?pending=1 미처리 / ?date=YYYY-MM-DD 단일일자
  // ?status=<개통상태> / ?approval=<승인상태> / ?auto=1 (결과 1건이면 자동 상세 열림)
  useEffect(() => {
    const id = params.get("sale");
    const wantPending = params.get("pending") === "1";
    const dateParam = params.get("date");
    const statusParam = params.get("status");
    const approvalParam = params.get("approval");
    const autoOpen = params.get("auto") === "1";
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSingleDay(dateParam);
      params.delete("date");
      setParams(params, { replace: true });
    }
    if (wantPending) {
      setUnhandledOnly(true);
      search(undefined, undefined, true, undefined, undefined, undefined, autoOpen);
      params.delete("pending");
      params.delete("auto");
      setParams(params, { replace: true });
    } else if (statusParam || approvalParam) {
      if (statusParam) setStatusFilter(statusParam);
      if (approvalParam) setApprovalFilter(approvalParam);
      search(undefined, undefined, undefined, undefined, statusParam ?? null, approvalParam ?? null, autoOpen);
      params.delete("status");
      params.delete("approval");
      params.delete("auto");
      setParams(params, { replace: true });
    }
    if (id) {
      (async () => {
        const { data } = await supabase
          .from("sales")
          .select(SELECT_COLS)
          .eq("id", id)
          .maybeSingle();
        if (data) openDetail(data as SaleHit);
        params.delete("sale");
        setParams(params, { replace: true });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 기간 변경 시 자동 재조회
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // 외부 탭에서 전달받은 상태 프리셋(개통대기/청약완료 등) 적용
  useEffect(() => {
    setStatusFilter(presetStatus ?? null);
    search(undefined, undefined, undefined, undefined, presetStatus ?? null, undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetStatus]);

  const openDetail = (sale: SaleHit) => {
    setSelected(sale);
    setEditForm(sale);
    setPendingItems(sale.pending_items ?? []);
    setPendingNote(sale.pending_note ?? "");
    setPendingResolved(sale.pending_resolved ?? true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!canEdit) return toast.error("수정 권한이 없습니다");
    // ⚠️ 강제 저장(Force Save) 모드: 변경 감지 없이 화면의 모든 값을 그대로 전송
    // (특히 ReviewerPanel 의 '홈 설치 관리' 등 onBlur 기반 패치가 누락되는 케이스 대응)
    const payload: Record<string, unknown> = {};
    EDITABLE_FIELDS.forEach(({ key }) => {
      payload[key as string] = editForm[key] ?? null;
    });
    // 오퍼(지원금) 필드 — 항상 전송
    const offerKeys: (keyof SaleHit)[] = [
      "distributor_amount",
      "cash_support_amount",
      "cash_open",
      "receivable_amount",
      "receivable_paid",
    ];
    offerKeys.forEach((k) => {
      payload[k as string] = (editForm[k] ?? null) as unknown;
    });
    // 미처리 항목 — 항상 전송
    payload.pending_items = pendingItems;
    payload.pending_note = pendingNote || null;
    payload.pending_resolved = pendingItems.length === 0 ? true : pendingResolved;
    // custom_fields (홈 설치 관리, 비정상 사유 등) — 최신값 그대로 전송
    if ((selected as any).custom_fields !== undefined) {
      payload.custom_fields = (selected as any).custom_fields ?? {};
    }
    setSaving(true);
    const { error } = await supabase.from("sales").update(payload as never).eq("id", selected.id);
    setSaving(false);
    if (error) {
      console.error("[saveEdit] update error", error, { saleId: selected.id, payload });
      return toast.error(error.message);
    }
    console.log("[saveEdit] 저장 완료", { saleId: selected.id, fields: Object.keys(payload) });
    toast.success("저장되었습니다");
    const { data } = await supabase.from("sales").select(SELECT_COLS).eq("id", selected.id).maybeSingle();
    if (data) openDetail(data as SaleHit);
    refreshCounts();
    search();
  };

  const performApproval = async (next: ApprovalStatus, overrideReasonValue?: string) => {
    if (!selected || !isAdmin) return;
    const update: Record<string, unknown> = { approval_status: next };
    if (next === "확정" && overrideReasonValue) {
      update.approval_override_reason = overrideReasonValue;
    } else if (next !== "확정") {
      update.approval_override_reason = null;
    }
    const { error } = await supabase
      .from("sales")
      .update(update as never)
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success(`상태를 '${next}'(으)로 변경했습니다`);
    const { data } = await supabase.from("sales").select(SELECT_COLS).eq("id", selected.id).maybeSingle();
    if (data) openDetail(data as SaleHit);
    refreshCounts();
    search();
  };

  const updateApproval = async (next: ApprovalStatus) => {
    if (!selected || !isAdmin) return;
    // 미처리가 남아있는 상태에서 '확정'으로 변경 시도 → 사유 입력 필수
    const hasUnhandled =
      (selected.pending_items?.length ?? 0) > 0 && selected.pending_resolved === false;
    if (next === "확정" && hasUnhandled) {
      setPendingApprovalTarget(next);
      setOverrideReason("");
      setOverrideOpen(true);
      return;
    }
    await performApproval(next);
  };

  return (
    <Card className="p-5 glass border-border/40 mb-6">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Search className="size-4 text-primary-glow" />
        <h3 className="font-semibold">실적 검색 / 수정 / 검수</h3>
        <span className="text-xs text-muted-foreground ml-2">
          고객명 · 전화번호 · 단말기 일련번호(IMEI)
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {(statusFilter || approvalFilter) && (
            <Badge
              variant="outline"
              className="border-primary/40 text-primary bg-primary/10 gap-1 cursor-pointer"
              onClick={() => {
                setStatusFilter(null);
                setApprovalFilter(null);
                search(undefined, undefined, undefined, undefined, null, null);
              }}
              title="필터 해제"
            >
              필터: {statusFilter ?? approvalFilter} <X className="size-3" />
            </Badge>
          )}
          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 gap-1">
            <AlertCircle className="size-3" /> 미승인 {pendingCount}건
          </Badge>
          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 gap-1">
            <AlertTriangle className="size-3" /> 미처리 {unhandledCount}건
          </Badge>
          <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10 gap-1">
            <AlertTriangle className="size-3" /> 비정상 {abnormalCount}건
          </Badge>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 gap-1">
            <ShieldCheck className="size-3" /> 오늘 검수 {todayReviewedCount}건
          </Badge>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
            <Switch
              id="pending-only"
              checked={pendingOnly}
              onCheckedChange={(v) => {
                setPendingOnly(v);
                search(undefined, v);
              }}
            />
            <Label htmlFor="pending-only" className="text-xs cursor-pointer">
              미승인만
            </Label>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40">
            <Switch
              id="unhandled-only"
              checked={unhandledOnly}
              onCheckedChange={(v) => {
                setUnhandledOnly(v);
                search(undefined, undefined, v);
              }}
            />
            <Label htmlFor="unhandled-only" className="text-xs cursor-pointer">
              미처리만
            </Label>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/5 border border-destructive/30">
            <Switch
              id="abnormal-only"
              checked={abnormalOnly}
              onCheckedChange={(v) => {
                setAbnormalOnly(v);
                search(undefined, undefined, undefined, v);
              }}
            />
            <Label htmlFor="abnormal-only" className="text-xs cursor-pointer text-destructive">
              비정상만
            </Label>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={pendingOnly ? "(미승인 전체 표시 중) 검색어 입력 시 추가 필터…" : "검색어 입력 후 Enter…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="h-10 bg-input/60"
        />
        <Button onClick={() => search()} disabled={searching}>
          <Search className="size-4 mr-1.5" />
          {searching ? "검색 중…" : "검색"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-4 rounded-xl border border-border/40 overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 text-xs text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Checkbox
                checked={bulk.allOnPageSelected}
                onCheckedChange={(v) => bulk.togglePage(!!v)}
                aria-label="모두 선택"
              />
              <CalendarDays className="size-3" /> {label} · 검색 결과 {results.length}건 (날짜 내림차순)
            </span>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={() => setPurgeOpen(true)}>
                  <Trash2 className="size-3 mr-1" /> 기간 전체삭제
                </Button>
              )}
              <span>날짜별로 묶음 · 합계 표시</span>
            </div>
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {(() => {
              // group by open_date
              const groups = new Map<string, SaleHit[]>();
              results.forEach((r) => {
                const k = r.open_date ?? "(날짜없음)";
                const arr = groups.get(k) ?? [];
                arr.push(r);
                groups.set(k, arr);
              });
              const keys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
              return keys.map((dateKey) => {
                const list = groups.get(dateKey)!;
                const dailyNet = list.reduce((s, r) => s + Number(r.net_fee ?? 0), 0);
                const dailyConfirmed = list.filter((r) => r.approval_status === "확정").length;
                const dailyPending = list.filter((r) => r.pending_resolved === false && (r.pending_items?.length ?? 0) > 0).length;
                return (
                  <div key={dateKey}>
                    <div className="sticky top-0 z-10 px-3 py-2 bg-card/80 backdrop-blur border-y border-border/40 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-3.5 text-primary-glow" />
                        <span className="text-sm font-semibold tabular-nums">{dateKey}</span>
                        <Badge variant="outline" className="border-border/50 text-[10px]">{list.length}건</Badge>
                        {dailyConfirmed > 0 && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]">
                            확정 {dailyConfirmed}
                          </Badge>
                        )}
                        {dailyPending > 0 && (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px]">
                            미처리 {dailyPending}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        일별 건수 <span className="font-bold tabular-nums text-foreground">{list.length}건</span>
                      </div>
                    </div>
                    <div className="divide-y divide-border/30">
                      {list.map((r) => {
                        const ap = (r.approval_status ?? "승인대기") as ApprovalStatus;
                        const meta = APPROVAL_META[ap];
                        const Icon = meta.icon;
                        const hasUnhandled = (r.pending_items?.length ?? 0) > 0 && r.pending_resolved === false;
                        const sel = bulk.isSelected(r.id);
                        const cf = (r as any).custom_fields ?? {};
                        const isAbnormal = cf.final_verdict === "비정상" || !!cf.fraud_suspect;
                        const installOverdue = cf.install_date
                          && !cf.install_done
                          && cf.install_date < new Date().toISOString().slice(0, 10);
                        const needsAttention = hasUnhandled || isAbnormal || installOverdue;
                        return (
                          <div
                            key={r.id}
                            className={`flex items-stretch transition-all duration-300 ease-out overflow-hidden ${
                              completingIds.has(r.id)
                                ? "opacity-0 -translate-x-4 max-h-0 py-0 my-0 border-transparent"
                                : "opacity-100 max-h-40"
                            } ${sel ? "bg-primary/5" : ""} ${
                              isAbnormal ? "bg-destructive/5"
                              : installOverdue ? "bg-orange-50/80"
                              : hasUnhandled ? "bg-yellow-100/80" : ""
                            }`}
                          >
                            <div className="pl-3 pr-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={sel} onCheckedChange={() => bulk.toggle(r.id)} />
                            </div>
                            <button
                              onClick={() => openDetail(r)}
                              className="flex-1 text-left px-2 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3"
                            >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                <User className="size-3 text-muted-foreground" />
                                <span className="truncate">{r.customer_name ?? "(이름없음)"}</span>
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                                <span className="flex items-center gap-1"><Phone className="size-3" />{r.phone ?? "-"}</span>
                                <span className="flex items-center gap-1"><Smartphone className="size-3" />{r.device_serial ?? "-"}</span>
                                <span>{r.channel ?? "-"} / {r.product ?? "-"}</span>
                              </div>
                            </div>
                            {/* === 우측 고정 배지 영역: [검수/확정] → [개통상태] → [미처리] === */}
                            <div className="self-center flex flex-col items-end gap-1 mr-3 shrink-0 min-w-[160px]">
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {/* 1. 검수/확정 상태 */}
                                <Badge variant="outline" className={`text-[10px] gap-1 ${meta.className}`}>
                                  <Icon className="size-3" /> {ap}
                                </Badge>
                                {/* 2. 개통 상태 */}
                                {r.status && (
                                  <Badge variant="outline" className={`text-[10px] ${SALE_STATUS_BADGE[r.status] ?? ""}`}>{r.status}</Badge>
                                )}
                                {/* 3. 미처리 */}
                                {hasUnhandled && (
                                  <Badge variant="outline" className="text-[10px] gap-1 border-amber-500 text-amber-700 bg-amber-50">
                                    <AlertTriangle className="size-3" /> 미처리 {r.pending_items?.length}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-wrap justify-end">
                                {installOverdue && (
                                  <Badge variant="outline" className="text-[10px] gap-1 border-orange-500 text-orange-700 bg-orange-50">
                                    <CalendarX2 className="size-3" /> 설치지연
                                  </Badge>
                                )}
                                {(r as any).custom_fields?.fraud_suspect && (
                                  <Badge variant="outline" className="text-[10px] gap-1 border-destructive/60 text-destructive bg-destructive/10 animate-pulse">
                                    <AlertTriangle className="size-3" /> 이상영업
                                  </Badge>
                                )}
                                {(r as any).custom_fields?.final_verdict === "비정상" && (
                                  <Badge variant="outline" className="text-[10px] gap-1 border-destructive/60 text-destructive bg-destructive/10">
                                    비정상
                                  </Badge>
                                )}
                                {needsAttention && (
                                  <span
                                    title="CS 확인 필요"
                                    className="flex items-center gap-1 text-[10px] font-semibold text-destructive animate-pulse"
                                  >
                                    <Bell className="size-3" /> 확인 필요
                                  </span>
                                )}
                              </div>
                            </div>
                            </button>
                            {/* 전용 완료 버튼: 모바일=개통완료 / 홈=설치완료 */}
                            {matchesPendingActivationStatus(r.status) && (
                              <div className="self-center pr-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  onClick={(e) => markCompletion(r, e)}
                                  disabled={completingIds.has(r.id)}
                                  className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                  title={`${completionLabelFor(r.product)} 처리 (리스트에서 제거)`}
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  {completionLabelFor(r.product)}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 상세/수정 다이얼로그 */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-[1400px] w-[95vw] max-h-[88vh] overflow-y-auto pb-20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              실적 상세
              {selected && (() => {
                const ap = (selected.approval_status ?? "승인대기") as ApprovalStatus;
                const meta = APPROVAL_META[ap];
                const Icon = meta.icon;
                return (
                  <Badge variant="outline" className={`text-[10px] gap-1 ${meta.className}`}>
                    <Icon className="size-3" /> {ap}
                  </Badge>
                );
              })()}
              {!canEdit && (
                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                  <Lock className="size-3" /> 읽기 전용
                </Badge>
              )}
              {(selected?.pending_items?.length ?? 0) > 0 && selected?.pending_resolved === false && (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-400 text-amber-700 bg-amber-50">
                  <AlertTriangle className="size-3" /> 미처리 {selected?.pending_items?.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_560px] gap-5">
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">
                  <Edit3 className="size-3.5 mr-1" /> 정보
                </TabsTrigger>
                <TabsTrigger value="pending">
                  <AlertTriangle className="size-3.5 mr-1" /> 미처리
                </TabsTrigger>
                <TabsTrigger value="docs">
                  <FileText className="size-3.5 mr-1" /> 가입 서류
                </TabsTrigger>
                <TabsTrigger value="audit">
                  <History className="size-3.5 mr-1" /> 검수 타임라인
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="mt-4">
                {isInspected && (
                  <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="size-3.5" />
                    이 실적은 [검수 완료] 처리되었습니다. 수정 시 변경 이력이 자동으로 기록됩니다.
                  </div>
                )}
                {/* === 검수 핵심 요약 (번들·동판·TV·VAS) === */}
                {(() => {
                  const cf = ((selected as any).custom_fields ?? {}) as Record<string, any>;
                  const tvLines: Array<{ rate_plan?: string; settop?: string }> =
                    Array.isArray(cf.tv_lines) ? cf.tv_lines : [];
                  const vas1 = cf.vas1 ?? cf.vas_1 ?? null;
                  const vas2 = cf.vas2 ?? cf.vas_2 ?? null;
                  const bundle = (selected as any).bundle as string | null;
                  const isCash = !!(selected as any).cash_open || Number((selected as any).cash_support_amount ?? 0) > 0;
                  const hasBundleInfo = bundle || isCash || tvLines.length > 0;
                  return (
                    <div className="mb-4 rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/[0.02] p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-primary" />
                        <h4 className="text-sm font-bold">검수 핵심 요약 — 번들 / 동판 / 추가회선</h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-lg bg-background/60 border border-border/40 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">결합/번들</div>
                          <div className={"text-sm font-bold mt-0.5 " + (bundle ? "text-foreground" : "text-muted-foreground/60")}>
                            {bundle || "(없음)"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-background/60 border border-border/40 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">동판 / 현금개통</div>
                          <div className={"text-sm font-bold mt-0.5 " + (isCash ? "text-warning" : "text-muted-foreground/60")}>
                            {isCash ? "✓ 현금개통" : "(아니오)"}
                          </div>
                        </div>
                        <div className="rounded-lg bg-background/60 border border-border/40 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">가입유형</div>
                          <div className="text-sm font-bold mt-0.5">{(selected as any).sale_type || "(미지정)"}</div>
                        </div>
                        <div className="rounded-lg bg-background/60 border border-border/40 px-3 py-2">
                          <div className="text-[10px] text-muted-foreground">개통방식</div>
                          <div className="text-sm font-bold mt-0.5">{(selected as any).open_method || "(미지정)"}</div>
                        </div>
                      </div>
                      {tvLines.length > 0 && (
                        <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                          <div className="text-[11px] font-semibold text-muted-foreground mb-2">
                            TV 추가회선 ({tvLines.length}개)
                          </div>
                          <div className="space-y-1.5">
                            {tvLines.map((l, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs px-2 py-1.5 rounded-md bg-muted/30">
                                <span className="font-mono text-primary font-bold">TV{i + 1}</span>
                                <span className="flex-1">
                                  <span className="text-muted-foreground">요금제:</span>{" "}
                                  <span className="font-medium">{l.rate_plan || "—"}</span>
                                </span>
                                <span className="flex-1">
                                  <span className="text-muted-foreground">셋톱:</span>{" "}
                                  <span className="font-medium">{l.settop || "—"}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(vas1 || vas2) && (
                        <div className="rounded-lg border border-border/40 bg-background/60 p-3">
                          <div className="text-[11px] font-semibold text-muted-foreground mb-2">부가서비스</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-muted-foreground">VAS1:</span> <span className="font-medium">{vas1 || "—"}</span></div>
                            <div><span className="text-muted-foreground">VAS2:</span> <span className="font-medium">{vas2 || "—"}</span></div>
                          </div>
                        </div>
                      )}
                      {!hasBundleInfo && !vas1 && !vas2 && (
                        <p className="text-[11px] text-muted-foreground">번들/추가회선/부가서비스 정보가 없습니다.</p>
                      )}
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 gap-3">
                  {EDITABLE_FIELDS.map(({ key, label, type }) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type={type ?? "text"}
                        value={(editForm[key] as string | number | null) ?? ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            [key]:
                              type === "number"
                                ? e.target.value === ""
                                  ? null
                                  : Number(e.target.value)
                                : e.target.value,
                          })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  ))}
                </div>

                {/* 오퍼(지원금) 관리 — 지출 대시보드 자동 집계 */}
                <div className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="size-3.5 text-primary-glow" />
                    <h4 className="text-sm font-semibold">오퍼(지원금) 관리</h4>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    아래 3개 항목은 <span className="text-foreground font-medium">지출 대시보드</span>에 자동 집계됩니다. 천 단위 콤마가 자동 표시됩니다.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">① 유통망 지원금 (₩)</Label>
                      <MoneyInput
                        value={editForm.distributor_amount ?? 0}
                        onChange={(v) => setEditForm({ ...editForm, distributor_amount: v })}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">② 현금개통 금액 (₩)</Label>
                      <MoneyInput
                        value={editForm.cash_support_amount ?? 0}
                        onChange={(v) =>
                          setEditForm({
                            ...editForm,
                            cash_support_amount: v,
                            cash_open: v > 0,
                          })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">③ 고객입금 금액 (₩)</Label>
                      <MoneyInput
                        value={editForm.receivable_amount ?? 0}
                        onChange={(v) => setEditForm({ ...editForm, receivable_amount: v })}
                        disabled={!canEdit}
                      />
                      <Input
                        value={editForm.receivable_paid ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, receivable_paid: e.target.value })}
                        placeholder="입금 유/완료/일자 (예: 2026-04-19)"
                        disabled={!canEdit}
                        className="h-9 bg-input/60 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setSelected(null)}>닫기</Button>
                  <Button onClick={saveEdit} disabled={!canEdit || saving}>
                    <Save className="size-4 mr-1.5" />
                    {saving ? "저장 중…" : "저장"}
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="pending" className="mt-4">
                <PendingItemsEditor
                  items={pendingItems}
                  note={pendingNote}
                  resolved={pendingResolved}
                  onItemsChange={setPendingItems}
                  onNoteChange={setPendingNote}
                  onResolvedChange={setPendingResolved}
                  disabled={!canEdit}
                  showResolvedToggle
                />
                <DialogFooter className="mt-4">
                  <Button onClick={saveEdit} disabled={!canEdit || saving}>
                    <Save className="size-4 mr-1.5" />
                    {saving ? "저장 중…" : "미처리 저장"}
                  </Button>
                </DialogFooter>
              </TabsContent>

              <TabsContent value="docs" className="mt-4">
                <SaleDocuments
                  saleId={selected.id}
                  saleMeta={{
                    open_date: selected.open_date,
                    customer_name: selected.customer_name,
                  }}
                  readOnly={!canEdit}
                />
              </TabsContent>

              <TabsContent value="audit" className="mt-4">
                <SaleAuditLog
                  saleId={selected.id}
                  onRestored={async () => {
                    const { data } = await supabase.from("sales").select(SELECT_COLS).eq("id", selected.id).maybeSingle();
                    if (data) openDetail(data as SaleHit);
                    refreshCounts();
                    search();
                  }}
                />
              </TabsContent>
            </Tabs>

            {/* === 항상 보이는 검수/메모 사이드 패널 === */}
            <aside className="lg:sticky lg:top-2 self-start space-y-4">
              <ReviewerPanel
                sale={{
                  id: selected.id,
                  created_by: selected.created_by,
                  customer_name: selected.customer_name,
                  approval_status: selected.approval_status,
                  revision_fields: selected.revision_fields,
                  revision_reason: selected.revision_reason,
                  revision_requested_at: selected.revision_requested_at,
                  re_review_requested_at: selected.re_review_requested_at,
                  approved_at: selected.approved_at,
                  pending_items: selected.pending_items,
                  pending_note: (selected as any).pending_note ?? null,
                  pending_resolved: selected.pending_resolved,
                  product: (selected as any).product ?? null,
                  custom_fields: (selected as any).custom_fields ?? null,
                }}
                onChanged={async () => {
                  const { data } = await supabase.from("sales").select(SELECT_COLS).eq("id", selected.id).maybeSingle();
                  if (data) openDetail(data as SaleHit);
                  refreshCounts();
                  search();
                }}
              />
              {selected.approval_override_reason && (
                <div className="rounded-lg border border-orange-300 bg-orange-500/5 px-3 py-2 text-xs text-orange-200">
                  <b>강제 승인 사유:</b> {selected.approval_override_reason}
                </div>
              )}
            </aside>
            </div>
          )}
          {/* CS 진행 상태 요약 — 검수자가 한눈에 확인 */}
          <div className="mt-4 rounded-lg border border-border/40 bg-muted/30 px-4 py-2.5 flex items-center gap-4 flex-wrap text-xs">
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary-glow" /> CS 진행 상태
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-400" />
              오늘 검수 완료 <b className="tabular-nums text-foreground">{todayReviewedCount}건</b>
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-3 text-amber-500" />
              미처리 잔여 <b className="tabular-nums text-foreground">{unhandledCount}건</b>
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle className="size-3 text-amber-500" />
              미승인 <b className="tabular-nums text-foreground">{pendingCount}건</b>
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="size-3 text-destructive" />
              비정상 <b className="tabular-nums text-foreground">{abnormalCount}건</b>
            </span>
            <span className="ml-auto text-muted-foreground">
              저장 시 리스트가 즉시 갱신됩니다.
            </span>
          </div>
          {/* === 퀵 메뉴 (스크롤과 무관하게 항상 표시) === */}
          {selected && (
            <div className="sticky bottom-0 left-0 right-0 -mx-6 -mb-6 mt-4 px-6 py-3 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center justify-end gap-2 z-10">
              <span className="text-[11px] text-muted-foreground mr-auto">
                저장 시 리스트가 즉시 갱신됩니다.
              </span>
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                <X className="size-4 mr-1.5" /> 닫기
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={!canEdit || saving} className="bg-gradient-primary">
                <Save className="size-4 mr-1.5" />
                {saving ? "저장 중…" : "저장"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 미처리 강제 승인 사유 다이얼로그 */}
      <AlertDialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" /> 완료 전 승인 경고
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 실적에는 미처리 항목이 남아있습니다
              {selected?.pending_items?.length ? ` (${selected.pending_items.join(", ")})` : ""}.
              그래도 '확정'으로 변경하려면 사유를 입력하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="예: 정산 마감 일정상 선승인, 서류는 3일 내 보완 예정"
            rows={3}
            className="bg-input/60"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!overrideReason.trim()) {
                  toast.error("승인 사유를 입력하세요");
                  return;
                }
                const target = pendingApprovalTarget ?? "확정";
                setOverrideOpen(false);
                await performApproval(target, overrideReason.trim());
                setPendingApprovalTarget(null);
              }}
            >
              사유와 함께 확정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
        {isAdmin && (
          <>
            <Button size="sm" variant="default" onClick={() => bulkApprove("확정")} disabled={bulkBusy}>
              일괄 확정
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkApprove("반려")} disabled={bulkBusy}>
              일괄 반려
            </Button>
          </>
        )}
        <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)} disabled={bulkBusy}>
          <Trash2 className="size-3.5 mr-1" /> 선택 삭제
        </Button>
      </BulkActionBar>

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={bulk.selectedCount}
        itemLabel="건의 실적을 삭제하시겠습니까?"
        onConfirm={bulkDelete}
        loading={bulkBusy}
        confirmLabel="삭제"
      />

      <PurgeByFilterDialog
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        filter={purgeFilter}
        onDone={() => { refreshCounts(); search(); }}
      />
    </Card>
  );
};
