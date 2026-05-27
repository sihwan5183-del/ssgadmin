import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { UserCheck, PhoneCall, CheckCircle2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  "신규 접수",
  "통화 중",
  "부재 중",
  "보류",
  "개통 완료",
  "취소",
] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_COLOR: Record<string, string> = {
  "신규 접수": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "통화 중": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "부재 중": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "보류": "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "개통 완료": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "취소": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

type Lead = {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  current_carrier: string | null;
  desired_device: string | null;
  desired_product: string | null;
  campaign_name: string | null;
  status: string;
  memo: string | null;
  source: string | null;
};

type LeadNote = {
  id: string;
  lead_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
};

export default function LeadsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [memoDraft, setMemoDraft] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    current_carrier: "",
    desired_device: "",
    desired_product: "",
    campaign_name: "",
    memo: "",
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows(((data ?? []) as any) as Lead[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("leads-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load notes for open lead
  useEffect(() => {
    if (!openLead) {
      setNotes([]);
      return;
    }
    setMemoDraft(openLead.memo ?? "");
    (async () => {
      const { data } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", openLead.id)
        .order("created_at", { ascending: false });
      setNotes(((data ?? []) as any) as LeadNote[]);
    })();
  }, [openLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (productFilter !== "all" && r.desired_product !== productFilter) return false;
      if (carrierFilter !== "all" && r.current_carrier !== carrierFilter) return false;
      if (q) {
        const hay = `${r.name ?? ""} ${r.phone ?? ""} ${r.campaign_name ?? ""} ${r.desired_device ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, productFilter, carrierFilter, search]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: rows.length,
      todayNew: rows.filter((r) => r.created_at.slice(0, 10) === today).length,
      completed: rows.filter((r) => r.status === "개통 완료").length,
      newCount: rows.filter((r) => r.status === "신규 접수").length,
    };
  }, [rows]);

  const productOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.desired_product).filter(Boolean))) as string[],
    [rows],
  );
  const carrierOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.current_carrier).filter(Boolean))) as string[],
    [rows],
  );

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
      if (openLead?.id === id) setOpenLead({ ...openLead, status });
    }
  }

  async function saveMemo() {
    if (!openLead) return;
    const { error } = await supabase
      .from("leads")
      .update({ memo: memoDraft })
      .eq("id", openLead.id);
    if (error) return toast.error(error.message);
    setOpenLead({ ...openLead, memo: memoDraft });
    setRows((p) => p.map((r) => (r.id === openLead.id ? { ...r, memo: memoDraft } : r)));
    toast.success("메모를 저장했습니다");
  }

  async function addNote() {
    if (!openLead || !newNote.trim()) return;
    const payload = {
      lead_id: openLead.id,
      author_id: user?.id ?? null,
      author_name:
        (user?.user_metadata?.display_name as string | undefined) ??
        user?.email ??
        null,
      content: newNote.trim(),
    };
    const { data, error } = await supabase
      .from("lead_notes")
      .insert(payload)
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setNotes((p) => [data as LeadNote, ...p]);
    setNewNote("");
  }

  async function createLead() {
    if (!draft.name && !draft.phone) {
      return toast.error("고객명 또는 연락처는 입력해야 합니다");
    }
    const { error } = await supabase.from("leads").insert({
      ...draft,
      status: "신규 접수",
      source: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("리드를 등록했습니다");
    setShowCreate(false);
    setDraft({
      name: "",
      phone: "",
      current_carrier: "",
      desired_device: "",
      desired_product: "",
      campaign_name: "",
      memo: "",
    });
    load();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">잠재고객 관리</h1>
          <p className="text-sm text-muted-foreground">
            메타 광고 등 외부 인입 리드를 통합 관리합니다.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="size-4 mr-1" /> 리드 추가
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            <UserCheck className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">전체 접수</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 grid place-items-center">
            <PhoneCall className="size-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">오늘 신규</div>
            <div className="text-2xl font-bold">{stats.todayNew}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 grid place-items-center">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">개통 완료</div>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 w-56"
            placeholder="고객명·연락처·캠페인 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="희망 상품" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상품</SelectItem>
            {productOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={carrierFilter} onValueChange={setCarrierFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="현재 통신사" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 통신사</SelectItem>
            {carrierOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {rows.length}건
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>접수 일시</TableHead>
              <TableHead>고객명</TableHead>
              <TableHead>연락처</TableHead>
              <TableHead>현재 통신사</TableHead>
              <TableHead>희망 기종</TableHead>
              <TableHead>희망 상품</TableHead>
              <TableHead>캠페인</TableHead>
              <TableHead className="w-36">상담 상태</TableHead>
              <TableHead>메모</TableHead>
              <TableHead className="w-20 text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  불러오는 중…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                  표시할 리드가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer"
                onClick={() => setOpenLead(r)}
              >
                <TableCell className="tabular-nums text-xs">
                  {new Date(r.created_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="font-medium">{r.name ?? "-"}</TableCell>
                <TableCell className="tabular-nums">{r.phone ?? "-"}</TableCell>
                <TableCell>{r.current_carrier ?? "-"}</TableCell>
                <TableCell>{r.desired_device ?? "-"}</TableCell>
                <TableCell>{r.desired_product ?? "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.campaign_name ?? "-"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={r.status}
                    onValueChange={(v) => updateStatus(r.id, v)}
                  >
                    <SelectTrigger
                      className={`h-8 text-xs font-medium border-0 ${STATUS_COLOR[r.status] ?? ""}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell
                  className="max-w-[220px] truncate text-xs text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenLead(r);
                  }}
                >
                  {r.memo || <span className="italic">메모 추가…</span>}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => setOpenLead(r)}>
                    상세
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!openLead} onOpenChange={(o) => !o && setOpenLead(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {openLead && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {openLead.name ?? "이름 없음"}
                  <Badge className={STATUS_COLOR[openLead.status] ?? ""}>
                    {openLead.status}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  {new Date(openLead.created_at).toLocaleString("ko-KR")} 접수
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Field label="연락처" value={openLead.phone} />
                <Field label="현재 통신사" value={openLead.current_carrier} />
                <Field label="희망 기종" value={openLead.desired_device} />
                <Field label="희망 상품" value={openLead.desired_product} />
                <Field label="캠페인" value={openLead.campaign_name} />
                <Field label="유입 경로" value={openLead.source} />
              </div>

              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">상담 상태</div>
                <Select
                  value={openLead.status}
                  onValueChange={(v) => updateStatus(openLead.id, v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">요약 메모</div>
                <Textarea
                  value={memoDraft}
                  onChange={(e) => setMemoDraft(e.target.value)}
                  rows={3}
                />
                <div className="text-right">
                  <Button size="sm" onClick={saveMemo}>
                    메모 저장
                  </Button>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  누적 상담 이력
                </div>
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="통화 내용, 다음 액션 등을 기록하세요"
                  rows={3}
                />
                <div className="text-right">
                  <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
                    이력 추가
                  </Button>
                </div>
                <div className="space-y-2 mt-2">
                  {notes.length === 0 && (
                    <div className="text-xs text-muted-foreground italic">
                      아직 기록된 이력이 없습니다.
                    </div>
                  )}
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-lg border border-border/40 p-2 text-sm"
                    >
                      <div className="text-[11px] text-muted-foreground flex justify-between">
                        <span>{n.author_name ?? "—"}</span>
                        <span>{new Date(n.created_at).toLocaleString("ko-KR")}</span>
                      </div>
                      <div className="whitespace-pre-wrap mt-1">{n.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Lead Sheet */}
      <Sheet open={showCreate} onOpenChange={setShowCreate}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>리드 수동 추가</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {[
              ["name", "고객명"],
              ["phone", "연락처"],
              ["current_carrier", "현재 통신사"],
              ["desired_device", "희망 기종"],
              ["desired_product", "희망 상품"],
              ["campaign_name", "캠페인명"],
            ].map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input
                  value={(draft as any)[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">메모</label>
              <Textarea
                rows={3}
                value={draft.memo}
                onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                취소
              </Button>
              <Button onClick={createLead}>등록</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "-"}</div>
    </div>
  );
}