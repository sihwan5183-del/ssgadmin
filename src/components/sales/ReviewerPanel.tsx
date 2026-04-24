import { useState, useEffect } from "react";
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

interface ChecklistItem { key: string; label: string }
const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { key: "docs_match", label: "가입 서류 일치" },
  { key: "plan_match", label: "요금제 확인" },
  { key: "price_match", label: "단가 확인" },
  { key: "bundle_match", label: "결합 확인" },
];

export type ApprovalStatus = "승인대기" | "확정" | "반려" | "수정요청" | "환수" | "취소";

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
  custom_fields?: Record<string, any> | null;
}

interface Props {
  sale: SaleSnapshot;
  onChanged: () => void;
}

const STATUS_META: Record<string, { tone: string; icon: typeof CheckCircle2; label: string }> = {
  승인대기: { tone: "border-amber-400 text-amber-700 bg-amber-50", icon: AlertCircle, label: "승인대기" },
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
  const checklistItems: ChecklistItem[] = Array.isArray(settings["review.checklist"]) && settings["review.checklist"].length > 0
    ? (settings["review.checklist"] as ChecklistItem[])
    : DEFAULT_CHECKLIST;

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
  const [fraudSuspect, setFraudSuspect] = useState<boolean>(!!cf.fraud_suspect);
  const [fraudReason, setFraudReason] = useState<string>(cf.fraud_reason ?? "");
  const [smsSent, setSmsSent] = useState<boolean>(!!cf.sms_sent);
  const [installDate, setInstallDate] = useState<string>(cf.install_date ?? "");
  const [installDone, setInstallDone] = useState<boolean>(!!cf.install_done);
  const [finalVerdict, setFinalVerdict] = useState<"" | "정상" | "비정상">(
    (cf.final_verdict as "" | "정상" | "비정상") ?? "",
  );
  const [verdictReason, setVerdictReason] = useState<string>(cf.verdict_reason ?? "");

  useEffect(() => {
    setReason("");
    setFields(sale.revision_fields ?? []);
    setChecks((sale.custom_fields?.review_checklist ?? {}) as Record<string, boolean>);
    setPendingItems(sale.pending_items ?? []);
    setPendingNote(sale.pending_note ?? "");
    setPendingResolved(!!sale.pending_resolved);
    const c = (sale.custom_fields ?? {}) as Record<string, any>;
    setFraudSuspect(!!c.fraud_suspect);
    setFraudReason(c.fraud_reason ?? "");
    setSmsSent(!!c.sms_sent);
    setInstallDate(c.install_date ?? "");
    setInstallDone(!!c.install_done);
    setFinalVerdict((c.final_verdict as "" | "정상" | "비정상") ?? "");
    setVerdictReason(c.verdict_reason ?? "");
  }, [sale.id, sale.revision_fields, sale.custom_fields, sale.pending_items, sale.pending_note, sale.pending_resolved]);

  const checkedCount = checklistItems.filter((i) => checks[i.key]).length;
  const allChecked = checkedCount === checklistItems.length;
  const isHomeProduct = (sale.product ?? "").includes("인터넷")
    || (sale.product ?? "").includes("TV")
    || (sale.product ?? "").includes("홈");

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
    if (next === "확정" && !allChecked) {
      toast.error("모든 검수 체크리스트 항목을 완료해야 확정할 수 있습니다");
      return;
    }
    if (next === "확정" && finalVerdict === "비정상") {
      toast.error("최종 판정이 '비정상'인 건은 확정할 수 없습니다");
      return;
    }
    setSubmitting(true);
    const payload: Record<string, unknown> = { approval_status: next };
    if (needsReason) {
      payload.revision_reason = reason.trim();
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

      {/* 검수 체크리스트 (어드민만 토글 가능, 모두에게 표시) */}
      <div className="rounded-lg border border-border/40 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            검수 체크리스트
          </span>
          <Badge variant="outline" className={`text-[10px] ${allChecked ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-amber-400 text-amber-700 bg-amber-50"}`}>
            {checkedCount} / {checklistItems.length}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {checklistItems.map((item) => (
            <label
              key={item.key}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                isAdmin ? "cursor-pointer hover:border-primary/30" : "cursor-default opacity-90"
              } ${checks[item.key] ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-border/40"}`}
            >
              <Checkbox checked={!!checks[item.key]} onCheckedChange={() => toggleCheck(item.key)} disabled={!isAdmin} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">검수 메모 / 사유</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="반려·수정요청 시 사유를 작성하세요"
              className="bg-input/60 text-sm"
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

          <div className="grid grid-cols-3 gap-2 pt-1">
            <Button onClick={() => submitDecision("확정")} disabled={submitting} variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="size-3.5 mr-1" /> 승인
            </Button>
            <Button onClick={() => submitDecision("수정요청")} disabled={submitting} variant="outline" size="sm" className="border-orange-400 text-orange-700 hover:bg-orange-50">
              <Edit3 className="size-3.5 mr-1" /> 수정요청
            </Button>
            <Button onClick={() => submitDecision("반려")} disabled={submitting} variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <XCircle className="size-3.5 mr-1" /> 반려
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            승인 = 잠금·확정 · 수정요청 = 항목 체크 + 사유 필수 · 반려 = 사유 필수
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
