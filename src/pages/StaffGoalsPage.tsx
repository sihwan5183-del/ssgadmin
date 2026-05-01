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
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/useRole";
import { useStores } from "@/hooks/useStores";
import { toast } from "sonner";
import { Save, Copy, Users, BookmarkPlus, FolderOpen, Trash2, Search, Target } from "lucide-react";

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

interface GoalRow {
  user_id: string;
  product: string;
  sale_type: string;
  goal_type: string;
  year_month: string;
  goal_count: number;
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

const goalKey = (uid: string, itemKey: string) => `${uid}::${itemKey}`;

/* Map sales rows to mapping items based on product list */
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
  const [goalsMap, setGoalsMap] = useState<Record<string, number>>({}); // key=user::item
  const [achievedMap, setAchievedMap] = useState<Record<string, number>>({}); // 실적 카운트
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [bulkValues, setBulkValues] = useState<Record<string, string>>({});
  const [copyFromYM, setCopyFromYM] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const yearMonth = useMemo(() => `${year}-${String(month).padStart(2, "0")}`, [year, month]);

  /* Load mapping rule from app_settings */
  const loadMapping = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "staff_goal_mapping")
      .maybeSingle();
    const items = ((data?.value as any)?.items ?? []) as MappingItem[];
    setMapping(items);
  }, []);

  /* Load staff + goals + achievement */
  const reload = useCallback(async () => {
    setLoading(true);
    const monthStart = `${yearMonth}-01`;
    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    const [{ data: profs }, { data: goals }, { data: salesRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, display_name, team, store, position, status")
        .neq("status", "deleted")
        .neq("status", "resigned")
        .order("display_name", { ascending: true }),
      supabase
        .from("staff_product_goals")
        .select("user_id, product, sale_type, goal_type, year_month, goal_count")
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
    const gm: Record<string, number> = {};
    (goals ?? []).forEach((g: any) => {
      // product field stores mapping item key (e.g. "mobile")
      gm[goalKey(g.user_id, g.product)] = g.goal_count;
    });
    setGoalsMap(gm);
    setEdits({});
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

  /* Cell helpers */
  const getValue = (uid: string, itemKey: string): number => {
    const k = goalKey(uid, itemKey);
    if (edits[k] !== undefined) return Math.max(0, parseInt(edits[k] || "0", 10) || 0);
    return goalsMap[k] ?? 0;
  };
  const setValue = (uid: string, itemKey: string, v: string) => {
    setEdits((m) => ({ ...m, [goalKey(uid, itemKey)]: v }));
  };
  const totalFor = (uid: string) => mapping.reduce((sum, m) => sum + getValue(uid, m.key), 0);
  const achievedFor = (uid: string) => mapping.reduce((sum, m) => sum + (achievedMap[goalKey(uid, m.key)] ?? 0), 0);

  /* Save all edits */
  const saveAll = async () => {
    const rows = Object.entries(edits)
      .map(([k, v]) => {
        const [uid, itemKey] = k.split("::");
        return {
          user_id: uid,
          product: itemKey,
          sale_type: "__all",
          goal_type: "count",
          year_month: yearMonth,
          goal_count: Math.max(0, parseInt(v || "0", 10) || 0),
          goal_value: 0,
        };
      });
    if (rows.length === 0) {
      toast.info("변경사항이 없습니다");
      return;
    }
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

  /* Bulk apply */
  const applyBulk = () => {
    const targets = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (targets.length === 0) { toast.error("적용할 직원을 선택하세요"); return; }
    const next = { ...edits };
    for (const uid of targets) {
      for (const m of mapping) {
        const v = bulkValues[m.key];
        if (v !== undefined && v !== "") next[goalKey(uid, m.key)] = v;
      }
    }
    setEdits(next);
    setBulkOpen(false);
    toast.success(`${targets.length}명에게 일괄 입력 (저장 버튼을 눌러 저장하세요)`);
  };

  /* Copy from another month */
  const applyCopy = async () => {
    const targets = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    const userScope = targets.length > 0 ? targets : filteredStaff.map((s) => s.user_id);
    const { data } = await supabase
      .from("staff_product_goals")
      .select("user_id, product, goal_count")
      .eq("year_month", copyFromYM)
      .eq("goal_type", "count")
      .in("user_id", userScope);
    const next = { ...edits };
    let cnt = 0;
    (data ?? []).forEach((g: any) => {
      next[goalKey(g.user_id, g.product)] = String(g.goal_count);
      cnt++;
    });
    setEdits(next);
    setCopyOpen(false);
    toast.success(`${copyFromYM} 데이터 ${cnt}건 가져옴 (저장 버튼을 눌러 저장하세요)`);
  };

  /* Templates */
  const saveTemplate = async () => {
    if (!templateName.trim()) { toast.error("이름을 입력하세요"); return; }
    const goals: Record<string, number> = {};
    for (const m of mapping) {
      const v = bulkValues[m.key];
      if (v && v.trim()) goals[m.key] = Math.max(0, parseInt(v, 10) || 0);
    }
    const { error } = await supabase.from("staff_goal_templates").insert({
      name: templateName.trim(),
      description: templateDesc.trim() || null,
      goals,
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
    toast.success(`템플릿 [${t.name}] 불러옴 — 일괄 적용 화면에서 직원을 선택하세요`);
  };
  const deleteTemplate = async (id: string) => {
    if (!confirm("이 템플릿을 삭제할까요?")) return;
    const { error } = await supabase.from("staff_goal_templates").delete().eq("id", id);
    if (error) { toast.error("삭제 실패: " + error.message); return; }
    loadTemplates();
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
          {selectedCount > 0 && (
            <Badge variant="outline" className="text-xs">{selectedCount}명 선택</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => { setBulkValues({}); setBulkOpen(true); }}>
            <Users className="size-4 mr-1" /> 일괄 적용
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}>
            <Copy className="size-4 mr-1" /> 다른 달 복사
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTemplatesOpen(true)}>
            <FolderOpen className="size-4 mr-1" /> 템플릿
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving || Object.keys(edits).length === 0}>
            <Save className="size-4 mr-1" /> 저장 ({Object.keys(edits).length})
          </Button>
        </div>
      </Card>

      {/* Table */}
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
                    <th key={m.key} className="text-center px-2 py-2 min-w-[110px]">{m.label}</th>
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
                        const v = edits[k] !== undefined ? edits[k] : String(goalsMap[k] ?? 0);
                        const dirty = edits[k] !== undefined;
                        return (
                          <td key={m.key} className="px-2 py-1.5 text-center">
                            <Input
                              type="number" min={0}
                              value={v}
                              onChange={(e) => setValue(s.user_id, m.key, e.target.value)}
                              className={`h-8 w-20 mx-auto text-right tabular-nums ${dirty ? "ring-1 ring-primary" : ""}`}
                            />
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

      {/* Bulk apply dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>선택 직원 일괄 적용</DialogTitle></DialogHeader>
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
              ※ 비어있는 항목은 기존 값을 유지합니다.
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
                저장된 템플릿이 없습니다. 일괄 적용 창에서 [템플릿으로 저장]을 눌러 만들 수 있습니다.
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
    </div>
  );
}