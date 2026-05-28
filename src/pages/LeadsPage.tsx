import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStaff } from "@/hooks/useDashboardStaff";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Search, UserPlus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ============================================================
   통합 [리드 / 인입 관리 CRM]
   - Split View (좌 60% 리스트 · 우 40% 상세/입력)
   - 모바일: 리스트 → 탭 → Drawer 형태 Sheet(bottom)
   ============================================================ */

const STATUS_OPTIONS = [
  "신규접수",
  "상담중",
  "부재",
  "재케어",
  "개통완료",
  "실패/취소",
] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_TABS: { key: "all" | Status; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "신규접수", label: "신규접수" },
  { key: "상담중", label: "상담중" },
  { key: "부재", label: "부재" },
  { key: "재케어", label: "재케어" },
  { key: "개통완료", label: "개통완료" },
  { key: "실패/취소", label: "실패/취소" },
];

const STATUS_COLOR: Record<Status, string> = {
  "신규접수": "bg-red-100 text-red-700 border-red-200",
  "상담중": "bg-blue-100 text-blue-700 border-blue-200",
  "부재": "bg-amber-100 text-amber-700 border-amber-200",
  "재케어": "bg-purple-100 text-purple-700 border-purple-200",
  "개통완료": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "실패/취소": "bg-rose-100 text-rose-700 border-rose-200",
};

// 드롭다운 옵션 — 좌측 리스트와 우측 폼 양쪽에서 100% 동일 라벨 사용
const CARRIER_OPTIONS = ["SKT", "KT", "LGU+", "알뜰폰"] as const;
const CHANNEL_OPTIONS = [
  "메타 광고",
  "도그마루",
  "유닥",
  "모요",
  "당근",
  "오프라인",
  "전화 문의",
  "기타",
] as const;

// 기기 정보 — DB에는 desired_device 단일 컬럼만 있으므로
// "모델 | 용량 | 색상" 포맷으로 직렬화/역직렬화한다.
const DEVICE_SEP = " | ";
function parseDevice(raw: string | null | undefined) {
  const [model = "", capacity = "", color = ""] = (raw ?? "").split(DEVICE_SEP);
  return { model: model.trim(), capacity: capacity.trim(), color: color.trim() };
}
function joinDevice(model: string, capacity: string, color: string) {
  const parts = [model.trim(), capacity.trim(), color.trim()];
  // 모두 비어있으면 null 저장을 위해 빈 문자열 리턴
  if (parts.every((p) => !p)) return "";
  return parts.join(DEVICE_SEP);
}

// 구 상태값 호환 매핑 (DB에 남아있는 옛 라벨 → 신 라벨)
const normalizeStatus = (s: string | null | undefined): Status => {
  const v = (s ?? "").replace(/\s+/g, "");
  if (v === "신규접수" || v === "신규") return "신규접수";
  if (v === "통화중" || v === "상담중") return "상담중";
  if (v === "부재중" || v === "부재") return "부재";
  if (v === "보류" || v === "재케어" || v === "재상담") return "재케어";
  if (v === "개통완료" || v === "성공") return "개통완료";
  if (v === "취소" || v === "실패" || v === "실패/취소") return "실패/취소";
  return "신규접수";
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
  assigned_to: string | null;
};

type LeadNote = {
  id: string;
  lead_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
};

const emptyDraft = {
  name: "",
  phone: "",
  current_carrier: "",
  desired_device: "",
  device_model: "",
  device_capacity: "",
  device_color: "",
  desired_product: "",
  campaign_name: "",
  source: "",
  memo: "",
  status: "신규접수" as Status,
  assigned_to: "" as string,
};
type Draft = typeof emptyDraft;

export default function LeadsPage() {
  const { user } = useAuth();
  const { staff } = useDashboardStaff();
  const isMobile = useIsMobile();

  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");

  // 현재 선택된 리드 (우측 패널 / 모바일 Drawer)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 신규 작성 모드
  const [createMode, setCreateMode] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  // 상담 노트
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  // 모바일 drawer 오픈
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // 선택된 리드 → draft 동기화 (편집 가능)
  // - rows 가 늦게 로드돼도 selectedId 와 매칭되는 row 가 보이는 즉시 1회 바인딩
  // - 같은 선택 id 에 대해 중복 바인딩하지 않아 사용자 편집을 덮어쓰지 않음
  const lastBoundIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (createMode) return;
    if (!selectedId) {
      lastBoundIdRef.current = null;
      setDraft(emptyDraft);
      setNotes([]);
      setNewNote("");
      return;
    }
    if (lastBoundIdRef.current === selectedId) return;
    const sel = rows.find((r) => r.id === selectedId);
    if (!sel) return; // rows 가 아직 도착 전이면 다음 렌더에서 다시 시도
    lastBoundIdRef.current = selectedId;
    const dev = parseDevice(sel.desired_device);
    setDraft({
      name: sel.name ?? "",
      phone: sel.phone ?? "",
      current_carrier: sel.current_carrier ?? "",
      desired_device: sel.desired_device ?? "",
      device_model: dev.model,
      device_capacity: dev.capacity,
      device_color: dev.color,
      desired_product: sel.desired_product ?? "",
      campaign_name: sel.campaign_name ?? "",
      source: sel.source ?? "",
      memo: sel.memo ?? "",
      status: normalizeStatus(sel.status),
      assigned_to: sel.assigned_to ?? "",
    });
    setNewNote("");
    (async () => {
      const { data, error } = await supabase
        .from("lead_notes")
        .select("*")
        .eq("lead_id", sel.id)
        .order("created_at", { ascending: false });
      if (error) {
        setNotes([]);
        return;
      }
      setNotes(((data ?? []) as any) as LeadNote[]);
    })();
  }, [selectedId, createMode, rows]);

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
      .channel("leads-crm-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (p) => {
          const row = p.new as Lead;
          setRows((prev) =>
            prev.some((r) => r.id === row.id) ? prev : [row, ...prev],
          );
          toast.success(`신규 리드: ${row.name ?? "(이름 없음)"}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (p) => {
          const row = p.new as Lead;
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (p) => {
          const oldRow = p.old as { id: string };
          setRows((prev) => prev.filter((r) => r.id !== oldRow.id));
          setSelectedId((cur) => (cur === oldRow.id ? null : cur));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    STATUS_OPTIONS.forEach((s) => (m[s] = 0));
    rows.forEach((r) => {
      m[normalizeStatus(r.status)]++;
    });
    return m;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusTab !== "all" && normalizeStatus(r.status) !== statusTab) return false;
      if (q) {
        const hay = `${r.name ?? ""} ${r.phone ?? ""} ${r.campaign_name ?? ""} ${r.desired_device ?? ""} ${r.desired_product ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusTab, search]);

  function openLead(id: string) {
    setCreateMode(false);
    setSelectedId(id);
    if (isMobile) setDrawerOpen(true);
  }

  function startCreate() {
    setCreateMode(true);
    setSelectedId(null);
    setDraft(emptyDraft);
    setNotes([]);
    setNewNote("");
    if (isMobile) setDrawerOpen(true);
  }

  function closeRight() {
    setDrawerOpen(false);
    setCreateMode(false);
    setSelectedId(null);
  }

  async function saveDraft() {
    const deviceSerialized = joinDevice(
      draft.device_model,
      draft.device_capacity,
      draft.device_color,
    );
    const payload: any = {
      name: draft.name || null,
      phone: draft.phone || null,
      current_carrier: draft.current_carrier || null,
      desired_device: deviceSerialized || null,
      desired_product: draft.desired_product || null,
      campaign_name: draft.campaign_name || null,
      source: draft.source || null,
      memo: draft.memo || null,
      status: draft.status,
      assigned_to: draft.assigned_to || null,
    };

    if (createMode) {
      if (!payload.name && !payload.phone) {
        return toast.error("고객명 또는 연락처는 필수입니다");
      }
      if (!payload.source) payload.source = "manual";
      const { data, error } = await supabase
        .from("leads")
        .insert(payload)
        .select("*")
        .single();
      if (error) return toast.error(error.message);
      toast.success("리드를 등록했습니다");
      setRows((prev) => [data as Lead, ...prev]);
      setCreateMode(false);
      setSelectedId((data as Lead).id);
      lastBoundIdRef.current = null; // 새 id 로 재바인딩 허용
    } else if (selected) {
      const { error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", selected.id);
      if (error) return toast.error(error.message);
      setRows((prev) =>
        prev.map((r) => (r.id === selected.id ? { ...r, ...payload } : r)),
      );
      toast.success("저장되었습니다");
    }
  }

  async function addNote() {
    if (!selected || !newNote.trim()) return;
    const payload = {
      lead_id: selected.id,
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

  // 우측 패널 / 모바일 drawer 본문
  const rightPane = (
    <RightPane
      createMode={createMode}
      selected={selected}
      draft={draft}
      setDraft={setDraft}
      saveDraft={saveDraft}
      notes={notes}
      newNote={newNote}
      setNewNote={setNewNote}
      addNote={addNote}
      staff={staff}
      onClose={closeRight}
      isMobile={isMobile}
    />
  );

  return (
    <div className="p-4 md:p-6 space-y-4 text-foreground">
      {/* 헤더 */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            리드 / 인입 관리 CRM
          </h1>
          <p className="text-xs md:text-sm text-foreground/70">
            메타 광고·전화 문의 등 모든 인입 채널을 한 화면에서 마감합니다.
          </p>
        </div>
        <Button onClick={startCreate} className="gap-1.5">
          <UserPlus className="size-4" /> 리드 추가
        </Button>
      </div>

      {/* 상태 탭 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_TABS.map((t) => {
          const active = statusTab === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setStatusTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                active
                  ? "bg-foreground text-background border-foreground shadow"
                  : "bg-background text-foreground/70 border-border hover:border-foreground/40",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums",
                  active ? "bg-background/20 text-background" : "bg-muted text-foreground/70",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
        <div className="relative ml-auto">
          <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 w-56 h-9"
            placeholder="고객명·연락처·캠페인"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* 좌측 (60%) — md:col-span-3 */}
        <Card className="md:col-span-3 overflow-hidden border-border">
          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-bold">접수</TableHead>
                  <TableHead className="text-foreground font-bold">고객명</TableHead>
                  <TableHead className="text-foreground font-bold">연락처</TableHead>
                  <TableHead className="text-foreground font-bold">희망 상품</TableHead>
                  <TableHead className="text-foreground font-bold w-32">담당자</TableHead>
                  <TableHead className="text-foreground font-bold w-28">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-foreground/60">
                      불러오는 중…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-foreground/60">
                      표시할 리드가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => {
                  const active = r.id === selectedId;
                  const st = normalizeStatus(r.status);
                  const assignee = staff.find((s) => s.user_id === r.assigned_to);
                  return (
                    <TableRow
                      key={r.id}
                      onClick={() => openLead(r.id)}
                      className={cn(
                        "cursor-pointer border-b border-border",
                        active ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/40",
                      )}
                    >
                      <TableCell className="text-xs tabular-nums text-foreground/80 font-medium">
                        {new Date(r.created_at).toLocaleString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        {r.name ?? "-"}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm text-foreground font-medium">
                        {r.phone ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {r.desired_product ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-foreground">
                        {assignee?.display_name ?? (
                          <span className="text-foreground/40">미지정</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border",
                            STATUS_COLOR[st],
                          )}
                        >
                          {st}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border bg-muted/30">
            {filtered.length} / {rows.length}건 표시
          </div>
        </Card>

        {/* 우측 (40%) — PC/태블릿에서만 노출 */}
        <Card className="hidden md:flex md:col-span-2 flex-col overflow-hidden border-border">
          <div className="max-h-[calc(100vh-260px)] overflow-auto">
            {rightPane}
          </div>
        </Card>
      </div>

      {/* 모바일 Drawer (bottom sheet) */}
      <Sheet
        open={isMobile && drawerOpen && (createMode || !!selected)}
        onOpenChange={(o) => !o && closeRight()}
      >
        <SheetContent
          side="bottom"
          className="h-[92vh] overflow-y-auto rounded-t-2xl p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>리드 상세</SheetTitle>
            <SheetDescription>리드 상세 정보 및 상담 메모</SheetDescription>
          </SheetHeader>
          {rightPane}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------------- Right Pane ---------------- */
type RightPaneProps = {
  createMode: boolean;
  selected: Lead | null;
  draft: Draft;
  setDraft: (d: Draft) => void;
  saveDraft: () => void;
  notes: LeadNote[];
  newNote: string;
  setNewNote: (s: string) => void;
  addNote: () => void;
  staff: { user_id: string; display_name: string; position?: string | null }[];
  onClose: () => void;
  isMobile: boolean;
};

function RightPane({
  createMode,
  selected,
  draft,
  setDraft,
  saveDraft,
  notes,
  newNote,
  setNewNote,
  addNote,
  staff,
  onClose,
  isMobile,
}: RightPaneProps) {
  const empty = !createMode && !selected;

  if (empty) {
    return (
      <div className="h-full grid place-items-center p-10 text-center text-foreground/50">
        <div>
          <div className="text-sm font-semibold">좌측에서 리드를 선택하세요</div>
          <div className="text-xs mt-1">
            또는 우측 상단 <span className="font-bold">리드 추가</span> 버튼으로 새 리드를 등록할 수 있습니다.
          </div>
        </div>
      </div>
    );
  }

  const update = (k: keyof Draft, v: string) =>
    setDraft({ ...draft, [k]: v as any });

  return (
    <div className="flex flex-col">
      {/* 상단 타이틀 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold text-foreground/60">
            {createMode
              ? "신규 리드 등록"
              : `인입 일시 · ${selected ? new Date(selected.created_at).toLocaleString("ko-KR") : ""}`}
          </div>
          <div className="text-lg font-bold text-foreground mt-0.5">
            {createMode ? "+ 새 리드 입력" : draft.name || "이름 없음"}
          </div>
        </div>
        {isMobile && (
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="size-5" />
          </Button>
        )}
      </div>

      {/* 입력 폼 (2열 그리드) */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <FormField label="고객명">
          <Input value={draft.name} onChange={(e) => update("name", e.target.value)} />
        </FormField>
        <FormField label="연락처">
          <Input value={draft.phone} onChange={(e) => update("phone", e.target.value)} />
        </FormField>
        <FormField label="현재 통신사">
          <Select
            value={draft.current_carrier || "none"}
            onValueChange={(v) => update("current_carrier", v === "none" ? "" : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="통신사 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">선택 안 함</SelectItem>
              {CARRIER_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="희망 상품">
          <Input
            value={draft.desired_product}
            onChange={(e) => update("desired_product", e.target.value)}
          />
        </FormField>
        <FormField label="인입 채널">
          <Select
            value={draft.source || "none"}
            onValueChange={(v) => update("source", v === "none" ? "" : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="채널 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">미지정</SelectItem>
              {CHANNEL_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="캠페인명">
          <Input
            value={draft.campaign_name}
            onChange={(e) => update("campaign_name", e.target.value)}
            placeholder="(선택)"
          />
        </FormField>
        <FormField label="담당자">
          <Select
            value={draft.assigned_to || "none"}
            onValueChange={(v) => update("assigned_to", v === "none" ? "" : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="담당자 지정" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">미지정</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.display_name}
                  {s.position ? ` · ${s.position}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="상담 상태">
          <Select
            value={draft.status}
            onValueChange={(v) => update("status", v)}
          >
            <SelectTrigger
              className={cn(
                "h-9 font-semibold border",
                STATUS_COLOR[draft.status as Status] ?? "",
              )}
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
        </FormField>
      </div>

      {/* 상담 기기 정보 — 모델/용량/색상 분리 */}
      <div className="px-4 pb-2">
        <div className="text-[11px] font-bold text-foreground/70 mb-2">상담 기기 정보</div>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="모델명">
            <Input
              value={draft.device_model}
              onChange={(e) => update("device_model", e.target.value)}
              placeholder="갤럭시 S25"
            />
          </FormField>
          <FormField label="용량">
            <Input
              value={draft.device_capacity}
              onChange={(e) => update("device_capacity", e.target.value)}
              placeholder="256GB"
            />
          </FormField>
          <FormField label="색상">
            <Input
              value={draft.device_color}
              onChange={(e) => update("device_color", e.target.value)}
              placeholder="티타늄 블루"
            />
          </FormField>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button onClick={saveDraft} className="w-full gap-1.5">
          <Save className="size-4" /> {createMode ? "리드 등록" : "변경사항 저장"}
        </Button>
      </div>

      {/* 상담 메모 / 히스토리 — 생성 모드에서는 가림 */}
      {!createMode && selected && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="text-sm font-bold text-foreground">상담 메모</div>

          <div className="rounded-lg border border-border p-3 bg-muted/30">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="새로운 상담 내용을 입력하세요"
              rows={3}
              className="bg-background"
            />
            <div className="text-right mt-2">
              <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
                메모 저장
              </Button>
            </div>
          </div>

          <div className="text-[11px] font-semibold text-foreground/70 mt-2">
            누적 상담 이력 ({notes.length})
          </div>
          {notes.length === 0 ? (
            <div className="text-xs text-foreground/50 italic py-4 text-center border border-dashed border-border rounded-lg">
              아직 기록된 상담 이력이 없습니다.
            </div>
          ) : (
            <ol className="relative border-l-2 border-border ml-2 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="ml-4 relative">
                  <span className="absolute -left-[22px] top-1.5 size-3 rounded-full bg-primary border-2 border-background" />
                  <div className="rounded-lg border border-border bg-background p-3">
                    <div className="text-[11px] flex justify-between font-medium text-foreground/60">
                      <span className="font-semibold text-foreground">
                        {n.author_name ?? "—"}
                      </span>
                      <span>{new Date(n.created_at).toLocaleString("ko-KR")}</span>
                    </div>
                    <div className="whitespace-pre-wrap mt-1.5 text-sm text-foreground">
                      {n.content}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-foreground/60">{label}</label>
      {children}
    </div>
  );
}
