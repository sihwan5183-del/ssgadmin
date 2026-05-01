import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity, Radio, FileWarning, ClipboardList, User, Phone,
  Smartphone, Upload, Pencil, CheckCircle2, ArrowUpRight, Clock, Trash2, ShieldCheck, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useViewScope } from "@/contexts/ViewScopeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { SaleDocuments } from "@/components/sales/SaleDocuments";
import { PendingItemsEditor } from "@/components/sales/PendingItemsEditor";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/common/BulkActionBar";
import { BulkDeleteDialog } from "@/components/common/BulkDeleteDialog";

interface FeedSale {
  id: string;
  customer_name: string | null;
  phone: string | null;
  device_model: string | null;
  device_serial: string | null;
  channel: string | null;
  open_date: string | null;
  manager: string | null;
  approval_status: string | null;
  created_at: string;
  created_by: string;
  pending_items: string[];
  pending_note: string | null;
  pending_resolved: boolean;
  doc_count?: number;
}

const FEED_LIMIT = 30;
  const SIDE_LIMIT = 20;

function statusTone(s?: string | null) {
  switch (s) {
    case "확정": return "border-emerald-500/40 text-emerald-300 bg-emerald-500/10";
    case "반려": return "border-destructive/40 text-destructive bg-destructive/10";
    case "수정요청": return "border-amber-400 text-amber-700 bg-amber-50";
    default: return "border-border/50 text-muted-foreground";
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export function LiveFeedSection() {
  const { scope } = useViewScope();
  const { user } = useAuth();
  const { isAdmin, isManager } = useRole();
  const canApprove = isAdmin || isManager;
  const [rows, setRows] = useState<FeedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(false);

  // dialogs
  const [docTarget, setDocTarget] = useState<FeedSale | null>(null);
  const [pendingTarget, setPendingTarget] = useState<FeedSale | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editResolved, setEditResolved] = useState(false);
  const [saving, setSaving] = useState(false);

  // bulk
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [pendingSideRows, setPendingSideRows] = useState<FeedSale[]>([]);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("sales")
      .select("id, customer_name, phone, device_model, device_serial, channel, open_date, manager, approval_status, created_at, created_by, pending_items, pending_note, pending_resolved")
      .order("created_at", { ascending: false })
      .limit(FEED_LIMIT);
    if (scope === "personal" && user?.id) q = q.eq("created_by", user.id);

    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }

    const mapped: FeedSale[] = (data ?? []).map((s: any) => ({
      ...s,
      pending_items: Array.isArray(s.pending_items) ? s.pending_items : [],
    }));

    // doc counts
    const ids = mapped.map((s) => s.id);
    if (ids.length > 0) {
      const { data: docs } = await supabase
        .from("sale_documents")
        .select("sale_id")
        .in("sale_id", ids);
      const counts = new Map<string, number>();
      (docs ?? []).forEach((d: any) => counts.set(d.sale_id, (counts.get(d.sale_id) ?? 0) + 1));
      mapped.forEach((s) => (s.doc_count = counts.get(s.id) ?? 0));
    }

    setRows(mapped);
    setLoading(false);

    // Separate query for pending items panel — not limited by FEED_LIMIT
    const { data: pendingData } = await supabase
      .from("sales")
      .select("id, customer_name, phone, device_model, device_serial, channel, open_date, manager, approval_status, created_at, created_by, pending_items, pending_note, pending_resolved")
      .eq("pending_resolved", false)
      .order("created_at", { ascending: false })
      .limit(SIDE_LIMIT);
    const pendingMapped: FeedSale[] = (pendingData ?? [])
      .map((s: any) => ({
        ...s,
        pending_items: Array.isArray(s.pending_items) ? s.pending_items : [],
      }))
      .filter((r) => r.pending_items.length > 0);
    setPendingSideRows(pendingMapped);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, user?.id]);

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel("activities-live-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => {
        setPulse(true);
        load();
        setTimeout(() => setPulse(false), 1500);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_documents" }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [scope, user?.id]);

  const missingDocs = useMemo(
    () => rows.filter((r) => (r.doc_count ?? 0) === 0).slice(0, SIDE_LIMIT),
    [rows]
  );
  const pendingItems = pendingSideRows;

  const openPendingEditor = (r: FeedSale) => {
    setPendingTarget(r);
    setEditItems(r.pending_items);
    setEditNote(r.pending_note ?? "");
    setEditResolved(r.pending_resolved);
  };
  const savePending = async () => {
    if (!pendingTarget) return;
    setSaving(true);
    const { error } = await supabase
      .from("sales")
      .update({
        pending_items: editItems as any,
        pending_note: editNote || null,
        pending_resolved: editResolved || editItems.length === 0,
      })
      .eq("id", pendingTarget.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("미처리 항목이 업데이트되었습니다");
    setPendingTarget(null);
    load();
  };
  const resolvePending = async (id: string) => {
    const { error } = await supabase.from("sales").update({ pending_resolved: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("처리 완료");
    load();
  };

  // bulk
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const bulk = useBulkSelection<string>(ids);

  const bulkApprove = async (status: "확정" | "반려") => {
    setBulkBusy(true);
    const { error } = await supabase.from("sales").update({ approval_status: status }).in("id", bulk.selectedIds);
    setBulkBusy(false);
    if (error) { toast.error("일괄 처리 실패: " + error.message); return; }
    toast.success(`${bulk.selectedIds.length}건 → ${status}`);
    bulk.clear();
    load();
  };
  const bulkDelete = async () => {
    setBulkBusy(true);
    const { error } = await supabase.from("sales").delete().in("id", bulk.selectedIds);
    setBulkBusy(false);
    if (error) { toast.error("일괄 삭제 실패: " + error.message); return; }
    toast.success(`${bulk.selectedIds.length}건 삭제됨`);
    setBulkDeleteOpen(false);
    bulk.clear();
    load();
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Radio className="size-4 text-emerald-400" />
            <span
              className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400 ${
                pulse ? "animate-ping" : ""
              }`}
            />
          </div>
          <h3 className="text-sm font-semibold">실시간 실적 피드</h3>
          <Badge variant="outline" className="border-border/50 text-muted-foreground text-[10px]">
            최근 {rows.length}건 · 자동 갱신
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {scope === "personal" ? "내 실적만 표시" : "팀 전체 표시"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* === Live feed (2 cols) === */}
        <Card className="glass border-border/40 lg:col-span-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <Checkbox
              checked={bulk.allOnPageSelected}
              onCheckedChange={(v) => bulk.togglePage(!!v)}
              aria-label="모두 선택"
            />
            <Activity className="size-4 text-primary-glow" />
            <span className="text-sm font-medium">방금 올라온 실적</span>
          </div>
          <div className="divide-y divide-border/30 max-h-[560px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">불러오는 중…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">표시할 실적이 없습니다</div>
            ) : (
              rows.map((r) => {
                const noDoc = (r.doc_count ?? 0) === 0;
                const hasPending = !r.pending_resolved && r.pending_items.length > 0;
                const selected = bulk.isSelected(r.id);
                return (
                  <div
                    key={r.id}
                    className={`px-4 py-3 hover:bg-muted/20 transition-colors flex items-start gap-3 ${selected ? "bg-primary/5" : ""}`}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => bulk.toggle(r.id)}
                      className="mt-1.5"
                    />
                    <div className="size-9 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                      <Smartphone className="size-4 text-primary-glow" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm flex items-center gap-1">
                          <User className="size-3 text-muted-foreground" />
                          {r.customer_name ?? "(이름없음)"}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${statusTone(r.approval_status)}`}>
                          {r.approval_status ?? "승인대기"}
                        </Badge>
                        {noDoc && (
                          <Badge variant="outline" className="text-[10px] border-warning/40 text-warning bg-warning/10">
                            <FileWarning className="size-2.5 mr-0.5" /> 서류 미첨부
                          </Badge>
                        )}
                        {hasPending && (
                          <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50">
                            <ClipboardList className="size-2.5 mr-0.5" /> 미처리 {r.pending_items.length}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Smartphone className="size-3" />{r.device_model ?? "-"}</span>
                        <span className="flex items-center gap-1"><Phone className="size-3" />{r.phone ?? "-"}</span>
                        <span>{r.channel ?? "-"} · {resolveStaff(r.manager, "-")}</span>
                      </div>
                      {hasPending && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {r.pending_items.slice(0, 4).map((p, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-300">
                              {p}
                            </span>
                          ))}
                          {r.pending_items.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{r.pending_items.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="size-3" /> {timeAgo(r.created_at)}
                      </div>
                      <div className="mt-1 flex items-center gap-1 justify-end">
                        {noDoc && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setDocTarget(r)}>
                            <Upload className="size-3 mr-1" /> 서류
                          </Button>
                        )}
                        {hasPending && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => openPendingEditor(r)}>
                            <Pencil className="size-3 mr-1" /> 보완
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* === Side panels === */}
        <div className="space-y-4">
          {/* Missing docs */}
          <Card className="glass border-warning/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileWarning className="size-4 text-warning" />
                <span className="text-sm font-medium">서류 미첨부</span>
              </div>
              <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10 text-[10px]">
                {missingDocs.length}건
              </Badge>
            </div>
            <div className="divide-y divide-border/30 max-h-[260px] overflow-y-auto">
              {missingDocs.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">🎉 미첨부 없음</div>
              ) : (
                missingDocs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setDocTarget(r)}
                    className="w-full text-left px-4 py-2.5 hover:bg-muted/20 transition-colors group"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{r.customer_name ?? "(이름없음)"}</span>
                      <ArrowUpRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 ml-auto" />
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r.device_model ?? "-"} · {r.open_date ?? "-"} · {resolveStaff(r.manager, "-")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Pending items */}
          <Card className="glass border-amber-300 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-4 text-amber-400" />
                <span className="text-sm font-medium">미처리 항목</span>
              </div>
              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px]">
                {pendingItems.length}건
              </Badge>
            </div>
            <div className="divide-y divide-border/30 max-h-[260px] overflow-y-auto">
              {pendingItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">🎉 미처리 없음</div>
              ) : (
                pendingItems.map((r) => (
                  <div key={r.id} className="px-4 py-2.5 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{r.customer_name ?? "(이름없음)"}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => openPendingEditor(r)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="size-6 text-emerald-300" onClick={() => resolvePending(r.id)}>
                          <CheckCircle2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.pending_items.slice(0, 3).map((p, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-300">
                          {p}
                        </span>
                      ))}
                      {r.pending_items.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{r.pending_items.length - 3}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Doc upload dialog */}
      <Dialog open={!!docTarget} onOpenChange={(v) => !v && (setDocTarget(null), load())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="size-4 text-warning" />
              가입 서류 업로드 — {docTarget?.customer_name ?? "고객"}
            </DialogTitle>
          </DialogHeader>
          {docTarget && (
            <SaleDocuments
              saleId={docTarget.id}
              saleMeta={{ open_date: docTarget.open_date, customer_name: docTarget.customer_name }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Pending editor dialog */}
      <Dialog open={!!pendingTarget} onOpenChange={(v) => !v && setPendingTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-amber-400" />
              미처리 항목 보완 — {pendingTarget?.customer_name ?? "고객"}
            </DialogTitle>
          </DialogHeader>
          {pendingTarget && (
            <div className="space-y-4">
              <PendingItemsEditor
                items={editItems}
                note={editNote}
                resolved={editResolved}
                onItemsChange={setEditItems}
                onNoteChange={setEditNote}
                onResolvedChange={setEditResolved}
                showResolvedToggle
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setPendingTarget(null)}>취소</Button>
                <Button onClick={savePending} disabled={saving}>
                  {saving ? "저장 중…" : "저장"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BulkActionBar count={bulk.selectedCount} onClear={bulk.clear}>
        {canApprove && (
          <>
            <Button size="sm" variant="default" onClick={() => bulkApprove("확정")} disabled={bulkBusy}>
              <ShieldCheck className="size-3.5 mr-1" /> 일괄 확정
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkApprove("반려")} disabled={bulkBusy}>
              <XCircle className="size-3.5 mr-1" /> 일괄 반려
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
    </section>
  );
}
