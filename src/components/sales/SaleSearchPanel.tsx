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
} from "lucide-react";
import { toast } from "sonner";
import { SaleDocuments } from "./SaleDocuments";
import { SaleAuditLog } from "./SaleAuditLog";
import { PendingItemsEditor } from "./PendingItemsEditor";
import { ReviewerPanel } from "./ReviewerPanel";
import { MoneyInput } from "@/components/ui/money-input";
import { useSearchParams } from "react-router-dom";

type ApprovalStatus = "승인대기" | "확정" | "반려" | "수정요청" | "환수" | "취소";

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
}

const EDITABLE_FIELDS: Array<{ key: keyof SaleHit; label: string; type?: string }> = [
  { key: "customer_name", label: "고객명" },
  { key: "phone", label: "전화번호" },
  { key: "device_model", label: "단말기 모델" },
  { key: "device_serial", label: "단말기 일련번호" },
  { key: "channel", label: "채널" },
  { key: "product", label: "상품" },
  { key: "rate_plan", label: "요금제" },
  { key: "status", label: "상태" },
  { key: "manager", label: "담당자" },
  { key: "open_date", label: "개통일", type: "date" },
  { key: "unit_price", label: "단가", type: "number" },
  { key: "net_fee", label: "순수익", type: "number" },
  { key: "note", label: "메모" },
];

const APPROVAL_META: Record<ApprovalStatus, { className: string; icon: typeof CheckCircle2 }> = {
  승인대기: { className: "border-amber-500/40 text-amber-300 bg-amber-500/10", icon: AlertCircle },
  확정: { className: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", icon: CheckCircle2 },
  반려: { className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
  수정요청: { className: "border-orange-500/40 text-orange-300 bg-orange-500/10", icon: Edit3 },
  환수: { className: "border-orange-500/40 text-orange-300 bg-orange-500/10", icon: RotateCcw },
  취소: { className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
};

const SELECT_COLS =
  "id, created_by, customer_name, phone, device_serial, device_model, channel, product, rate_plan, status, open_date, manager, unit_price, net_fee, note, approval_status, locked, approved_at, pending_items, pending_note, pending_resolved, approval_override_reason, distributor_amount, cash_support_amount, cash_open, receivable_amount, receivable_paid, revision_fields, revision_reason, revision_requested_at, re_review_requested_at";

export const SaleSearchPanel = () => {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [unhandledOnly, setUnhandledOnly] = useState(false);
  const [unhandledCount, setUnhandledCount] = useState(0);
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

  const isLocked = !!selected?.locked;
  const canEdit = useMemo(() => {
    if (!selected || !user) return false;
    if (isAdmin) return true;
    if (isLocked) return false;
    return selected.created_by === user.id;
  }, [selected, user, isAdmin, isLocked]);

  // 미승인 / 미처리 카운트
  const refreshCounts = async () => {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("approval_status", "승인대기"),
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("pending_resolved", false),
    ]);
    setPendingCount(c1 ?? 0);
    setUnhandledCount(c2 ?? 0);
  };

  useEffect(() => {
    refreshCounts();
  }, []);

  const search = async (override?: string, pendingOverride?: boolean, unhandledOverride?: boolean) => {
    const term = (override ?? q).trim();
    const onlyPending = pendingOverride ?? pendingOnly;
    const onlyUnhandled = unhandledOverride ?? unhandledOnly;

    if (!term && !onlyPending && !onlyUnhandled) {
      setResults([]);
      return;
    }
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

    const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
    setSearching(false);
    if (error) return toast.error(error.message);
    setResults((data ?? []) as SaleHit[]);
  };

  // URL ?sale=ID 자동 오픈 + ?pending=1 자동 미처리 필터
  useEffect(() => {
    const id = params.get("sale");
    const wantPending = params.get("pending") === "1";
    if (wantPending) {
      setUnhandledOnly(true);
      search(undefined, undefined, true);
      params.delete("pending");
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

  const openDetail = (sale: SaleHit) => {
    setSelected(sale);
    setEditForm(sale);
    setPendingItems(sale.pending_items ?? []);
    setPendingNote(sale.pending_note ?? "");
    setPendingResolved(sale.pending_resolved ?? true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    if (!canEdit) return toast.error(isLocked ? "확정된 실적은 수정할 수 없습니다" : "수정 권한이 없습니다");
    const payload: Record<string, unknown> = {};
    EDITABLE_FIELDS.forEach(({ key }) => {
      if (editForm[key] !== selected[key]) payload[key as string] = editForm[key];
    });
    // 오퍼(지원금) 필드 변경 감지
    const offerKeys: (keyof SaleHit)[] = [
      "distributor_amount",
      "cash_support_amount",
      "cash_open",
      "receivable_amount",
      "receivable_paid",
    ];
    offerKeys.forEach((k) => {
      if ((editForm[k] ?? null) !== (selected[k] ?? null)) {
        payload[k as string] = editForm[k] ?? null;
      }
    });
    // 미처리 항목 변경 감지
    const pendingChanged =
      JSON.stringify(selected.pending_items ?? []) !== JSON.stringify(pendingItems) ||
      (selected.pending_note ?? "") !== pendingNote ||
      (selected.pending_resolved ?? true) !== pendingResolved;
    if (pendingChanged) {
      payload.pending_items = pendingItems;
      payload.pending_note = pendingNote || null;
      payload.pending_resolved = pendingItems.length === 0 ? true : pendingResolved;
    }
    if (Object.keys(payload).length === 0) {
      toast.info("변경된 내용이 없습니다");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("sales").update(payload as never).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
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
          <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 gap-1">
            <AlertCircle className="size-3" /> 미승인 {pendingCount}건
          </Badge>
          <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 gap-1">
            <AlertTriangle className="size-3" /> 미처리 {unhandledCount}건
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
            <span>검색 결과 {results.length}건 (최근순)</span>
            <span>클릭하면 상세 / 수정 / 검수</span>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border/30">
            {results.map((r) => {
              const ap = (r.approval_status ?? "승인대기") as ApprovalStatus;
              const meta = APPROVAL_META[ap];
              const Icon = meta.icon;
              const hasUnhandled = (r.pending_items?.length ?? 0) > 0 && r.pending_resolved === false;
              return (
                <button
                  key={r.id}
                  onClick={() => openDetail(r)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted/30 transition-colors flex items-center gap-3 ${
                    hasUnhandled ? "bg-amber-500/[0.07] hover:bg-amber-500/[0.12]" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                      <User className="size-3 text-muted-foreground" />
                      {r.customer_name ?? "(이름없음)"}
                      <Badge variant="outline" className={`text-[10px] gap-1 ${meta.className}`}>
                        <Icon className="size-3" /> {ap}
                      </Badge>
                      {hasUnhandled && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-300 bg-amber-500/10">
                          <AlertTriangle className="size-3" /> 미처리 {r.pending_items?.length}
                        </Badge>
                      )}
                      {r.locked && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-border/60">
                          <Lock className="size-3" /> 잠금
                        </Badge>
                      )}
                      {r.status && <Badge variant="outline" className="text-[10px]">{r.status}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1"><Phone className="size-3" />{r.phone ?? "-"}</span>
                      <span className="flex items-center gap-1"><Smartphone className="size-3" />{r.device_serial ?? "-"}</span>
                      <span>{r.open_date ?? "-"}</span>
                      <span>{r.channel ?? "-"} / {r.product ?? "-"}</span>
                    </div>
                  </div>
                  <Edit3 className="size-3.5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 상세/수정 다이얼로그 */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-6xl max-h-[88vh] overflow-y-auto">
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
              {isLocked && (
                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                  <Lock className="size-3" /> 잠금됨
                </Badge>
              )}
              {!canEdit && !isLocked && (
                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                  <Lock className="size-3" /> 읽기 전용
                </Badge>
              )}
              {(selected?.pending_items?.length ?? 0) > 0 && selected?.pending_resolved === false && (
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-300 bg-amber-500/10">
                  <AlertTriangle className="size-3" /> 미처리 {selected?.pending_items?.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
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
                {isLocked && (
                  <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
                    <Lock className="size-3.5" />
                    이 실적은 '확정' 상태로 잠겨 있어 수정/삭제할 수 없습니다.
                    {isAdmin && " (관리자는 검수 탭에서 상태를 되돌릴 수 있습니다)"}
                  </div>
                )}
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

              <TabsContent value="approval" className="mt-4 space-y-4">
                <div className="rounded-lg border border-border/40 bg-card/40 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">현재 승인 상태</Label>
                    {(() => {
                      const ap = (selected.approval_status ?? "승인대기") as ApprovalStatus;
                      const meta = APPROVAL_META[ap];
                      const Icon = meta.icon;
                      return (
                        <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                          <Icon className="size-3.5" /> {ap}
                        </Badge>
                      );
                    })()}
                  </div>
                  {selected.approved_at && (
                    <div className="text-xs text-muted-foreground">
                      확정일시: {new Date(selected.approved_at).toLocaleString("ko-KR")}
                    </div>
                  )}
                </div>

                {(selected.pending_items?.length ?? 0) > 0 && selected.pending_resolved === false && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                    <div>
                      이 실적에는 <b>{selected.pending_items?.length}건의 미처리 항목</b>이 남아 있습니다
                      ({selected.pending_items?.join(", ")}).
                      '확정'으로 변경하려면 사유 입력이 필요합니다.
                    </div>
                  </div>
                )}
                {selected.approval_override_reason && (
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-xs text-orange-200">
                    <b>강제 승인 사유:</b> {selected.approval_override_reason}
                  </div>
                )}

                {!isAdmin ? (
                  <div className="text-xs text-muted-foreground rounded-lg border border-border/40 px-3 py-2">
                    승인 / 환수 / 취소는 관리자(기획팀)만 변경할 수 있습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">상태 변경</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["승인대기", "확정", "환수", "취소"] as ApprovalStatus[]).map((s) => {
                        const meta = APPROVAL_META[s];
                        const Icon = meta.icon;
                        const active = (selected.approval_status ?? "승인대기") === s;
                        return (
                          <Button
                            key={s}
                            variant={active ? "default" : "outline"}
                            onClick={() => updateApproval(s)}
                            disabled={active}
                            className="justify-start"
                          >
                            <Icon className="size-4 mr-1.5" />
                            {s}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      '확정' 선택 시 자동으로 잠금 처리되어 일반 직원은 수정/삭제할 수 없습니다.
                      다른 상태로 변경하면 잠금이 해제됩니다.
                    </p>
                  </div>
                )}
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
                <SaleAuditLog saleId={selected.id} />
              </TabsContent>
            </Tabs>
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
    </Card>
  );
};
