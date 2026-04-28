import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, XCircle, Edit3, RotateCcw, AlertCircle,
  MessageSquare, Send, ShieldCheck, Clock, ShieldAlert, MessageCircle,
  Home, CalendarClock, Gavel,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { PendingItemsEditor } from "./PendingItemsEditor";

interface ChecklistItem {
  key: string;
  label: string;
  enabled?: boolean;
  required?: boolean;
  field?: string | null;
}
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { key: "docs_match", label: "가입 서류 일치", enabled: true, required: true },
  { key: "plan_match", label: "요금제 확인", enabled: true, required: true, field: "rate_plan" },
  { key: "price_match", label: "단가 확인", enabled: true, required: true, field: "unit_price" },
  { key: "vas_match", label: "부가서비스 확인", enabled: true, required: false, field: "vas1" },
  { key: "autodebit_match", label: "자동이체 / 입금계좌 확인", enabled: true, required: false, field: "auto_debit" },
  { key: "bundle_match", label: "결합 확인", enabled: true, required: false, field: "bundle" },
];

export type ApprovalStatus = "승인대기" | "검수완료" | "확정" | "반려" | "수정요청" | "환수" | "취소";

export const REVISION_FIELD_OPTIONS = [
  "고객 정보",
  "단말기 정보",
  "요금제",
  "지원금/오퍼",
  "가입 서류",
  "부가서비스",
  "결합/할부",
  "기타",
] as const;

interface SaleSnapshot {
  id: string;
  created_by: string;
  customer_name: string | null;
  approval_status: string | null;
  revision_fields: string[] | null;
  revision_reason: string | null;
  revision_requested_at: string | null;
  re_review_requested_at: string | null;
  approved_at: string | null;
  pending_items: string[] | null;
  pending_note?: string | null;
  pending_resolved: boolean | null;
  product?: string | null;
  status?: string | null;
  custom_fields?: Record<string, any> | null;
  // 입력 검증용 추가 필드 (선택)
  rate_plan?: string | null;
  device_model?: string | null;
  unit_price?: number | null;
  sale_type?: string | null;
  // 이상영업 신규 컬럼
  is_suspicious?: boolean | null;
  suspicious_reason?: string | null;
}

interface Props {
  sale: SaleSnapshot;
  onChanged: () => void;
}

const STATUS_META: Record<string, { tone: string; icon: typeof CheckCircle2; label: string }> = {
  승인대기: { tone: "border-amber-400 text-amber-700 bg-amber-50", icon: AlertCircle, label: "승인대기" },
  검수완료: { tone: "border-sky-500/50 text-sky-300 bg-sky-500/10", icon: ShieldCheck, label: "검수 완료" },
  확정: { tone: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", icon: CheckCircle2, label: "확정" },
  반려: { tone: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle, label: "반려" },
  수정요청: { tone: "border-orange-400 text-orange-700 bg-orange-50", icon: Edit3, label: "수정요청" },
  환수: { tone: "border-orange-400 text-orange-700 bg-orange-50", icon: RotateCcw, label: "환수" },
  취소: { tone: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle, label: "취소" },
};

export function ReviewerPanel({ sale, onChanged }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { settings } = useAppSettings();
  const isOwner = user?.id === sale.created_by;
  const status = (sale.approval_status ?? "승인대기") as ApprovalStatus;
  const meta = STATUS_META[status] ?? STATUS_META["승인대기"];
  const StatusIcon = meta.icon;

  // 어드민에서 정의한 체크리스트 (없으면 기본값)
  const rawChecklist = Array.isArray(settings["review.checklist"]) && settings["review.checklist"].length > 0
    ? (settings["review.checklist"] as ChecklistItem[])
    : DEFAULT_CHECKLIST;
  // enabled가 false인 항목은 검수창에 노출하지 않음 (관리자가 끈 항목)
  const checklistItems: ChecklistItem[] = rawChecklist
    .map((i) => ({ ...i, enabled: i.enabled !== false }))
    .filter((i) => i.enabled);

  const savedChecks = (sale.custom_fields?.review_checklist ?? {}) as Record<string, boolean>;
  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<string[]>(sale.revision_fields ?? []);
  const [checks, setChecks] = useState<Record<string, boolean>>(savedChecks);
  const [submitting, setSubmitting] = useState(false);
  // 미처리 항목 인라인 편집
  const [pendingItems, setPendingItems] = useState<string[]>(sale.pending_items ?? []);
  const [pendingNote, setPendingNote] = useState<string>(sale.pending_note ?? "");
  const [pendingResolved, setPendingResolved] = useState<boolean>(!!sale.pending_resolved);
  // 신규 검수 메타
  const cf = (sale.custom_fields ?? {}) as Record<string, any>;
  // 이상영업: 신규 컬럼(is_suspicious/suspicious_reason) 우선, 레거시(custom_fields.fraud_*) 폴백
  const [fraudSuspect, setFraudSuspect] = useState<boolean>(
    sale.is_suspicious ?? !!cf.fraud_suspect,
  );
  const [fraudReason, setFraudReason] = useState<string>(
    sale.suspicious_reason ?? cf.fraud_reason ?? "",
  );
  const [installDate, setInstallDate] = useState<string>(cf.install_date ?? "");
  const [installDone, setInstallDone] = useState<boolean>(!!cf.install_done);
  const [finalVerdict, setFinalVerdict] = useState<"" | "정상" | "비정상">(
    (cf.final_verdict as "" | "정상" | "비정상") ?? "",
  );
  const [verdictReason, setVerdictReason] = useState<string>(cf.verdict_reason ?? "");
  // 입력 검증용 마스터 데이터
  const [planMaster, setPlanMaster] = useState<{
    product: string; rate_plan: string; default_sale_type: string | null;
    default_vas1: string | null; default_vas2: string | null;
  } | null>(null);
  const [modelMaster, setModelMaster] = useState<{ model_name: string; retail_price: number } | null>(null);

  useEffect(() => {
    setReason("");
    setFields(sale.revision_fields ?? []);
    setChecks((sale.custom_fields?.review_checklist ?? {}) as Record<string, boolean>);
    setPendingItems(sale.pending_items ?? []);
    setPendingNote(sale.pending_note ?? "");
    setPendingResolved(!!sale.pending_resolved);
    const c = (sale.custom_fields ?? {}) as Record<string, any>;
    setFraudSuspect(sale.is_suspicious ?? !!c.fraud_suspect);
    setFraudReason(sale.suspicious_reason ?? c.fraud_reason ?? "");
    setInstallDate(c.install_date ?? "");
    setInstallDone(!!c.install_done);
    setFinalVerdict((c.final_verdict as "" | "정상" | "비정상") ?? "");
    setVerdictReason(c.verdict_reason ?? "");
  }, [sale.id, sale.revision_fields, sale.custom_fields, sale.pending_items, sale.pending_note, sale.pending_resolved, sale.is_suspicious, sale.suspicious_reason]);

  // 마스터 로드 (요금제·단말기) — 입력값 검증
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const product = sale.product ?? null;
      const ratePlan = sale.rate_plan ?? null;
      const model = sale.device_model ?? null;
      const tasks: PromiseLike<unknown>[] = [];
      if (product && ratePlan) {
        tasks.push(
          supabase
            .from("product_rate_plans")
            .select("product, rate_plan, default_sale_type, default_vas1, default_vas2")
            .eq("product", product).eq("rate_plan", ratePlan).maybeSingle()
            .then(({ data }) => { if (!cancelled) setPlanMaster((data as any) ?? null); }),
        );
      } else { setPlanMaster(null); }
      if (model) {
        tasks.push(
          supabase
            .from("device_models")
            .select("model_name, retail_price")
            .eq("model_name", model).maybeSingle()
            .then(({ data }) => { if (!cancelled) setModelMaster((data as any) ?? null); }),
        );
      } else { setModelMaster(null); }
      await Promise.all(tasks);
    })();
    return () => { cancelled = true; };
  }, [sale.id, sale.product, sale.rate_plan, sale.device_model]);

  // 검증 결과 — 다르면 빨강
  const validations = useMemo(() => {
    const list: Array<{ label: string; expected: string; actual: string; ok: boolean }> = [];
    if (planMaster) {
      const cfAny = (sale.custom_fields ?? {}) as Record<string, any>;
      if (planMaster.default_sale_type && sale.sale_type) {
        list.push({
          label: "가입유형",
          expected: planMaster.default_sale_type,
          actual: sale.sale_type,
          ok: planMaster.default_sale_type === sale.sale_type,
        });
      }
      const vas1 = cfAny.vas1 ?? cfAny.vas_1 ?? null;
      if (planMaster.default_vas1 && vas1) {
        list.push({
          label: "VAS1", expected: planMaster.default_vas1, actual: String(vas1),
          ok: planMaster.default_vas1 === vas1,
        });
      }
      const vas2 = cfAny.vas2 ?? cfAny.vas_2 ?? null;
      if (planMaster.default_vas2 && vas2) {
        list.push({
          label: "VAS2", expected: planMaster.default_vas2, actual: String(vas2),
          ok: planMaster.default_vas2 === vas2,
        });
      }
    }
    if (modelMaster && Number(sale.unit_price ?? 0) > 0 && Number(modelMaster.retail_price ?? 0) > 0) {
      const expected = Number(modelMaster.retail_price);
      const actual = Number(sale.unit_price);
      list.push({
        label: "단말 정상가",
        expected: expected.toLocaleString("ko-KR"),
        actual: actual.toLocaleString("ko-KR"),
        ok: Math.abs(expected - actual) <= expected * 0.05, // 5% 오차 허용
      });
    }
    return list;
  }, [planMaster, modelMaster, sale.sale_type, sale.unit_price, sale.custom_fields]);

  const checkedCount = checklistItems.filter((i) => checks[i.key]).length;
  const requiredItems = checklistItems.filter((i) => i.required);
  const allRequiredChecked = requiredItems.every((i) => checks[i.key]);
  const allChecked = checkedCount === checklistItems.length;
  const isHomeProduct = (sale.product ?? "").includes("인터넷")
    || (sale.product ?? "").includes("TV")
    || (sale.product ?? "").includes("홈");

  // 상품군별 종결 토글: 모바일/2nd → 개통완료 / 홈군 → 설치완료
  const normalizedStatus = (sale.status ?? "").replace(/\s+/g, "").trim();
  const completionTarget = isHomeProduct ? "설치완료" : "개통완료";
  const completionPrev = isHomeProduct ? "청약완료" : "택배발송";
  const isCompleted = normalizedStatus === completionTarget;
  const canToggleCompletion = isCompleted || normalizedStatus === completionPrev;
  const [marking, setMarking] = useState(false);
  const toggleCompletion = async () => {
    setMarking(true);
    const nextStatus = isCompleted ? completionPrev : completionTarget;
    const { error } = await supabase
      .from("sales")
      .update({ status: nextStatus } as never)
      .eq("id", sale.id);
    setMarking(false);
    if (error) return toast.error(error.message);
    toast.success(`${nextStatus}로 변경되었습니다`);
    onChanged();
  };

  // 신규 메타 저장 helpers
  const patchCustom = async (patch: Record<string, any>) => {
    const next = { ...(sale.custom_fields ?? {}), ...patch };
    const { error } = await supabase
      .from("sales")
      .update({ custom_fields: next } as never)
      .eq("id", sale.id);
    if (error) toast.error(error.message);
    else onChanged();
  };

  const savePendingInline = async () => {
    setSubmitting(true);
    const { error } = await supabase
      .from("sales")
      .update({
        pending_items: pendingItems as any,
        pending_note: pendingNote || null,
        pending_resolved: pendingResolved || pendingItems.length === 0,
      } as never)
      .eq("id", sale.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("미처리 항목이 저장되었습니다");
    onChanged();
  };

  const toggleCheck = async (key: string) => {
    if (!isAdmin) return;
    const next = { ...checks, [key]: !checks[key] };
    setChecks(next);
    await supabase
      .from("sales")
      .update({
        custom_fields: { ...(sale.custom_fields ?? {}), review_checklist: next },
      } as never)
      .eq("id", sale.id);
  };

  const isUnderRevision = status === "반려" || status === "수정요청";
  const showRevisionContext = isUnderRevision || (sale.revision_reason && (status === "승인대기" || status === "확정"));

  const submitDecision = async (next: ApprovalStatus) => {
    if (!isAdmin) return;
    const needsReason = next === "반려" || next === "수정요청";
    if (needsReason && !reason.trim()) {
      toast.error(`${next} 사유를 입력해주세요`);
      return;
    }
    if (next === "수정요청" && fields.length === 0) {
      toast.error("수정이 필요한 항목을 1개 이상 선택해주세요");
      return;
    }
    if (next === "검수완료" && !allRequiredChecked) {
      toast.error("필수 체크 항목을 모두 완료해야 승인할 수 있습니다");
      return;
    }
    // 수정요청 시: 미체크 활성 항목명을 사유 앞에 자동 prefix
    let effectiveReason = reason.trim();
    if (next === "수정요청") {
      const unchecked = checklistItems.filter((i) => !checks[i.key]).map((i) => i.label);
      if (unchecked.length > 0 && !effectiveReason.includes("[미확인 항목]")) {
        effectiveReason = `[미확인 항목] ${unchecked.join(", ")}\n\n${effectiveReason}`.trim();
      }
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = { approval_status: next };
    if (needsReason) {
      payload.revision_reason = effectiveReason;
      payload.revision_fields = next === "수정요청" ? fields : null;
      payload.revision_requested_at = new Date().toISOString();
      payload.revision_requested_by = user?.id ?? null;
      payload.re_review_requested_at = null;
    } else {
      // approve / pending / etc → clear revision context
      payload.revision_reason = null;
      payload.revision_fields = null;
      payload.revision_requested_at = null;
      payload.revision_requested_by = null;
      payload.re_review_requested_at = null;
    }
    const { error } = await supabase.from("sales").update(payload as never).eq("id", sale.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(`상태를 '${next}'(으)로 변경했습니다`);
    setReason("");
    if (next !== "수정요청") setFields([]);
    onChanged();
  };

  const requestReReview = async () => {
    if (!isOwner) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("sales")
      .update({
        approval_status: "승인대기",
        re_review_requested_at: new Date().toISOString(),
      } as never)
      .eq("id", sale.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("관리자에게 재검수가 요청되었습니다");
    onChanged();
  };

  const toggleField = (f: string) => {
    setFields((arr) => (arr.includes(f) ? arr.filter((x) => x !== f) : [...arr, f]));
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary-glow" />
          <h4 className="font-semibold text-sm">검수 및 메모</h4>
        </div>
        <Badge variant="outline" className={`gap-1 ${meta.tone}`}>
          <StatusIcon className="size-3" /> {meta.label}
        </Badge>
      </div>

      {/* 입력 검증 — 시스템 기준값과 비교, 다르면 빨강 */}
      {validations.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-1.5">
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <ShieldAlert className="size-3.5 text-primary-glow" />
            입력 검증 (마스터 기준 비교)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {validations.map((v, i) => (
              <div key={i} className={`flex items-center justify-between gap-2 text-[11px] px-2 py-1.5 rounded-md border ${
                v.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"
              }`}>
                <span className="text-muted-foreground shrink-0">{v.label}</span>
                <span className="flex items-center gap-1 min-w-0 truncate">
                  <span className={v.ok ? "text-foreground" : "text-destructive font-bold"}>{v.actual}</span>
                  {!v.ok && <span className="text-muted-foreground/70 text-[10px]">≠ 기준 {v.expected}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision context (visible to everyone if exists) */}
      {showRevisionContext && (
        <div className="rounded-lg border border-orange-300 bg-orange-500/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-orange-200">
            <MessageSquare className="size-3.5" />
            <span className="font-semibold">
              {status === "반려" ? "반려 사유" : status === "수정요청" ? "수정 요청 사유" : "이전 수정 요청"}
            </span>
            {sale.revision_requested_at && (
              <span className="text-muted-foreground ml-auto flex items-center gap-1">
                <Clock className="size-3" />
                {new Date(sale.revision_requested_at).toLocaleString("ko-KR")}
              </span>
            )}
          </div>
          <p className="text-sm text-orange-100 whitespace-pre-wrap">{sale.revision_reason}</p>
          {sale.revision_fields && sale.revision_fields.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">수정 필요 항목:</span>
              {sale.revision_fields.map((f) => (
                <Badge key={f} variant="outline" className="text-[10px] border-orange-400 text-orange-200">
                  {f}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Re-review banner */}
      {sale.re_review_requested_at && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
          <Send className="size-3.5" />
          재검수 요청됨 · {new Date(sale.re_review_requested_at).toLocaleString("ko-KR")}
        </div>
      )}

      {/* Owner action: re-review request (only when reject/revision) */}
      {isOwner && isUnderRevision && (
        <Button onClick={requestReReview} disabled={submitting} className="w-full" variant="default">
          <Send className="size-4 mr-1.5" />
          수정 완료 → 재검수 요청
        </Button>
      )}

      {/* === 그룹 A: 체크리스트 + 미처리 항목 (2단 그리드 - 항상) === */}
      <div className={`grid ${isAdmin ? "grid-cols-2" : "grid-cols-1"} gap-3 items-start`}>
      <div className="rounded-lg border border-border/40 p-3 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold flex items-center gap-1.5 truncate">
            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">검수 체크리스트</span>
          </span>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${allRequiredChecked ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-amber-400 text-amber-700 bg-amber-50"}`}>
            {checkedCount} / {checklistItems.length} (필수 {requiredItems.filter(i=>checks[i.key]).length}/{requiredItems.length})
          </Badge>
        </div>
        <div className="space-y-1">
          {checklistItems.map((item) => {
            // 매핑 필드의 실측/기준값 추출
            const cfAny = (sale.custom_fields ?? {}) as Record<string, any>;
            let actual: string | null = null;
            let expected: string | null = null;
            if (item.field) {
              const f = item.field;
              const raw =
                (sale as any)[f] ??
                cfAny[f] ??
                (f === "vas1" ? cfAny.vas_1 : null) ??
                (f === "vas2" ? cfAny.vas_2 : null);
              if (raw !== null && raw !== undefined && raw !== "") {
                actual = typeof raw === "number" ? raw.toLocaleString("ko-KR") : String(raw);
              }
              if (planMaster) {
                if (f === "rate_plan") expected = planMaster.rate_plan;
                if (f === "sale_type") expected = planMaster.default_sale_type;
                if (f === "vas1") expected = planMaster.default_vas1;
                if (f === "vas2") expected = planMaster.default_vas2;
              }
              if (modelMaster && f === "unit_price") {
                expected = Number(modelMaster.retail_price).toLocaleString("ko-KR");
              }
              if (modelMaster && f === "device_model") expected = modelMaster.model_name;
            }
            const mismatch = !!(expected && actual && expected !== actual);
            return (
              <label
                key={item.key}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-[12px] transition-colors ${
                  isAdmin ? "cursor-pointer hover:border-primary/30" : "cursor-default opacity-90"
                } ${checks[item.key] ? "border-emerald-500/40 bg-emerald-500/10" : mismatch ? "border-destructive/50 bg-destructive/5" : "border-border/40"}`}
              >
                <Checkbox checked={!!checks[item.key]} onCheckedChange={() => toggleCheck(item.key)} disabled={!isAdmin} className="shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {item.required && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-orange-400 text-orange-600 bg-orange-50 shrink-0">필수</Badge>
                )}
                {item.field && (actual || expected) && (
                  <div className="flex items-center gap-1 text-[10px] shrink-0">
                    <span className={mismatch ? "text-destructive font-bold" : "text-foreground"}>
                      {actual ?? "-"}
                    </span>
                    {expected && expected !== actual && (
                      <span className="text-muted-foreground">≠ {expected}</span>
                    )}
                  </div>
                )}
              </label>
            );
          })}
        </div>
        {!allRequiredChecked && (
          <p className="text-[10px] text-muted-foreground leading-tight">필수 항목을 모두 체크해야 [승인] 버튼이 활성화됩니다</p>
        )}
      </div>

      {/* 미처리 항목 인라인 편집 (검수자도 즉시 수정/저장) */}
      {isAdmin && (
        <div className="rounded-lg border border-border/40 p-3 space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold flex items-center gap-1.5 min-w-0 truncate">
              <AlertCircle className="size-3.5 text-amber-400 shrink-0" />
              <span className="truncate">미처리 항목</span>
            </span>
            <Button size="sm" variant="outline" disabled={submitting} onClick={savePendingInline} className="h-7 px-2.5 text-xs shrink-0">저장</Button>
          </div>
          <PendingItemsEditor
            items={pendingItems}
            note={pendingNote}
            resolved={pendingResolved}
            onItemsChange={setPendingItems}
            onNoteChange={setPendingNote}
            onResolvedChange={setPendingResolved}
            showResolvedToggle
          />
        </div>
      )}
      </div>

      {/* === 그룹 B: 이상영업 + 고객소통 + 최종판정 (2단 그리드 - 항상) === */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-3">
        {/* 이상영업 감시 */}
        <div className={`rounded-lg border p-3 space-y-2 ${fraudSuspect ? "border-destructive/60 bg-destructive/10" : "border-border/40"}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <ShieldAlert className={`size-3.5 ${fraudSuspect ? "text-destructive" : "text-muted-foreground"}`} />
              이상영업 예상 표기
            </span>
            <Switch
              checked={fraudSuspect}
              onCheckedChange={async (v) => {
                setFraudSuspect(v);
                // 신규 컬럼(is_suspicious)에 우선 기록 + 레거시 custom_fields 동기화
                const { error } = await supabase
                  .from("sales")
                  .update({
                    is_suspicious: v,
                    suspicious_reason: v ? (fraudReason || null) : null,
                    custom_fields: {
                      ...(sale.custom_fields ?? {}),
                      fraud_suspect: v,
                      fraud_marked_at: v ? new Date().toISOString() : null,
                      fraud_marked_by: v ? user?.id ?? null : null,
                      ...(v ? {} : { fraud_reason: "" }),
                    },
                  } as never)
                  .eq("id", sale.id);
                if (error) toast.error(error.message);
                else onChanged();
                if (v) toast.warning("이상영업으로 표기되었습니다 — 정산이 일시 중지됩니다");
              }}
            />
          </div>
          {fraudSuspect && (
            <>
              <Textarea
                rows={2}
                value={fraudReason}
                onChange={(e) => setFraudReason(e.target.value)}
                onBlur={async () => {
                  const { error } = await supabase
                    .from("sales")
                    .update({
                      suspicious_reason: fraudReason || null,
                      custom_fields: { ...(sale.custom_fields ?? {}), fraud_reason: fraudReason },
                    } as never)
                    .eq("id", sale.id);
                  if (error) toast.error(error.message); else onChanged();
                }}
                placeholder="의심 사유 (예: 동일 명의 단기 재가입, 지원금 과다 등)"
                className="bg-input/60 text-sm border-destructive/40"
              />
              <p className="text-[10px] text-destructive">⚠ 정산 일시중지 · 본사 검토 대상</p>
            </>
          )}
        </div>

        {/* 업무 종결 토글 — 상품군별 [개통 완료] / [설치 완료] */}
        <div className={`rounded-lg border p-3 space-y-2 ${
          isCompleted ? "border-emerald-500/60 bg-emerald-500/10" : "border-border/40"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className={`size-3.5 ${isCompleted ? "text-emerald-500" : "text-muted-foreground"}`} />
              {isHomeProduct ? "설치 완료" : "개통 완료"} 처리
            </span>
            <Switch
              checked={isCompleted}
              disabled={marking || !canToggleCompletion}
              onCheckedChange={() => toggleCompletion()}
            />
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {!canToggleCompletion
              ? `상태가 '${completionPrev}' 또는 '${completionTarget}'일 때만 종결 처리할 수 있습니다`
              : isCompleted
              ? `OFF로 전환하면 '${completionPrev}'으로 복구됩니다`
              : `ON으로 전환하면 즉시 '${completionTarget}'으로 변경되어 통합 검수함에서 제외됩니다`}
          </p>
        </div>

        {/* 최종 판정 (정상/비정상) */}
        <div className={`rounded-lg border p-3 flex items-center justify-between ${
              finalVerdict === "비정상" ? "border-destructive/60 bg-destructive/10"
              : finalVerdict === "정상" ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-border/40"
            }`}>
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Gavel className="size-3.5 text-primary-glow" />
                최종 판정
              </span>
              <div className="flex rounded-md border border-border/40 overflow-hidden text-[11px]">
                <button
                  type="button"
                  className={`px-3 py-1 ${finalVerdict === "정상" ? "bg-emerald-500/20 text-emerald-200" : "hover:bg-muted/40"}`}
                  onClick={() => {
                    setFinalVerdict("정상");
                    setVerdictReason("");
                    patchCustom({ final_verdict: "정상", verdict_reason: "", verdict_at: new Date().toISOString(), verdict_by: user?.id ?? null });
                  }}
                >정상</button>
                <button
                  type="button"
                  className={`px-3 py-1 border-l border-border/40 ${finalVerdict === "비정상" ? "bg-destructive/20 text-destructive" : "hover:bg-muted/40"}`}
                  onClick={() => {
                    setFinalVerdict("비정상");
                    patchCustom({ final_verdict: "비정상", verdict_at: new Date().toISOString(), verdict_by: user?.id ?? null });
                  }}
                >비정상</button>
              </div>
            </div>

        {/* 비정상 사유 (전폭) */}
        {finalVerdict === "비정상" && (
          <div className="md:col-span-2">
            <Textarea
              rows={2}
              value={verdictReason}
              onChange={(e) => setVerdictReason(e.target.value)}
              onBlur={() => patchCustom({ verdict_reason: verdictReason })}
              placeholder="비정상 사유 (예: 단가 불일치, 서류 위조 의심 등) — 사유만 기록되며 확정은 차단되지 않습니다"
              className="bg-input/60 text-sm border-destructive/40"
            />
          </div>
        )}

        {/* 홈 설치 관리 — 전폭 */}
        {isHomeProduct && (
          <div className="md:col-span-2 rounded-lg border border-border/40 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Home className="size-3.5 text-violet-400" />
                <span className="text-xs font-semibold">홈(인터넷/TV) 설치 관리</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-md border border-border/40 px-2.5 py-1.5">
                  <CalendarClock className="size-3.5 text-muted-foreground" />
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap">설치 예정일</Label>
                  <Input
                    type="date"
                    value={installDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInstallDate(v);
                      // 즉시 서버 반영 — onBlur 누락으로 인한 저장 실패 방지
                      patchCustom({ install_date: v || null });
                    }}
                    onBlur={() => patchCustom({ install_date: installDate || null })}
                    className="h-7 text-xs bg-input/60"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/40 px-2.5 py-1.5">
                  <Label htmlFor="install-done" className="text-[11px] cursor-pointer">설치 완료</Label>
                  <Switch
                    id="install-done"
                    checked={installDone}
                    onCheckedChange={(v) => {
                      setInstallDone(v);
                      patchCustom({ install_done: v, install_done_at: v ? new Date().toISOString() : null });
                    }}
                  />
                </div>
              </div>
          </div>
        )}
        </div>
      )}

      {/* Admin actions */}
      {isAdmin ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              검수 메모 / 사유 (반려·수정요청 시 필수)
            </Label>
            <Textarea
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="검수 과정에서 발견된 특이사항이나 반려/수정요청 사유를 자세히 작성하세요. 변경 이력은 검수 타임라인에서 확인할 수 있습니다."
              className="bg-input/60 text-sm leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">수정요청 항목 (수정요청 클릭 시 적용)</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {REVISION_FIELD_OPTIONS.map((f) => {
                const checked = fields.includes(f);
                return (
                  <label
                    key={f}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                      checked
                        ? "border-orange-400 bg-orange-50 text-orange-200"
                        : "border-border/40 hover:border-primary/30"
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleField(f)} />
                    <span>{f}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button
              onClick={() => submitDecision("검수완료")}
              disabled={submitting || !allRequiredChecked}
              variant="default"
              className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm"
              title={!allRequiredChecked ? "필수 체크리스트를 먼저 완료하세요" : ""}
            >
              <ShieldCheck className="size-4 mr-1.5" /> 승인
            </Button>
            <Button
              onClick={() => submitDecision("수정요청")}
              disabled={submitting}
              variant="outline"
              className="h-11 border-orange-400 text-orange-700 hover:bg-orange-50 font-semibold text-sm"
            >
              <Edit3 className="size-4 mr-1.5" /> 수정요청
            </Button>
            <Button
              onClick={() => submitDecision("반려")}
              disabled={submitting}
              variant="outline"
              className="h-11 border-destructive/50 text-destructive hover:bg-destructive/10 font-semibold text-sm"
            >
              <XCircle className="size-4 mr-1.5" /> 반려
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            승인 = 기획팀 검토 종료(잠금 없음, 정산 확정 전 단계) · 수정요청 시 미체크 항목이 사유에 자동 첨부됩니다 · 반려/수정요청 = 사유 필수
          </p>
        </div>
      ) : !isOwner ? (
        <div className="text-xs text-muted-foreground rounded-lg border border-border/40 px-3 py-2">
          검수는 관리자만 수행할 수 있습니다.
        </div>
      ) : null}
    </div>
  );
}
