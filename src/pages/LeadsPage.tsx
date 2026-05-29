import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStaff } from "@/hooks/useDashboardStaff";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, PhoneCall, CheckCircle2, Plus, Search, RotateCw, Ban, XCircle } from "lucide-react";
import { toast } from "sonner";
import ChannelIntakePage from "@/pages/ChannelIntakePage";
import { ColumnFilter, matchesFilter, type FilterSelection } from "@/components/common/ColumnFilter";

const STATUS_OPTIONS = [
  "신규 접수",
  "케어중",
  "부재 중",
  "재케어",
  "개통 완료",
  "취소",
] as const;
type Status = (typeof STATUS_OPTIONS)[number];

// 파스텔 배경 제거: 흰 배경 + 진한 텍스트/테두리로 명도 대비 확보
const STATUS_COLOR: Record<string, string> = {
  "신규 접수": "bg-background text-red-700 border border-red-600 font-bold dark:text-red-300 dark:border-red-400",
  "케어중": "bg-background text-blue-700 border border-blue-600 font-bold dark:text-blue-300 dark:border-blue-400",
  "부재 중": "bg-background text-orange-700 border border-orange-600 font-bold dark:text-orange-300 dark:border-orange-400",
  "재케어": "bg-background text-violet-700 border border-violet-600 font-bold dark:text-violet-300 dark:border-violet-400",
  "개통 완료": "bg-background text-emerald-700 border border-emerald-600 font-bold dark:text-emerald-300 dark:border-emerald-400",
  "취소": "bg-background text-rose-700 border border-rose-600 font-bold dark:text-rose-300 dark:border-rose-400",
};

const DOGMARU_CAMPAIGN = "도그마루_홈캠";

const LEADS_SELECT = `
  id,
  created_at,
  name,
  phone,
  current_carrier,
  desired_device,
  desired_product,
  campaign_name,
  status,
  memo,
  source,
  assigned_to,
  registration_date,
  customer_name,
  customer_phone,
  branch_name,
  activation_status,
  cancellation_status,
  activation_number
`;

const cleanText = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return value == null ? null : String(value);
};

const toDogmaruItem = (item: Lead) => ({
  ...item,
  registration_date: cleanText(item.registration_date),
  customer_name: cleanText(item.customer_name),
  customer_phone: cleanText(item.customer_phone),
  branch_name: cleanText(item.branch_name),
  activation_status: cleanText(item.activation_status),
  cancellation_status: cleanText(item.cancellation_status),
  activation_number: cleanText(item.activation_number),
});

type LeadDraft = {
  name: string;
  phone: string;
  current_carrier: string;
  desired_device: string;
  desired_product: string;
  campaign_name: string;
  memo: string;
};

const DRAFT_FIELDS: Array<{ key: keyof LeadDraft; label: string }> = [
  { key: "name", label: "고객명" },
  { key: "phone", label: "연락처" },
  { key: "current_carrier", label: "현재 통신사" },
  { key: "desired_device", label: "희망 기종" },
  { key: "desired_product", label: "희망 상품" },
  { key: "campaign_name", label: "캠페인명" },
];

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
  // 도그마루 시트 연동 필드
  registration_date: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  branch_name: string | null;
  activation_status: string | null;
  cancellation_status: string | null;
  activation_number: string | null;
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
  const { staff } = useDashboardStaff();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceTab, setSourceTab] = useState<"meta" | "dogmaru" | "other">("meta");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [memoDraft, setMemoDraft] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [intakeFormOpen, setIntakeFormOpen] = useState(false);
  const [inquiryRows, setInquiryRows] = useState<{ created_at: string; status: string | null }[]>([]);
  const [period, setPeriod] = useState<"all" | "month" | "day">("all");
  // 엑셀형 컬럼 필터 (메타/도그마루 공통 + 각자 고유)
  const [fStatus, setFStatus] = useState<FilterSelection>(null);
  const [fCarrier, setFCarrier] = useState<FilterSelection>(null);
  const [fProduct, setFProduct] = useState<FilterSelection>(null);
  const [fCampaign, setFCampaign] = useState<FilterSelection>(null);
  const [fAssignee, setFAssignee] = useState<FilterSelection>(null);
  const [fBranch, setFBranch] = useState<FilterSelection>(null);
  const [fActivation, setFActivation] = useState<FilterSelection>(null);
  const [fCancellation, setFCancellation] = useState<FilterSelection>(null);
  const [draft, setDraft] = useState<LeadDraft>({
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
      .select(LEADS_SELECT)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error(error.message);
    setRows((data ?? []) as Lead[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // 기타 인입(inquiries) 경량 집계 데이터 — 매트릭스 보드용
    (async () => {
      const { data } = await supabase
        .from("inquiries")
        .select("created_at,status")
        .order("created_at", { ascending: false })
        .limit(5000);
      setInquiryRows((data ?? []) as { created_at: string; status: string | null }[]);
    })();
    const ch = supabase
      .channel("leads-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new as Lead;
          setRows((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev];
          });
          toast.success(`신규 리드 인입: ${row.name ?? "(이름 없음)"}`);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leads" },
        (payload) => {
          const row = payload.new as Lead;
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "leads" },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setRows((prev) => prev.filter((r) => r.id !== oldRow.id));
        },
      )
      .subscribe();
    const ich = supabase
      .channel("inquiries-matrix-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inquiries" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const r = payload.new as any;
            setInquiryRows((prev) => [{ created_at: r.created_at, status: r.status }, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const r = payload.new as any;
            setInquiryRows((prev) =>
              prev.map((x) => (x.created_at === r.created_at ? { ...x, status: r.status } : x)),
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(ich);
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
      setNotes((data ?? []) as LeadNote[]);
    })();
  }, [openLead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const isDogmaru = r.campaign_name === DOGMARU_CAMPAIGN;
      if (sourceTab === "dogmaru" && !isDogmaru) return false;
      if (sourceTab === "meta" && isDogmaru) return false;
      if (q) {
        // 이름 / 번호 통합 검색 — 메타·도그마루 양쪽 필드 모두 포함
        const hay = `${r.name ?? ""} ${r.phone ?? ""} ${r.customer_name ?? ""} ${r.customer_phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (sourceTab === "meta") {
        if (!matchesFilter(r.status, fStatus)) return false;
        if (!matchesFilter(r.current_carrier, fCarrier)) return false;
        if (!matchesFilter(r.desired_product, fProduct)) return false;
        if (!matchesFilter(r.campaign_name, fCampaign)) return false;
        const assigneeName = r.assigned_to ? staff.find((s) => s.user_id === r.assigned_to)?.display_name ?? "" : "";
        if (!matchesFilter(assigneeName, fAssignee)) return false;
      } else if (sourceTab === "dogmaru") {
        if (!matchesFilter(r.branch_name, fBranch)) return false;
        if (!matchesFilter(r.activation_status, fActivation)) return false;
        if (!matchesFilter(r.cancellation_status, fCancellation)) return false;
      }
      return true;
    });
  }, [rows, search, sourceTab, fStatus, fCarrier, fProduct, fCampaign, fAssignee, fBranch, fActivation, fCancellation, staff]);

  const sourceCounts = useMemo(() => {
    let dogmaru = 0;
    let meta = 0;
    for (const r of rows) {
      if (r.campaign_name === DOGMARU_CAMPAIGN) dogmaru++;
      else meta++;
    }
    return { meta, dogmaru };
  }, [rows]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: rows.length,
      todayNew: rows.filter((r) => r.created_at.slice(0, 10) === today).length,
      completed: rows.filter((r) => r.status === "개통 완료").length,
      newCount: rows.filter((r) => r.status === "신규 접수").length,
    };
  }, [rows]);

  // ── 경로별 성과 매트릭스 (메타 / 도그마루 / 기타) ──
  const matrix = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const inRange = (iso: string) => {
      if (period === "all") return true;
      if (period === "month") return iso.slice(0, 7) === month;
      return iso.slice(0, 10) === today;
    };
    const empty = () => ({ total: 0, today: 0, done: 0, recare: 0, absent: 0, fail: 0 });
    const meta = empty();
    const dogmaru = empty();
    const other = empty();

    for (const r of rows) {
      if (!inRange(r.created_at)) continue;
      const bucket = r.campaign_name === DOGMARU_CAMPAIGN ? dogmaru : meta;
      bucket.total += 1;
      if (r.created_at.slice(0, 10) === today) bucket.today += 1;
      if (r.status === "개통 완료") bucket.done += 1;
      if (r.status === "재케어") bucket.recare += 1;
      if (r.status === "부재 중") bucket.absent += 1;
      if (r.status === "실패" || r.status === "취소") bucket.fail += 1;
    }
    for (const r of inquiryRows) {
      if (!inRange(r.created_at)) continue;
      other.total += 1;
      if (r.created_at.slice(0, 10) === today) other.today += 1;
      if (r.status === "개통완료") other.done += 1;
      if (r.status === "재케어") other.recare += 1;
      if (r.status === "부재") other.absent += 1;
      if (r.status === "실패" || r.status === "취소") other.fail += 1;
    }
    return { meta, dogmaru, other };
  }, [rows, inquiryRows, period]);

  // ── 엑셀형 헤더 필터에 들어갈 고유값 (탭별로 분리해 메타↔도그마루 섞이지 않게) ──
  const metaRows = useMemo(() => rows.filter((r) => r.campaign_name !== DOGMARU_CAMPAIGN), [rows]);
  const dogmaruRows = useMemo(() => rows.filter((r) => r.campaign_name === DOGMARU_CAMPAIGN), [rows]);
  const valStatus = useMemo(() => metaRows.map((r) => r.status ?? ""), [metaRows]);
  const valCarrier = useMemo(() => metaRows.map((r) => r.current_carrier ?? ""), [metaRows]);
  const valProduct = useMemo(() => metaRows.map((r) => r.desired_product ?? ""), [metaRows]);
  const valCampaign = useMemo(() => metaRows.map((r) => r.campaign_name ?? ""), [metaRows]);
  const valAssignee = useMemo(
    () => metaRows.map((r) => (r.assigned_to ? staff.find((s) => s.user_id === r.assigned_to)?.display_name ?? "" : "")),
    [metaRows, staff],
  );
  const valBranch = useMemo(() => dogmaruRows.map((r) => r.branch_name ?? ""), [dogmaruRows]);
  const valActivation = useMemo(() => dogmaruRows.map((r) => r.activation_status ?? ""), [dogmaruRows]);
  const valCancellation = useMemo(() => dogmaruRows.map((r) => r.cancellation_status ?? ""), [dogmaruRows]);

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
      if (openLead?.id === id) setOpenLead({ ...openLead, status });
    }
  }

  async function updateAssignee(id: string, assigned_to: string | null) {
    const { error } = await supabase
      .from("leads")
      .update({ assigned_to })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setRows((p) => p.map((r) => (r.id === id ? { ...r, assigned_to } : r)));
    if (openLead?.id === id) setOpenLead({ ...openLead, assigned_to });
  }

  const staffName = (uid: string | null | undefined) =>
    staff.find((s) => s.user_id === uid)?.display_name ?? "";

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
    <div className="p-6 space-y-5 text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">잠재고객 관리</h1>
          <p className="text-sm text-foreground/70">
            메타 광고 등 외부 인입 리드를 통합 관리합니다.
          </p>
        </div>
        {sourceTab === "other" ? (
          <Button onClick={() => setIntakeFormOpen(true)}>
            <Plus className="size-4 mr-1" /> 인입 등록
          </Button>
        ) : (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4 mr-1" /> 리드 추가
          </Button>
        )}
      </div>

      {/* 종합 리드 성과 보드 — 경로별/기간별 매트릭스 */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-foreground">종합 리드 성과 보드</div>
            <div className="text-xs text-muted-foreground">경로별 · 기간별 접수/개통 매트릭스</div>
          </div>
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
            {([
              { k: "all", l: "누적" },
              { k: "month", l: "월별" },
              { k: "day", l: "일별" },
            ] as const).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setPeriod(opt.k)}
                className={
                  "px-3 py-1.5 text-xs font-semibold rounded transition-colors " +
                  (period === opt.k
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop/Tablet: 격자 매트릭스 */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 px-2 w-32">지표</th>
                <th className="text-right font-medium py-2 px-2">메타</th>
                <th className="text-right font-medium py-2 px-2">도그마루</th>
                <th className="text-right font-medium py-2 px-2">기타</th>
                <th className="text-right font-semibold py-2 px-2 text-foreground">총합</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {([
                { label: "전체 접수", icon: UserCheck, key: "total" as const, tone: "text-primary" },
                { label: "오늘 신규", icon: PhoneCall, key: "today" as const, tone: "text-orange-600 dark:text-orange-400" },
                { label: "개통 완료", icon: CheckCircle2, key: "done" as const, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: "재케어", icon: RotateCw, key: "recare" as const, tone: "text-zinc-600 dark:text-zinc-300" },
                { label: "부재", icon: Ban, key: "absent" as const, tone: "text-orange-600 dark:text-orange-400" },
                { label: "실패", icon: XCircle, key: "fail" as const, tone: "text-rose-600 dark:text-rose-400" },
              ]).map((row) => {
                const Icon = row.icon;
                const m = matrix.meta[row.key];
                const d = matrix.dogmaru[row.key];
                const o = matrix.other[row.key];
                const sum = m + d + o;
                return (
                  <tr key={row.key} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2">
                        <Icon className={"size-4 " + row.tone} />
                        <span className="font-medium">{row.label}</span>
                      </div>
                    </td>
                    <td className="text-right py-1.5 px-2">{m.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2">{d.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2">{o.toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2 font-bold text-base">{sum.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: 세로형 스택 */}
        <div className="sm:hidden space-y-3">
          {([
            { label: "전체 접수", icon: UserCheck, key: "total" as const, tone: "text-primary" },
            { label: "오늘 신규", icon: PhoneCall, key: "today" as const, tone: "text-orange-600 dark:text-orange-400" },
            { label: "개통 완료", icon: CheckCircle2, key: "done" as const, tone: "text-emerald-600 dark:text-emerald-400" },
            { label: "재케어", icon: RotateCw, key: "recare" as const, tone: "text-zinc-600 dark:text-zinc-300" },
            { label: "부재", icon: Ban, key: "absent" as const, tone: "text-orange-600 dark:text-orange-400" },
            { label: "실패", icon: XCircle, key: "fail" as const, tone: "text-rose-600 dark:text-rose-400" },
          ]).map((row) => {
            const Icon = row.icon;
            const m = matrix.meta[row.key];
            const d = matrix.dogmaru[row.key];
            const o = matrix.other[row.key];
            const sum = m + d + o;
            return (
              <div key={row.key} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={"size-4 " + row.tone} />
                    <span className="text-sm font-semibold">{row.label}</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{sum.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { k: "메타", v: m },
                    { k: "도그마루\n214", v: d },
                    { k: "기타", v: o },
                  ].map((c) => (
                    <div key={c.k} className="rounded-md bg-muted/50 py-1.5">
                      <div className="text-[10px] text-muted-foreground">{c.k}</div>
                      <div className="text-sm font-semibold tabular-nums">{c.v.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      {sourceTab !== "other" && (
        <Card className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-10 text-sm"
              placeholder="고객명 또는 휴대폰 번호로 검색…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-foreground/60">
            엑셀처럼 각 헤더의 <span className="font-semibold text-foreground/80">▼</span> 를 눌러 다중 선택으로 좁혀보세요.
          </div>
          <div className="ml-auto text-xs text-foreground/60 tabular-nums">
            {filtered.length.toLocaleString()} / {rows.length.toLocaleString()}건
          </div>
        </Card>
      )}

      {/* Table */}
      <Tabs value={sourceTab} onValueChange={(v) => setSourceTab(v as "meta" | "dogmaru" | "other")}>
        <TabsList className="grid grid-cols-3 w-full max-w-2xl h-12 bg-muted/60 mb-3">
          <TabsTrigger value="meta" className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            메타광고
            <Badge variant="secondary" className="ml-2 tabular-nums">{sourceCounts.meta}</Badge>
          </TabsTrigger>
          <TabsTrigger value="dogmaru" className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            도그마루 시트
            <Badge variant="secondary" className="ml-2 tabular-nums">{sourceCounts.dogmaru}</Badge>
          </TabsTrigger>
          <TabsTrigger value="other" className="text-base font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground">
            기타 인입
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {sourceTab === "other" ? (
        <div key="other-intake" className="animate-fade-in">
          <ChannelIntakePage
            embedded
            formOpen={intakeFormOpen}
            onFormOpenChange={setIntakeFormOpen}
          />
        </div>
      ) : (
      <Card key={sourceTab} className="overflow-hidden border-border animate-fade-in">
        {sourceTab === "dogmaru" ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 border-b-2 border-border hover:bg-muted/60">
                <TableHead className="text-foreground font-bold">접수 일자</TableHead>
                <TableHead className="text-foreground font-bold">고객 성명</TableHead>
                <TableHead className="text-foreground font-bold">연락처</TableHead>
                <TableHead className="text-foreground font-bold">
                  <ColumnFilter label="접수 지점명" values={valBranch} selected={fBranch} onChange={setFBranch} />
                </TableHead>
                <TableHead className="text-foreground font-bold">
                  <ColumnFilter label="개통 상태" values={valActivation} selected={fActivation} onChange={setFActivation} />
                </TableHead>
                <TableHead className="text-foreground font-bold">
                  <ColumnFilter label="해지 및 철회" values={valCancellation} selected={fCancellation} onChange={setFCancellation} />
                </TableHead>
                <TableHead className="text-foreground font-bold">가입번호</TableHead>
                <TableHead className="text-foreground font-bold w-20 text-center">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-foreground/60">
                    불러오는 중…
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-foreground/60">
                    도그마루 시트에서 인입된 데이터가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const item = toDogmaruItem(r);
                const isCancelled = !!item.cancellation_status;
                const isActivated = (item.activation_status ?? "").includes("개통완료");
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer border-b border-border hover:bg-muted/40"
                    onClick={() => setOpenLead(item)}
                  >
                    <TableCell className="tabular-nums text-foreground font-medium">
                      {item.registration_date ?? "-"}
                    </TableCell>
                    <TableCell className="font-bold text-foreground">
                      {item.customer_name ?? "-"}
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground font-medium">
                      {item.customer_phone ?? "-"}
                    </TableCell>
                    <TableCell className="text-foreground">{item.branch_name ?? "-"}</TableCell>
                    <TableCell>
                      {item.activation_status ? (
                        <Badge
                          className={
                            "bg-background border font-bold " +
                            (isActivated
                              ? "text-emerald-700 border-emerald-600 dark:text-emerald-300 dark:border-emerald-400"
                              : "text-zinc-700 border-zinc-500 dark:text-zinc-200 dark:border-zinc-400")
                          }
                        >
                          {item.activation_status}
                        </Badge>
                      ) : (
                        <span className="text-foreground/40">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isCancelled ? (
                        <Badge className="bg-background text-rose-700 border border-rose-600 font-bold dark:text-rose-300 dark:border-rose-400">
                          {item.cancellation_status}
                        </Badge>
                      ) : (
                        <span className="text-foreground/40">-</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground/80">
                      {item.activation_number ?? "-"}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setOpenLead(item)}>
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 border-b-2 border-border hover:bg-muted/60">
              <TableHead className="text-foreground font-bold">접수 일시</TableHead>
              <TableHead className="text-foreground font-bold">고객명</TableHead>
              <TableHead className="text-foreground font-bold">연락처</TableHead>
              <TableHead className="text-foreground font-bold">
                <ColumnFilter label="현재 통신사" values={valCarrier} selected={fCarrier} onChange={setFCarrier} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-16 text-xs">희망 기종</TableHead>
              <TableHead className="text-foreground font-bold w-16 text-xs">
                <ColumnFilter label="희망 상품" values={valProduct} selected={fProduct} onChange={setFProduct} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-16 text-xs">
                <ColumnFilter label="캠페인" values={valCampaign} selected={fCampaign} onChange={setFCampaign} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-32">
                <ColumnFilter label="담당자" values={valAssignee} selected={fAssignee} onChange={setFAssignee} />
              </TableHead>
              <TableHead className="text-foreground font-bold w-28">
                <ColumnFilter label="상담 상태" values={valStatus} selected={fStatus} onChange={setFStatus} />
              </TableHead>
              <TableHead className="text-foreground font-bold min-w-[440px]">메모</TableHead>
              <TableHead className="text-foreground font-bold w-20 text-center">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-10 text-foreground/60">
                  불러오는 중…
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-10 text-foreground/60">
                  표시할 리드가 없습니다.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow
                key={r.id}
                className="cursor-pointer border-b border-border hover:bg-muted/40"
                onClick={() => setOpenLead(r)}
              >
                <TableCell className="tabular-nums text-xs text-foreground font-medium">
                  {new Date(r.created_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="font-bold text-foreground">{r.name ?? "-"}</TableCell>
                <TableCell className="tabular-nums text-foreground font-medium">{r.phone ?? "-"}</TableCell>
                <TableCell className="text-foreground">{r.current_carrier ?? "-"}</TableCell>
                <TableCell className="text-foreground/80 text-xs truncate max-w-[64px]" title={r.desired_device ?? ""}>{r.desired_device ?? "-"}</TableCell>
                <TableCell className="text-foreground/80 text-xs truncate max-w-[64px]" title={r.desired_product ?? ""}>{r.desired_product ?? "-"}</TableCell>
                <TableCell className="text-xs text-foreground/60 truncate max-w-[64px]" title={r.campaign_name ?? ""}>
                  {r.campaign_name ?? "-"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={r.assigned_to ?? "none"}
                    onValueChange={(v) => updateAssignee(r.id, v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="담당자 지정" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">담당자 지정</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {s.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={r.status}
                    onValueChange={(v) => updateStatus(r.id, v)}
                  >
                    <SelectTrigger
                      className={`h-8 text-xs ${STATUS_COLOR[r.status] ?? ""}`}
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
                  className="min-w-[440px] text-xs text-foreground whitespace-normal break-words leading-relaxed"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenLead(r);
                  }}
                >
                  {r.memo || <span className="italic text-foreground/40">메모 추가…</span>}
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
        )}
      </Card>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!openLead} onOpenChange={(o) => !o && setOpenLead(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {openLead && (
            <>
              {/* Title block */}
              <SheetHeader className="border-b border-border pb-4">
                <div className="text-xs font-semibold text-foreground/60">
                  인입 일시 ·{" "}
                  {new Date(openLead.created_at).toLocaleString("ko-KR")}
                </div>
                <SheetTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                  {openLead.name ?? "이름 없음"}
                  <Badge className={STATUS_COLOR[openLead.status] ?? ""}>
                    {openLead.status}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  잠재고객 상세 정보
                </SheetDescription>
              </SheetHeader>

              {/* Info grid */}
              <div className="mt-5 rounded-lg border border-border overflow-hidden">
                <InfoRow label="고객명" value={openLead.name} right={{ label: "연락처", value: openLead.phone }} />
                <InfoRow label="현재 통신사" value={openLead.current_carrier} right={{ label: "희망 기종", value: openLead.desired_device }} />
                <InfoRow label="희망 상품" value={openLead.desired_product} right={{ label: "인입 경로", value: openLead.campaign_name ?? openLead.source }} />
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="p-3">
                    <div className="text-[11px] font-semibold text-foreground/60 mb-1">담당자</div>
                    <Select
                      value={openLead.assigned_to ?? "none"}
                      onValueChange={(v) => updateAssignee(openLead.id, v === "none" ? null : v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="담당자 지정" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">담당자 지정</SelectItem>
                        {staff.map((s) => (
                          <SelectItem key={s.user_id} value={s.user_id}>
                            {s.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3">
                    <div className="text-[11px] font-semibold text-foreground/60 mb-1">상담 상태</div>
                    <Select
                      value={openLead.status}
                      onValueChange={(v) => updateStatus(openLead.id, v)}
                    >
                      <SelectTrigger className="h-9">
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
                </div>
              </div>

              {/* Consultation memo feed */}
              <div className="mt-6">
                <div className="text-sm font-bold text-foreground mb-2">상담 메모</div>

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

                <div className="mt-4 space-y-3">
                  <div className="text-xs font-semibold text-foreground/70">
                    누적 상담 이력 ({notes.length})
                  </div>
                  {notes.length === 0 && (
                    <div className="text-sm text-foreground/50 italic py-4 text-center border border-dashed border-border rounded-lg">
                      아직 기록된 상담 이력이 없습니다.
                    </div>
                  )}
                  <ol className="relative border-l-2 border-border ml-2 space-y-3">
                    {notes.map((n) => (
                      <li key={n.id} className="ml-4">
                        <div className="absolute -left-[7px] mt-1.5 size-3 rounded-full bg-primary border-2 border-background" />
                        <div className="rounded-lg border border-border bg-background p-3">
                          <div className="text-[11px] text-foreground/60 flex justify-between font-medium">
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
            {DRAFT_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
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
      <div className="text-[11px] font-semibold text-foreground/60">{label}</div>
      <div className="font-semibold text-foreground">{value || "-"}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  right,
}: {
  label: string;
  value: string | null;
  right: { label: string; value: string | null };
}) {
  return (
    <div className="grid grid-cols-2 divide-x divide-border border-b border-border last:border-b-0">
      <div className="p-3">
        <div className="text-[11px] font-semibold text-foreground/60 mb-0.5">{label}</div>
        <div className="text-sm font-semibold text-foreground">{value || "-"}</div>
      </div>
      <div className="p-3">
        <div className="text-[11px] font-semibold text-foreground/60 mb-0.5">{right.label}</div>
        <div className="text-sm font-semibold text-foreground">{right.value || "-"}</div>
      </div>
    </div>
  );
}