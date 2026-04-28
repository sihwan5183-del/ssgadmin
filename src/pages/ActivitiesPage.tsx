import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { SaleSearchPanel } from "@/components/sales/SaleSearchPanel";
import { LiveFeedSection } from "@/components/sales/LiveFeedSection";
import { UnifiedReviewCenter } from "@/components/sales/UnifiedReviewCenter";
import { useViewScope } from "@/contexts/ViewScopeContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileWarning, Search, Upload, Phone, User, Smartphone, AlertTriangle, ListChecks,
  ClipboardList, CheckCircle2, Pencil, Building2, Clock, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SaleDocuments } from "@/components/sales/SaleDocuments";
import { PendingItemsEditor } from "@/components/sales/PendingItemsEditor";
import { PlannerSuperView } from "@/components/sales/PlannerSuperView";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface SaleLite {
  id: string;
  customer_name: string | null;
  phone: string | null;
  device_serial: string | null;
  device_model: string | null;
  channel: string | null;
  open_date: string | null;
  manager: string | null;
  approval_status: string | null;
  doc_count?: number;
}

const PAGE_SIZE = 100;

function MissingDocsSection() {
  const [rows, setRows] = useState<SaleLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SaleLite | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: sales, error } = await supabase
      .from("sales")
      .select(
        "id, customer_name, phone, device_serial, device_model, channel, open_date, manager, approval_status",
      )
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const ids = (sales ?? []).map((s) => s.id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: docs } = await supabase
      .from("sale_documents")
      .select("sale_id")
      .in("sale_id", ids);

    const counts = new Map<string, number>();
    (docs ?? []).forEach((d: any) => counts.set(d.sale_id, (counts.get(d.sale_id) ?? 0) + 1));

    const missing = (sales ?? [])
      .map((s: any) => ({ ...s, doc_count: counts.get(s.id) ?? 0 }))
      .filter((s) => (s.doc_count ?? 0) === 0)
      .slice(0, PAGE_SIZE);

    setRows(missing);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.customer_name, r.phone, r.device_serial, r.device_model, r.channel, r.manager]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-5">
      <Card className="p-5 glass border-warning/30">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-warning/15 grid place-items-center">
            <AlertTriangle className="size-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">정산 누락 방지를 위한 서류 첨부 알림</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              아래 실적은 가입 서류가 1건도 업로드되지 않았습니다. 클릭하여 즉시 업로드하세요.
            </div>
          </div>
          <Badge variant="outline" className="border-warning/40 text-warning bg-warning/10">
            {filtered.length}건 미첨부
          </Badge>
        </div>
      </Card>

      <div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명 · 전화번호 · IMEI · 매체 검색…"
            className="h-10 pl-9 bg-input/60"
          />
        </div>
      </div>

      <Card className="glass border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">고객</th>
                <th className="text-left px-3 py-2.5">연락처</th>
                <th className="text-left px-3 py-2.5">단말기 / IMEI</th>
                <th className="text-left px-3 py-2.5">개통일</th>
                <th className="text-left px-3 py-2.5">매체 / 담당</th>
                <th className="text-left px-3 py-2.5">상태</th>
                <th className="text-right px-3 py-2.5">조치</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">
                  🎉 모든 실적에 가입 서류가 첨부되어 있습니다
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-medium flex items-center gap-1.5">
                      <User className="size-3 text-muted-foreground" />
                      {r.customer_name ?? "(이름없음)"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Phone className="size-3" />{r.phone ?? "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-1"><Smartphone className="size-3 text-muted-foreground" />{r.device_model ?? "-"}</div>
                      <div className="text-muted-foreground font-mono text-[10px]">{r.device_serial ?? "-"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.channel ?? "-"} / {r.manager ?? "-"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px]">
                        {r.approval_status ?? "승인대기"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected(r)}>
                        <Upload className="size-3.5 mr-1" /> 서류 업로드
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && (setSelected(null), load())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="size-4 text-warning" />
              가입 서류 업로드 — {selected?.customer_name ?? "고객"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <SaleDocuments
              saleId={selected.id}
              saleMeta={{
                open_date: selected.open_date,
                customer_name: selected.customer_name,
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PendingSale {
  id: string;
  customer_name: string | null;
  phone: string | null;
  device_model: string | null;
  device_serial: string | null;
  channel: string | null;
  open_date: string | null;
  manager: string | null;
  approval_status: string | null;
  pending_items: string[];
  pending_note: string | null;
  pending_resolved: boolean;
}

function PendingItemsSection() {
  const [rows, setRows] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PendingSale | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [editNote, setEditNote] = useState("");
  const [editResolved, setEditResolved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, customer_name, phone, device_model, device_serial, channel, open_date, manager, approval_status, pending_items, pending_note, pending_resolved",
      )
      .eq("pending_resolved", false)
      .order("open_date", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const mapped: PendingSale[] = (data ?? []).map((s: any) => ({
      ...s,
      pending_items: Array.isArray(s.pending_items) ? s.pending_items : [],
    })).filter((s) => s.pending_items.length > 0);
    setRows(mapped);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.customer_name, r.phone, r.device_model, r.channel, r.manager, ...(r.pending_items ?? []), r.pending_note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const openEditor = (r: PendingSale) => {
    setSelected(r);
    setEditItems(r.pending_items ?? []);
    setEditNote(r.pending_note ?? "");
    setEditResolved(r.pending_resolved);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("sales")
      .update({
        pending_items: editItems as any,
        pending_note: editNote || null,
        pending_resolved: editResolved || editItems.length === 0,
      })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("미처리 항목이 업데이트되었습니다");
    setSelected(null);
    load();
  };

  const resolveAll = async (id: string) => {
    const { error } = await supabase
      .from("sales")
      .update({ pending_resolved: true })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("처리 완료로 표시했습니다");
    load();
  };

  return (
    <div className="space-y-5">
      <Card className="p-5 glass border-amber-300">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-amber-50 grid place-items-center">
            <ClipboardList className="size-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">미처리(보완 필요) 항목 모음</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              결합·할부·약정·부가서비스·서류 보완 등 후속 처리가 필요한 실적입니다. 항목별로 사유를 남기고, 처리 완료 시 체크하여 정리하세요.
            </div>
          </div>
          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
            {filtered.length}건 미처리
          </Badge>
        </div>
      </Card>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객명 · 전화 · 모델 · 항목 · 메모 검색…"
          className="h-10 pl-9 bg-input/60"
        />
      </div>

      <Card className="glass border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">고객</th>
                <th className="text-left px-3 py-2.5">단말기</th>
                <th className="text-left px-3 py-2.5">개통일</th>
                <th className="text-left px-3 py-2.5">매체 / 담당</th>
                <th className="text-left px-3 py-2.5">미처리 항목</th>
                <th className="text-left px-3 py-2.5">메모</th>
                <th className="text-right px-3 py-2.5">조치</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">
                  🎉 모든 실적의 후속 처리가 완료되었습니다
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border/30 hover:bg-muted/20 align-top">
                    <td className="px-3 py-2.5 font-medium">
                      <div className="flex items-center gap-1.5"><User className="size-3 text-muted-foreground" />{r.customer_name ?? "(이름없음)"}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="size-3" />{r.phone ?? "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-1"><Smartphone className="size-3 text-muted-foreground" />{r.device_model ?? "-"}</div>
                      <div className="text-muted-foreground font-mono text-[10px]">{r.device_serial ?? "-"}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.channel ?? "-"} / {r.manager ?? "-"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {r.pending_items.map((p, i) => (
                          <Badge key={i} variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px]">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[240px] truncate" title={r.pending_note ?? ""}>
                      {r.pending_note ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => openEditor(r)} className="mr-1.5">
                        <Pencil className="size-3.5 mr-1" /> 수정
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => resolveAll(r.id)}
                        className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
                        <CheckCircle2 className="size-3.5 mr-1" /> 완료
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="size-4 text-amber-400" />
              미처리 항목 수정 — {selected?.customer_name ?? "고객"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
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
                <Button variant="ghost" onClick={() => setSelected(null)}>취소</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "저장 중…" : "저장"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ActivitiesPage = () => {
  const { scope } = useViewScope();
  const { isAdmin } = useRole();
  const [searchParams] = useSearchParams();
  const wantPending = searchParams.get("pending") === "1";
  const tabParam = searchParams.get("tab");
  const statusParam = searchParams.get("status");
  // 미완료 항목 탭은 [통합 검수함]으로 통합됨
  const isReviewParam =
    tabParam === "review" ||
    tabParam === "incomplete" ||
    tabParam === "pending-activation" ||
    tabParam === "subscribed" ||
    statusParam === "청약완료,택배발송,예약" ||
    statusParam === "청약완료,택배발송";
  const initialTab = isReviewParam
    ? "review"
    : (tabParam || (wantPending ? "review" : (isAdmin ? "super" : "review")));
  const [tab, setTab] = useState<string>(initialTab);
  useEffect(() => {
    if (isReviewParam) setTab("review");
    else if (tabParam) setTab(tabParam);
    else if (wantPending) setTab("review");
  }, [wantPending, tabParam, statusParam, isReviewParam]);

  return (
    <>
      <Header
        title="활동 관리"
        subtitle={
          isAdmin
            ? "본사 영업기획팀 슈퍼 뷰 — 30개 매장 통합 관제"
            : scope === "personal"
              ? "내가 등록한 실적·서류·미처리 현황"
              : "팀 전체 실적·서류·미처리 현황"
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="super" className="gap-2">
              <Building2 className="size-4" /> 슈퍼 뷰
            </TabsTrigger>
          )}
          <TabsTrigger value="review" className="gap-2">
            <ShieldCheck className="size-4" /> 통합 검수함
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-2">
            <ListChecks className="size-4" /> 실적 검색·관리
          </TabsTrigger>
          <TabsTrigger value="missing-docs" className="gap-2">
            <FileWarning className="size-4" /> 서류 미첨부
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="super">
            <PlannerSuperView />
          </TabsContent>
        )}

        <TabsContent value="review" className="space-y-3">
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs font-semibold text-primary flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0" />
            <span>통합 검수함 — 수정완료(주황) → 신규(파랑) → 검수보류(빨강) 순으로 자동 정렬됩니다. 종결 처리된 건은 자동으로 사라집니다.</span>
          </div>
          <UnifiedReviewCenter />
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <SaleSearchPanel />
          <div className="pt-2 border-t border-border/40" />
          <LiveFeedSection />
        </TabsContent>

        <TabsContent value="missing-docs">
          <MissingDocsSection />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default ActivitiesPage;
