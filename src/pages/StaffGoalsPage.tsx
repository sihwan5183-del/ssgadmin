import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/useRole";
import { useStores } from "@/hooks/useStores";
import { toast } from "sonner";
import {
  Save, Copy, Users, BookmarkPlus, FolderOpen, Trash2, Search, Target,
  Plus, Pencil, Calculator, Hash, Percent, Settings2, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------- Types -------------------- */
interface StaffRow {
  user_id: string;
  display_name: string;
  team: string | null;
  store: string | null;
  position: string | null;
  status: string;
}

interface MappingItem {
  key: string;
  label: string;
  products: string[];
  sale_types: string[];
}

type Mode = "count" | "percent";

interface GoalEntry {
  mode: Mode;
  count: number;   // raw 입력값 (count 모드일 때) — 표시용
  percent: number; // raw 입력값 (percent 모드일 때)
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  goals: Record<string, number>;
  created_at: string;
}

/* -------------------- Helpers -------------------- */
const yearOptions = (() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
})();
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
const MOBILE_KEY = "mobile";

const goalKey = (uid: string, itemKey: string) => `${uid}::${itemKey}`;

function bucketProduct(prodValue: string | null | undefined, mapping: MappingItem[]): string | null {
  const v = (prodValue ?? "").toString().trim();
  if (!v) return null;
  for (const m of mapping) {
    for (const p of m.products) {
      if (v.includes(p) || p.includes(v)) return m.key;
    }
  }
  return null;
}

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "_").replace(/^_+|_+$/g, "") || `item_${Date.now()}`;

/** 모바일 베이스 × 비중(%) → 건수 */
const computeCountFromPercent = (mobileBase: number, percent: number) =>
  Math.round((Math.max(0, mobileBase) * Math.max(0, percent)) / 100);

const effectiveCount = (entry: GoalEntry, mobileBase: number) =>
  entry.mode === "percent" ? computeCountFromPercent(mobileBase, entry.percent) : entry.count;

/* -------------------- Page -------------------- */
export default function StaffGoalsPage() {
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { stores } = useStores();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [storeFilter, setStoreFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [q, setQ] = useState("");
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [mapping, setMapping] = useState<MappingItem[]>([]);
  const [goals, setGoals] = useState<Record<string, GoalEntry>>({});
  const [achievedMap, setAchievedMap] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"staff" | "team">("staff");

  // Team goals state
  const [teamGoals, setTeamGoals] = useState<Record<string, GoalEntry>>({}); // key=team::item
  const [teamDirty, setTeamDirty] = useState<Set<string>>(new Set());

  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [itemMgrOpen, setItemMgrOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [copyFromYM, setCopyFromYM] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Item editor draft
  const [draftItems, setDraftItems] = useState<MappingItem[]>([]);

  const yearMonth = useMemo(() => `${year}-${String(month).padStart(2, "0")}`, [year, month]);

  /* Load mapping rule from app_settings */
  const loadMapping = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "staff_goal_mapping")
      .maybeSingle();
    const items = ((data?.value as any)?.items ?? []) as MappingItem[];
    // mobile must always be first
    items.sort((a, b) => (a.key === MOBILE_KEY ? -1 : b.key === MOBILE_KEY ? 1 : 0));
    setMapping(items);
  }, []);

  /* Load staff + goals + achievement */
  const reload = useCallback(async () => {
    setLoading(true);
    const monthStart = `${yearMonth}-01`;
    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    const [{ data: profs }, { data: staffGoalRows }, { data: teamGoalRows }, { data: salesRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name, team, store, position, status")
        .neq("status", "deleted")
        .neq("status", "resigned")
        .order("display_name", { ascending: true }),
      supabase
        .from("staff_product_goals")
        .select("user_id, product, goal_count, goal_input_mode, goal_percent")
        .eq("year_month", yearMonth)
        .eq("goal_type", "count"),
      supabase
        .from("team_product_goals")
        .select("team, product, goal_count, goal_input_mode, goal_percent")
        .eq("year_month", yearMonth)
        .eq("goal_type", "count"),
      supabase
        .from("sales")
        .select("created_by, product, approval_status")
        .gte("open_date", monthStart)
        .lte("open_date", monthEnd)
        .limit(20000),
    ]);
    setStaff((profs ?? []) as StaffRow[]);
    const gm: Record<string, GoalEntry> = {};
    (staffGoalRows ?? []).forEach((g: any) => {
      gm[goalKey(g.user_id, g.product)] = {
        mode: (g.goal_input_mode as Mode) || "count",
        count: Number(g.goal_count ?? 0),
        percent: Number(g.goal_percent ?? 0),
      };
    });
    setGoals(gm);
    const tm: Record<string, GoalEntry> = {};
    (teamGoalRows ?? []).forEach((g: any) => {
      tm[goalKey(g.team, g.product)] = {
        mode: (g.goal_input_mode as Mode) || "count",
        count: Number(g.goal_count ?? 0),
        percent: Number(g.goal_percent ?? 0),
      };
    });
    setTeamGoals(tm);
    setDirty(new Set());
    setTeamDirty(new Set());
    // 실적 집계
    const am: Record<string, number> = {};
    (salesRows ?? []).forEach((s: any) => {
      if (s.approval_status === "취소" || s.approval_status === "반려") return;
      const key = bucketProduct(s.product, mapping);
      if (!key || !s.created_by) return;
      am[goalKey(s.created_by, key)] = (am[goalKey(s.created_by, key)] ?? 0) + 1;
    });
    setAchievedMap(am);
    setLoading(false);
  }, [yearMonth, year, month, mapping]);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from("staff_goal_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates((data ?? []) as any);
  }, []);

  useEffect(() => { loadMapping(); loadTemplates(); }, [loadMapping, loadTemplates]);
  useEffect(() => { if (mapping.length) reload(); }, [reload, mapping.length]);

  /* Filtering */
  const teams = useMemo(() => {
    const set = new Set<string>();
    staff.forEach((s) => s.team && set.add(s.team));
    return Array.from(set).sort();
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return staff.filter((s) => {
      if (storeFilter !== "all" && (s.store ?? "") !== storeFilter) return false;
      if (teamFilter !== "all" && (s.team ?? "") !== teamFilter) return false;
      if (!ql) return true;
      return [s.display_name, s.team, s.store, s.position].filter(Boolean).join(" ").toLowerCase().includes(ql);
    });
  }, [staff, q, storeFilter, teamFilter]);

  /* Cell helpers (staff) */
  const getEntry = (uid: string, itemKey: string): GoalEntry =>
    goals[goalKey(uid, itemKey)] ?? { mode: "count", count: 0, percent: 0 };

  const updateEntry = (uid: string, itemKey: string, patch: Partial<GoalEntry>) => {
    const k = goalKey(uid, itemKey);
    setGoals((m) => ({ ...m, [k]: { ...(m[k] ?? { mode: "count", count: 0, percent: 0 }), ...patch } }));
    setDirty((d) => { const n = new Set(d); n.add(k); return n; });
  };

  const mobileBaseFor = (uid: string) => effectiveCount(getEntry(uid, MOBILE_KEY), 0);
  const cellCount = (uid: string, itemKey: string) =>
    effectiveCount(getEntry(uid, itemKey), mobileBaseFor(uid));
  const totalFor = (uid: string) => mapping.reduce((sum, m) => sum + cellCount(uid, m.key), 0);
  const achievedFor = (uid: string) => mapping.reduce((sum, m) => sum + (achievedMap[goalKey(uid, m.key)] ?? 0), 0);

  /* Cell helpers (team) */
  const getTeamEntry = (team: string, itemKey: string): GoalEntry =>
    teamGoals[goalKey(team, itemKey)] ?? { mode: "count", count: 0, percent: 0 };

  const updateTeamEntry = (team: string, itemKey: string, patch: Partial<GoalEntry>) => {
    const k = goalKey(team, itemKey);
    setTeamGoals((m) => ({ ...m, [k]: { ...(m[k] ?? { mode: "count", count: 0, percent: 0 }), ...patch } }));
    setTeamDirty((d) => { const n = new Set(d); n.add(k); return n; });
  };

  const teamMobileBase = (team: string) => effectiveCount(getTeamEntry(team, MOBILE_KEY), 0);
  const teamCellCount = (team: string, itemKey: string) =>
    effectiveCount(getTeamEntry(team, itemKey), teamMobileBase(team));

  /** 팀 소속 직원들의 항목별 합계 */
  const teamMembersSumFor = (team: string, itemKey: string) =>
    staff
      .filter((s) => (s.team ?? "") === team)
      .reduce((sum, s) => sum + cellCount(s.user_id, itemKey), 0);

  /* Save staff edits */
  const saveStaff = async () => {
    if (dirty.size === 0) { toast.info("변경사항이 없습니다"); return; }
    const rows = Array.from(dirty).map((k) => {
      const [uid, itemKey] = k.split("::");
      const e = goals[k];
      const mobileBase = mobileBaseFor(uid);
      const computed = effectiveCount(e, mobileBase);
      return {
        user_id: uid,
        product: itemKey,
        sale_type: "__all",
        goal_type: "count",
        year_month: yearMonth,
        goal_input_mode: e.mode,
        goal_count: computed, // 비중일 때도 모바일 기준 계산값을 저장 → 대시보드 호환
        goal_percent: e.percent,
        goal_value: 0,
      };
    });
    setSaving(true);
    try {
      const { error } = await supabase
        .from("staff_product_goals")
        .upsert(rows, { onConflict: "user_id,product,sale_type,goal_type,year_month" });
      if (error) throw error;
      toast.success(`${rows.length}개 목표 저장됨`);
      await reload();
    } catch (e: any) {
      toast.error("저장 실패: " + (e.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  /* Save team edits */
  const saveTeam = async () => {
    if (teamDirty.size === 0) { toast.info("변경사항이 없습니다"); return; }
    const rows = Array.from(teamDirty).map((k) => {
      const [team, itemKey] = k.split("::");
      const e = teamGoals[k];
      const base = teamMobileBase(team);
      const computed = effectiveCount(e, base);
      return {
        team,
        product: itemKey,
        sale_type: "__all",
        goal_type: "count",
        year_month: yearMonth,
        goal_input_mode: e.mode,
        goal_count: computed,
        goal_percent: e.percent,
        goal_value: 0,
      };
    });
    setSaving(true);
    try {
      const { error } = await supabase
        .from("team_product_goals")
        .upsert(rows, { onConflict: "team,product,sale_type,goal_type,year_month" });
      if (error) throw error;
      toast.success(`팀 목표 ${rows.length}개 저장됨`);
      await reload();
    } catch (e: any) {
      toast.error("저장 실패: " + (e.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  /* Bulk apply (count only, applied to selected staff) */
  const applyBulk = () => {
    const targets = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (targets.length === 0) { toast.error("적용할 직원을 선택하세요"); return; }
    const newDirty = new Set(dirty);
    setGoals((prev) => {
      const next = { ...prev };
      for (const uid of targets) {
        for (const m of mapping) {
          const v = bulkValues[m.key];
          if (v !== undefined && v !== "") {
            const k = goalKey(uid, m.key);
            const cur = next[k] ?? { mode: "count" as Mode, count: 0, percent: 0 };
            next[k] = { ...cur, mode: "count", count: Math.max(0, parseInt(v, 10) || 0) };
            newDirty.add(k);
          }
        }
      }
      return next;
    });
    setDirty(newDirty);
    setBulkOpen(false);
    toast.success(`${targets.length}명에게 일괄 입력 (저장 버튼을 눌러 저장하세요)`);
  };

  /* Copy from another month */
  const applyCopy = async () => {
    const targets = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    const userScope = targets.length > 0 ? targets : filteredStaff.map((s) => s.user_id);
    const { data } = await supabase
      .from("staff_product_goals")
      .select("user_id, product, goal_count, goal_input_mode, goal_percent")
      .eq("year_month", copyFromYM)
      .eq("goal_type", "count")
      .in("user_id", userScope);
    const newDirty = new Set(dirty);
    setGoals((prev) => {
      const next = { ...prev };
      (data ?? []).forEach((g: any) => {
        const k = goalKey(g.user_id, g.product);
        next[k] = {
          mode: (g.goal_input_mode as Mode) || "count",
          count: Number(g.goal_count ?? 0),
          percent: Number(g.goal_percent ?? 0),
        };
        newDirty.add(k);
      });
      return next;
    });
    setDirty(newDirty);
    setCopyOpen(false);
    toast.success(`${copyFromYM} 데이터 ${(data ?? []).length}건 가져옴 (저장 버튼을 눌러 저장하세요)`);
  };

  /* Templates */
  const saveTemplate = async () => {
    if (!templateName.trim()) { toast.error("이름을 입력하세요"); return; }
    const goalsTpl: Record<string, number> = {};
    for (const m of mapping) {
      const v = bulkValues[m.key];
      if (v && v.trim()) goalsTpl[m.key] = Math.max(0, parseInt(v, 10) || 0);
    }
    const { error } = await supabase.from("staff_goal_templates").insert({
      name: templateName.trim(),
      description: templateDesc.trim() || null,
      goals: goalsTpl,
    });
    if (error) { toast.error("저장 실패: " + error.message); return; }
    toast.success("템플릿 저장됨");
    setTemplateName("");
    setTemplateDesc("");
    setSaveTemplateOpen(false);
    loadTemplates();
  };
  const applyTemplate = (t: TemplateRow) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.goals)) next[k] = String(v);
    setBulkValues(next);
    setTemplatesOpen(false);
    setBulkOpen(true);
    toast.success(`템플릿 [${t.name}] 불러옴`);
  };
  const deleteTemplate = async (id: string) => {
    if (!confirm("이 템플릿을 삭제할까요?")) return;
    const { error } = await supabase.from("staff_goal_templates").delete().eq("id", id);
    if (error) { toast.error("삭제 실패: " + error.message); return; }
    loadTemplates();
  };

  /* Item manager */
  const openItemMgr = () => {
    setDraftItems(mapping.map((m) => ({ ...m, products: [...m.products], sale_types: [...(m.sale_types ?? ["__all"])] })));
    setItemMgrOpen(true);
  };
  const saveItems = async () => {
    // mobile must remain
    const cleaned = draftItems
      .filter((i) => i.label.trim().length > 0)
      .map((i) => ({
        key: i.key || slugify(i.label),
        label: i.label.trim(),
        products: i.products.length > 0 ? i.products : [i.label.trim()],
        sale_types: i.sale_types?.length ? i.sale_types : ["__all"],
      }));
    if (!cleaned.some((i) => i.key === MOBILE_KEY)) {
      toast.error("'모바일' 항목은 비중 계산의 기준이므로 삭제할 수 없습니다");
      return;
    }
    // mobile first
    cleaned.sort((a, b) => (a.key === MOBILE_KEY ? -1 : b.key === MOBILE_KEY ? 1 : 0));
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "staff_goal_mapping", value: { items: cleaned }, description: "직원 목표 항목 매핑" }, { onConflict: "key" });
    if (error) { toast.error("저장 실패: " + error.message); return; }
    toast.success("항목 저장됨");
    setItemMgrOpen(false);
    await loadMapping();
  };

  /* Permission gate */
  if (!roleLoading && !isAdmin && !isManager) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        이 페이지는 관리자/팀장 권한이 필요합니다.
      </Card>
    );
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const allSelected = filteredStaff.length > 0 && filteredStaff.every((s) => selected[s.user_id]);
  const toggleAll = () => {
    if (allSelected) setSelected({});
    else {
      const n: Record<string, boolean> = {};
      filteredStaff.forEach((s) => (n[s.user_id] = true));
      setSelected(n);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="size-5 text-primary-glow" />
        <h1 className="text-xl font-semibold">직원별 목표 셋팅</h1>
        <Badge variant="secondary" className="ml-2">{yearMonth}</Badge>
        <Badge variant="outline" className="ml-1 text-[10px]">
          비중 계산 기준: <b className="ml-1">모바일</b>
        </Badge>
      </div>

      {/* Toolbar */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border mx-1" />

        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="매장" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 매장</SelectItem>
            {stores.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="팀" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 팀</SelectItem>
            {teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative w-56">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·매장·팀 검색" className="pl-9 h-9" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={openItemMgr}>
              <Settings2 className="size-4 mr-1" /> 항목 관리
            </Button>
          )}
          {tab === "staff" && selectedCount > 0 && (
            <Badge variant="outline" className="text-xs">{selectedCount}명 선택</Badge>
          )}
          {tab === "staff" && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setBulkValues({}); setBulkOpen(true); }}>
                <Users className="size-4 mr-1" /> 일괄 적용
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}>
                <Copy className="size-4 mr-1" /> 다른 달 복사
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
                <FolderOpen className="size-4 mr-1" /> 템플릿
              </Button>
              <Button size="sm" onClick={saveStaff} disabled={saving || dirty.size === 0}>
                <Save className="size-4 mr-1" /> 저장 ({dirty.size})
              </Button>
            </>
          )}
          {tab === "team" && (
            <Button size="sm" onClick={saveTeam} disabled={saving || teamDirty.size === 0}>
              <Save className="size-4 mr-1" /> 팀 저장 ({teamDirty.size})
            </Button>
          )}
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="staff"><Users className="size-4 mr-1.5" /> 직원별 셋팅</TabsTrigger>
          <TabsTrigger value="team"><Building2 className="size-4 mr-1.5" /> 팀 통합 목표</TabsTrigger>
        </TabsList>

        {/* ---------------- Staff tab ---------------- */}
        <TabsContent value="staff" className="mt-3">
          <Card className="overflow-hidden">
            {loading ? (
              <div className="p-10 text-center text-muted-foreground text-sm">불러오는 중…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-center w-10">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                      </th>
                      <th className="text-left px-3 py-2">직원</th>
                      <th className="text-left px-3 py-2">팀/매장</th>
                      {mapping.map((m) => (
                        <th key={m.key} className={cn(
                          "text-center px-2 py-2 min-w-[140px]",
                          m.key === MOBILE_KEY && "bg-primary/10",
                        )}>
                          {m.label}
                          {m.key === MOBILE_KEY && (
                            <span className="ml-1 text-[9px] text-primary">(기준)</span>
                          )}
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 bg-primary/5">월 총합</th>
                      <th className="text-right px-3 py-2 bg-emerald-500/5">달성</th>
                      <th className="text-right px-3 py-2 bg-emerald-500/5">달성률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((s) => {
                      const total = totalFor(s.user_id);
                      const ach = achievedFor(s.user_id);
                      const rate = total > 0 ? Math.round((ach / total) * 100) : 0;
                      const mobileBase = mobileBaseFor(s.user_id);
                      return (
                        <tr key={s.user_id} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!selected[s.user_id]}
                              onChange={(e) => setSelected((m) => ({ ...m, [s.user_id]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{s.display_name}</div>
                            <div className="text-xs text-muted-foreground">{s.position ?? "-"}</div>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            <div>{s.team ?? "-"}</div>
                            <div>{s.store ?? "-"}</div>
                          </td>
                          {mapping.map((m) => {
                            const k = goalKey(s.user_id, m.key);
                            const e = getEntry(s.user_id, m.key);
                            const isDirty = dirty.has(k);
                            const isMobile = m.key === MOBILE_KEY;
                            const computed = effectiveCount(e, mobileBase);
                            return (
                              <td key={m.key} className={cn(
                                "px-2 py-1.5 text-center align-top",
                                isMobile && "bg-primary/[0.04]",
                              )}>
                                {/* Mode toggle (모바일은 항상 건수) */}
                                {!isMobile && (
                                  <div className="flex items-center justify-center gap-1 mb-1">
                                    <button
                                      type="button"
                                      onClick={() => updateEntry(s.user_id, m.key, { mode: "count" })}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 transition-colors",
                                        e.mode === "count"
                                          ? "bg-primary/20 text-primary"
                                          : "text-muted-foreground hover:bg-muted",
                                      )}
                                      title="건수로 입력"
                                    >
                                      <Hash className="size-2.5" /> 건수
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateEntry(s.user_id, m.key, { mode: "percent" })}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 transition-colors",
                                        e.mode === "percent"
                                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                          : "text-muted-foreground hover:bg-muted",
                                      )}
                                      title="모바일 목표 대비 비중(%)"
                                    >
                                      <Percent className="size-2.5" /> 비중
                                    </button>
                                  </div>
                                )}
                                {(isMobile || e.mode === "count") ? (
                                  <Input
                                    type="number" min={0}
                                    value={e.count || ""}
                                    onChange={(ev) => updateEntry(s.user_id, m.key, { count: Math.max(0, parseInt(ev.target.value || "0", 10) || 0) })}
                                    className={cn("h-8 w-20 mx-auto text-right tabular-nums", isDirty && "ring-1 ring-primary")}
                                    placeholder="0"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="relative">
                                      <Input
                                        type="number" min={0} max={1000}
                                        value={e.percent || ""}
                                        onChange={(ev) => updateEntry(s.user_id, m.key, { percent: Math.max(0, parseFloat(ev.target.value || "0") || 0) })}
                                        className={cn("h-8 w-20 mx-auto text-right tabular-nums pr-5", isDirty && "ring-1 ring-amber-400")}
                                        placeholder="0"
                                      />
                                      <Percent className="size-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    </div>
                                    <div className="text-[10px] text-muted-foreground/70 italic flex items-center gap-0.5 tabular-nums">
                                      <Calculator className="size-2.5" />
                                      {computed}건
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right tabular-nums font-semibold bg-primary/5">{total}</td>
                          <td className="px-3 py-2 text-right tabular-nums bg-emerald-500/5">{ach}</td>
                          <td className="px-3 py-2 text-right tabular-nums bg-emerald-500/5">
                            <span className={
                              rate >= 100 ? "text-emerald-600 font-bold" :
                              rate >= 70 ? "text-amber-600 font-semibold" :
                              "text-muted-foreground"
                            }>
                              {total > 0 ? `${rate}%` : "-"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStaff.length === 0 && (
                      <tr><td colSpan={mapping.length + 6} className="text-center py-10 text-muted-foreground text-sm">결과 없음</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ---------------- Team tab ---------------- */}
        <TabsContent value="team" className="mt-3 space-y-4">
          {teams.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              등록된 팀이 없습니다. 직원 프로필에서 [팀] 값을 설정하면 여기에 나타납니다.
            </Card>
          ) : teams.map((team) => {
            const mobileBase = teamMobileBase(team);
            const teamTotal = mapping.reduce((s, m) => s + teamCellCount(team, m.key), 0);
            const membersTotal = mapping.reduce((s, m) => s + teamMembersSumFor(team, m.key), 0);
            const ratio = teamTotal > 0 ? Math.min(100, Math.round((membersTotal / teamTotal) * 100)) : 0;
            const overshoot = teamTotal > 0 && membersTotal > teamTotal;
            return (
              <Card key={team} className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary-glow" />
                    <h2 className="font-semibold">{team}</h2>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    팀원 {staff.filter((s) => (s.team ?? "") === team).length}명
                  </Badge>
                  <div className="flex-1 min-w-[200px] max-w-md ml-auto">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">팀 합계 vs 팀 목표</span>
                      <span className="tabular-nums">
                        <span className={overshoot ? "text-amber-500 font-semibold" : "font-semibold"}>{membersTotal}</span>
                        <span className="text-muted-foreground"> / {teamTotal}</span>
                        <span className="ml-2 text-muted-foreground">({ratio}%)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          overshoot ? "bg-amber-500" : ratio >= 100 ? "bg-emerald-500" : "bg-primary",
                        )}
                        style={{ width: `${Math.min(100, teamTotal > 0 ? (membersTotal / teamTotal) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/40 text-xs text-muted-foreground">
                        <th className="text-left px-3 py-2 w-32">구분</th>
                        {mapping.map((m) => (
                          <th key={m.key} className={cn(
                            "text-center px-2 py-2 min-w-[140px]",
                            m.key === MOBILE_KEY && "bg-primary/10",
                          )}>
                            {m.label}
                            {m.key === MOBILE_KEY && <span className="ml-1 text-[9px] text-primary">(기준)</span>}
                          </th>
                        ))}
                        <th className="text-right px-3 py-2 bg-primary/5">총합</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 팀 목표 입력 행 */}
                      <tr className="border-b border-border/30">
                        <td className="px-3 py-2 font-semibold text-primary">팀 목표</td>
                        {mapping.map((m) => {
                          const k = goalKey(team, m.key);
                          const e = getTeamEntry(team, m.key);
                          const isDirty = teamDirty.has(k);
                          const isMobile = m.key === MOBILE_KEY;
                          const computed = effectiveCount(e, mobileBase);
                          return (
                            <td key={m.key} className={cn(
                              "px-2 py-1.5 text-center align-top",
                              isMobile && "bg-primary/[0.04]",
                            )}>
                              {!isMobile && (
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <button
                                    type="button"
                                    onClick={() => updateTeamEntry(team, m.key, { mode: "count" })}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 transition-colors",
                                      e.mode === "count" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted",
                                    )}
                                  >
                                    <Hash className="size-2.5" /> 건수
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateTeamEntry(team, m.key, { mode: "percent" })}
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[9px] flex items-center gap-0.5 transition-colors",
                                      e.mode === "percent" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "text-muted-foreground hover:bg-muted",
                                    )}
                                  >
                                    <Percent className="size-2.5" /> 비중
                                  </button>
                                </div>
                              )}
                              {(isMobile || e.mode === "count") ? (
                                <Input
                                  type="number" min={0}
                                  value={e.count || ""}
                                  onChange={(ev) => updateTeamEntry(team, m.key, { count: Math.max(0, parseInt(ev.target.value || "0", 10) || 0) })}
                                  className={cn("h-8 w-20 mx-auto text-right tabular-nums", isDirty && "ring-1 ring-primary")}
                                  placeholder="0"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="relative">
                                    <Input
                                      type="number" min={0} max={1000}
                                      value={e.percent || ""}
                                      onChange={(ev) => updateTeamEntry(team, m.key, { percent: Math.max(0, parseFloat(ev.target.value || "0") || 0) })}
                                      className={cn("h-8 w-20 mx-auto text-right tabular-nums pr-5", isDirty && "ring-1 ring-amber-400")}
                                      placeholder="0"
                                    />
                                    <Percent className="size-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                  </div>
                                  <div className="text-[10px] text-muted-foreground/70 italic flex items-center gap-0.5 tabular-nums">
                                    <Calculator className="size-2.5" />
                                    {computed}건
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right tabular-nums font-bold bg-primary/5">{teamTotal}</td>
                      </tr>
                      {/* 팀원 합계 행 */}
                      <tr className="bg-muted/20">
                        <td className="px-3 py-2 text-xs text-muted-foreground">팀원 합계</td>
                        {mapping.map((m) => {
                          const sum = teamMembersSumFor(team, m.key);
                          const goal = teamCellCount(team, m.key);
                          const ratio2 = goal > 0 ? Math.round((sum / goal) * 100) : 0;
                          return (
                            <td key={m.key} className="px-2 py-2 text-center text-xs">
                              <div className="tabular-nums">{sum}</div>
                              {goal > 0 && (
                                <div className={cn(
                                  "text-[10px]",
                                  sum >= goal ? "text-emerald-500" :
                                  sum >= goal * 0.8 ? "text-amber-500" : "text-muted-foreground",
                                )}>
                                  {ratio2}%
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{membersTotal}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Bulk apply dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>선택 직원 일괄 적용 (건수)</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              선택된 직원: <strong>{selectedCount}명</strong>
            </div>
            <div className="space-y-2">
              {mapping.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <label className="w-32 text-sm">{m.label}</label>
                  <Input
                    type="number" min={0}
                    placeholder="비우면 변경 안함"
                    value={bulkValues[m.key] ?? ""}
                    onChange={(e) => setBulkValues((p) => ({ ...p, [m.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground pt-2">
              ※ 일괄 적용은 [건수] 모드로 입력됩니다. 비중(%)은 셀에서 개별 설정해주세요.
            </div>
          </div>
          <DialogFooter>
            {isAdmin && (
              <Button variant="outline" onClick={() => { setSaveTemplateOpen(true); }}>
                <BookmarkPlus className="size-4 mr-1" /> 템플릿으로 저장
              </Button>
            )}
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>취소</Button>
            <Button onClick={applyBulk} disabled={selectedCount === 0}>적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>다른 달 목표 복사</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <strong>{copyFromYM}</strong> → <strong>{yearMonth}</strong>
            </div>
            <Input
              type="month" value={copyFromYM}
              onChange={(e) => setCopyFromYM(e.target.value)}
            />
            <div className="text-xs text-muted-foreground">
              {selectedCount > 0
                ? `선택된 ${selectedCount}명에게만 복사됩니다.`
                : "직원을 선택하지 않으면 현재 필터 결과 전원에게 복사됩니다."}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCopyOpen(false)}>취소</Button>
            <Button onClick={applyCopy}>복사</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Templates dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>목표 템플릿</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {templates.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                저장된 템플릿이 없습니다.
              </div>
            )}
            {templates.map((t) => (
              <div key={t.id} className="border rounded-lg p-3 flex items-start gap-2">
                <div className="flex-1">
                  <div className="font-medium">{t.name}</div>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(t.goals).map(([k, v]) => {
                      const label = mapping.find((m) => m.key === k)?.label ?? k;
                      return <Badge key={k} variant="outline" className="text-[10px]">{label} {v}</Badge>;
                    })}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => applyTemplate(t)}>불러오기</Button>
                {isAdmin && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTemplate(t.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Save template dialog */}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>현재 값을 템플릿으로 저장</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Input placeholder="템플릿 이름" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <Textarea placeholder="설명 (선택)" value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveTemplateOpen(false)}>취소</Button>
            <Button onClick={saveTemplate}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item manager dialog */}
      <Dialog open={itemMgrOpen} onOpenChange={setItemMgrOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>목표 항목 관리</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <div className="text-xs text-muted-foreground">
              항목명과 매칭할 상품 키워드(쉼표 구분)를 입력하세요. <b>모바일</b>은 비중 계산의 기준이므로 삭제할 수 없습니다.
            </div>
            {draftItems.map((it, idx) => {
              const isMobile = it.key === MOBILE_KEY;
              return (
                <div key={idx} className="border rounded-lg p-2 grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-3 h-8"
                    placeholder="항목명"
                    value={it.label}
                    onChange={(e) => setDraftItems((arr) => {
                      const n = [...arr];
                      n[idx] = { ...n[idx], label: e.target.value, key: isMobile ? MOBILE_KEY : (n[idx].key || slugify(e.target.value)) };
                      return n;
                    })}
                  />
                  <Input
                    className="col-span-7 h-8"
                    placeholder="매칭 키워드 (쉼표 구분, 예: 갤럭시 S26, S26)"
                    value={it.products.join(", ")}
                    onChange={(e) => setDraftItems((arr) => {
                      const n = [...arr];
                      n[idx] = { ...n[idx], products: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                      return n;
                    })}
                  />
                  <div className="col-span-2 flex justify-end">
                    {isMobile ? (
                      <Badge variant="secondary" className="text-[10px]">기준 항목</Badge>
                    ) : (
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => setDraftItems((arr) => arr.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            <Button
              variant="outline" size="sm" className="w-full"
              onClick={() => setDraftItems((arr) => [...arr, { key: "", label: "", products: [], sale_types: ["__all"] }])}
            >
              <Plus className="size-4 mr-1" /> 항목 추가
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemMgrOpen(false)}>취소</Button>
            <Button onClick={saveItems}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
