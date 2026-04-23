import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/ui/money-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, Plus, Trash2, Save, Calendar, Sparkles, ChevronDown, ChevronUp, Layers, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIncentiveRates } from "@/hooks/useIncentiveRates";
import { SALE_TYPES, PRODUCTS } from "@/data/salesOptions";
import { useDeviceModels } from "@/hooks/useDeviceModels";
import { toast } from "sonner";
import type { TieredStep, LinkageRule } from "@/lib/incentiveEngine";
import { DEFAULT_LINKAGE } from "@/lib/incentiveEngine";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Wifi, ShieldCheck } from "lucide-react";

const NONE = "__none";

interface DraftRow {
  id?: string;
  label: string;
  match_sale_type: string | null;
  match_product: string | null;
  match_model: string | null;
  amount: number;
  priority: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  note: string | null;
  pay_type: "fixed" | "percent";
  pay_percent: number;
  tiered_rates: TieredStep[];
  grade_bonus: Record<string, number>;
  isNew?: boolean;
  dirty?: boolean;
}

const DEFAULT_GRADES = ["매장장", "부매장장", "사원", "인턴"];

export function IncentiveRatesManager() {
  const { user } = useAuth();
  const { rates, refresh } = useIncentiveRates();
  const { models } = useDeviceModels();

  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows: DraftRow[] = [
    ...rates.map((r) => drafts[r.id] ?? {
      id: r.id,
      label: r.label,
      match_sale_type: r.match_sale_type,
      match_product: r.match_product,
      match_model: r.match_model,
      amount: Number(r.amount),
      priority: r.priority,
      active: r.active,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      note: r.note,
      pay_type: (r.pay_type as "fixed" | "percent") || "fixed",
      pay_percent: Number(r.pay_percent || 0),
      tiered_rates: Array.isArray(r.tiered_rates) ? r.tiered_rates : [],
      grade_bonus: (r.grade_bonus && typeof r.grade_bonus === "object" && !Array.isArray(r.grade_bonus)) ? r.grade_bonus as Record<string, number> : {},
    }),
    ...Object.values(drafts).filter((d) => d.isNew),
  ];

  const addDraft = (preset?: Partial<DraftRow>) => {
    const tmpId = "new_" + Math.random().toString(36).slice(2, 9);
    setDrafts((d) => ({
      ...d,
      [tmpId]: {
        id: tmpId,
        label: preset?.label ?? "신규 인센티브",
        match_sale_type: preset?.match_sale_type ?? null,
        match_product: preset?.match_product ?? null,
        match_model: preset?.match_model ?? null,
        amount: preset?.amount ?? 0,
        priority: preset?.priority ?? 0,
        active: preset?.active ?? true,
        valid_from: preset?.valid_from ?? null,
        valid_to: preset?.valid_to ?? null,
        note: preset?.note ?? null,
        pay_type: preset?.pay_type ?? "fixed",
        pay_percent: preset?.pay_percent ?? 0,
        tiered_rates: preset?.tiered_rates ?? [],
        grade_bonus: preset?.grade_bonus ?? {},
        isNew: true,
        dirty: true,
      },
    }));
  };

  const updateDraft = (id: string, patch: Partial<DraftRow>) => {
    setDrafts((d) => {
      const base = d[id] ?? rows.find((r) => r.id === id);
      if (!base) return d;
      return { ...d, [id]: { ...base, ...patch, dirty: true } };
    });
  };

  const saveRow = async (row: DraftRow) => {
    const payload = {
      label: row.label,
      scope: "combo",
      match_sale_type: row.match_sale_type,
      match_product: row.match_product,
      match_model: row.match_model,
      amount: row.amount,
      priority: row.priority,
      active: row.active,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
      note: row.note,
      pay_type: row.pay_type,
      pay_percent: row.pay_percent,
      tiered_rates: JSON.parse(JSON.stringify(row.tiered_rates)),
      grade_bonus: JSON.parse(JSON.stringify(row.grade_bonus)),
    };
    if (row.isNew) {
      const { error } = await supabase.from("incentive_rates").insert({ ...payload, created_by: user?.id } as any);
      if (error) return toast.error("저장 실패: " + error.message);
    } else if (row.id) {
      const { error } = await supabase.from("incentive_rates").update(payload as any).eq("id", row.id);
      if (error) return toast.error("저장 실패: " + error.message);
    }
    toast.success("저장되었습니다");
    setDrafts((d) => { const c = { ...d }; if (row.id) delete c[row.id]; return c; });
    refresh();
  };

  const deleteRow = async (row: DraftRow) => {
    if (row.isNew) {
      setDrafts((d) => { const c = { ...d }; if (row.id) delete c[row.id]; return c; });
      return;
    }
    if (!row.id) return;
    if (!confirm(`'${row.label}' 단가를 삭제할까요?`)) return;
    const { error } = await supabase.from("incentive_rates").delete().eq("id", row.id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("삭제되었습니다");
    refresh();
  };

  /* --- 계단식 단가 helpers --- */
  const addTier = (rowId: string, tiers: TieredStep[]) => {
    const last = tiers.length > 0 ? tiers[tiers.length - 1] : { min_qty: 20, amount: 0 };
    updateDraft(rowId, { tiered_rates: [...tiers, { min_qty: last.min_qty + 10, amount: last.amount + 5000 }] });
  };
  const updateTier = (rowId: string, tiers: TieredStep[], idx: number, patch: Partial<TieredStep>) => {
    const next = tiers.map((t, i) => i === idx ? { ...t, ...patch } : t);
    updateDraft(rowId, { tiered_rates: next });
  };
  const removeTier = (rowId: string, tiers: TieredStep[], idx: number) => {
    updateDraft(rowId, { tiered_rates: tiers.filter((_, i) => i !== idx) });
  };

  /* --- 그레이드 보너스 helpers --- */
  const updateGrade = (rowId: string, gb: Record<string, number>, grade: string, amount: number) => {
    updateDraft(rowId, { grade_bonus: { ...gb, [grade]: amount } });
  };

  return (
    <Card className="p-6 glass space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Coins className="size-4 text-amber-400" /> 인센티브 단가 마스터
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            가입유형·상품·모델별 인센티브를 설정합니다. 계단식 단가, 정률(%) 지급, 그레이드 보너스를 지원합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => addDraft({ label: "주간 프로모션", priority: 10, valid_from: new Date().toISOString().slice(0, 10) })}>
            <Sparkles className="size-4 mr-1" /> 프로모션
          </Button>
          <Button variant="outline" size="sm" onClick={() => addDraft({ label: "계단식 MNP", match_sale_type: "번호이동", tiered_rates: [{ min_qty: 30, amount: 10000 }, { min_qty: 40, amount: 15000 }, { min_qty: 50, amount: 20000 }] })}>
            <Layers className="size-4 mr-1" /> 계단식
          </Button>
          <Button size="sm" onClick={() => addDraft()}>
            <Plus className="size-4 mr-1" /> 단가 추가
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="min-w-[140px]">규칙명</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>상품</TableHead>
              <TableHead>지급방식</TableHead>
              <TableHead className="text-right min-w-[120px]">단가/비율</TableHead>
              <TableHead>유효기간</TableHead>
              <TableHead className="text-center">활성</TableHead>
              <TableHead className="text-right">동작</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">등록된 인센티브 단가가 없습니다.</TableCell></TableRow>
            ) : rows.map((row) => {
              const isExpanded = expandedId === row.id;
              const hasTiers = row.tiered_rates.length > 0;
              const hasGrade = Object.values(row.grade_bonus).some(v => v > 0);
              return (
                <TableRow key={row.id} className={row.dirty ? "bg-amber-500/5" : ""}>
                  <TableCell colSpan={9} className="p-0">
                    {/* Main row */}
                    <div className="flex items-center gap-0 px-2 py-1.5">
                      <button onClick={() => setExpandedId(isExpanded ? null : row.id!)} className="p-1 text-muted-foreground hover:text-foreground">
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                      <div className="flex-1 grid grid-cols-[140px_110px_110px_100px_120px_1fr_50px_auto] items-center gap-2">
                        <Input value={row.label} onChange={(e) => updateDraft(row.id!, { label: e.target.value })} className="h-8 text-xs" />
                        <Select value={row.match_sale_type ?? NONE} onValueChange={(v) => updateDraft(row.id!, { match_sale_type: v === NONE ? null : v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>전체</SelectItem>
                            {SALE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={row.match_product ?? NONE} onValueChange={(v) => updateDraft(row.id!, { match_product: v === NONE ? null : v })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>전체</SelectItem>
                            {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={row.pay_type} onValueChange={(v) => updateDraft(row.id!, { pay_type: v as "fixed" | "percent" })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">정액(₩)</SelectItem>
                            <SelectItem value="percent">정률(%)</SelectItem>
                          </SelectContent>
                        </Select>
                        {row.pay_type === "fixed" ? (
                          <MoneyInput value={row.amount} onChange={(v) => updateDraft(row.id!, { amount: v })} className="h-8 text-xs" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <Input type="number" value={row.pay_percent} onChange={(e) => updateDraft(row.id!, { pay_percent: Number(e.target.value) })} className="h-8 text-xs w-16" step="0.1" min={0} max={100} />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Input type="date" value={row.valid_from ?? ""} onChange={(e) => updateDraft(row.id!, { valid_from: e.target.value || null })} className="h-8 text-xs w-[120px]" />
                          <span className="text-muted-foreground text-xs">~</span>
                          <Input type="date" value={row.valid_to ?? ""} onChange={(e) => updateDraft(row.id!, { valid_to: e.target.value || null })} className="h-8 text-xs w-[120px]" />
                        </div>
                        <Switch checked={row.active} onCheckedChange={(v) => updateDraft(row.id!, { active: v })} />
                        <div className="flex gap-1">
                          {(row.dirty || row.isNew) && (
                            <Button size="sm" variant="default" onClick={() => saveRow(row)} className="h-7 text-xs px-2">
                              <Save className="size-3 mr-1" /> 저장
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteRow(row)} className="h-7 text-destructive hover:text-destructive px-1.5">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    {!isExpanded && (hasTiers || hasGrade) && (
                      <div className="flex gap-1.5 px-10 pb-1.5">
                        {hasTiers && <Badge variant="outline" className="text-[10px] h-5 border-blue-400/50 text-blue-400"><Layers className="size-2.5 mr-1" /> 계단식 {row.tiered_rates.length}구간</Badge>}
                        {hasGrade && <Badge variant="outline" className="text-[10px] h-5 border-purple-400/50 text-purple-400"><Award className="size-2.5 mr-1" /> 그레이드 보너스</Badge>}
                      </div>
                    )}

                    {/* Expanded detail panel */}
                    {isExpanded && (
                      <div className="bg-muted/30 border-t border-border/30 px-10 py-4 space-y-4">
                        {/* 모델 매칭 + 메모 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">모델 매칭</label>
                            <Select value={row.match_model ?? NONE} onValueChange={(v) => updateDraft(row.id!, { match_model: v === NONE ? null : v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>전체 모델</SelectItem>
                                {models.map((m) => <SelectItem key={m.id} value={m.model_name}>{m.model_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">우선순위</label>
                            <Input type="number" value={row.priority} onChange={(e) => updateDraft(row.id!, { priority: Number(e.target.value) })} className="h-8 text-xs" />
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">메모</label>
                            <Input value={row.note ?? ""} onChange={(e) => updateDraft(row.id!, { note: e.target.value || null })} className="h-8 text-xs" placeholder="비고" />
                          </div>
                        </div>

                        {/* 계단식 단가 */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Layers className="size-3.5 text-blue-400" />
                            <span className="text-xs font-semibold">계단식 단가 (실적 구간별 차등)</span>
                            <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => addTier(row.id!, row.tiered_rates)}>
                              <Plus className="size-3 mr-0.5" /> 구간 추가
                            </Button>
                          </div>
                          {row.tiered_rates.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">구간이 없으면 기본 단가가 적용됩니다.</p>
                          ) : (
                            <div className="grid gap-1.5">
                              {row.tiered_rates.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-1.5">
                                  <span className="text-[11px] text-muted-foreground w-12">구간 {i + 1}</span>
                                  <Input type="number" value={t.min_qty} onChange={(e) => updateTier(row.id!, row.tiered_rates, i, { min_qty: Number(e.target.value) })} className="h-7 text-xs w-20" />
                                  <span className="text-[11px] text-muted-foreground">건 이상 →</span>
                                  <MoneyInput value={t.amount} onChange={(v) => updateTier(row.id!, row.tiered_rates, i, { amount: v })} className="h-7 text-xs w-28" />
                                  <Button variant="ghost" size="sm" className="h-6 px-1 text-destructive" onClick={() => removeTier(row.id!, row.tiered_rates, i)}>
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 그레이드 보너스 */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="size-3.5 text-purple-400" />
                            <span className="text-xs font-semibold">그레이드별 추가 보너스</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {DEFAULT_GRADES.map((g) => (
                              <div key={g} className="flex items-center gap-1.5 bg-background/60 rounded-lg px-3 py-1.5">
                                <span className="text-[11px] text-muted-foreground min-w-[50px]">{g}</span>
                                <MoneyInput value={row.grade_bonus[g] ?? 0} onChange={(v) => updateGrade(row.id!, row.grade_bonus, g, v)} className="h-7 text-xs flex-1" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="border-amber-400 text-amber-400"><Calendar className="size-3 mr-1" /> 유효기간 미설정 = 상시</Badge>
        <Badge variant="outline">중복 매칭 시 합산</Badge>
        <Badge variant="outline" className="border-blue-400/60 text-blue-400"><Layers className="size-3 mr-1" /> 계단식: 월말 건수 기준 구간 단가 적용</Badge>
        <Badge variant="outline" className="border-purple-400/60 text-purple-400"><Award className="size-3 mr-1" /> 그레이드: 직급별 추가 지원금</Badge>
      </div>

      {/* === 인터넷 연동 지급률 설정 === */}
      <LinkageConfigPanel />
    </Card>
  );
}

function LinkageConfigPanel() {
  const { linkageRule, upsert } = useAppSettings();
  const [local, setLocal] = useState<LinkageRule>(linkageRule);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocal(linkageRule);
    setDirty(false);
  }, [JSON.stringify(linkageRule)]);

  const update = (patch: Partial<LinkageRule>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const updateTier = (idx: number, patch: Partial<{ min_qty: number; rate: number }>) => {
    const tiers = local.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    update({ tiers });
  };

  const addTier = () => {
    const last = local.tiers[local.tiers.length - 1];
    update({ tiers: [...local.tiers, { min_qty: (last?.min_qty ?? 0) + 1, rate: 100 }] });
  };

  const removeTier = (idx: number) => {
    update({ tiers: local.tiers.filter((_, i) => i !== idx) });
  };

  const toggleGrade = (grade: string) => {
    const list = local.exempt_grades.includes(grade)
      ? local.exempt_grades.filter((g) => g !== grade)
      : [...local.exempt_grades, grade];
    update({ exempt_grades: list });
  };

  const save = async () => {
    const { error } = await upsert("incentive.linkage", local);
    if (error) toast.error("저장 실패");
    else { toast.success("인터넷 연동 설정 저장"); setDirty(false); }
  };

  return (
    <Card className="p-5 border-cyan-500/20 bg-cyan-500/5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Wifi className="size-4 text-cyan-400" /> 인터넷 연동 지급률 (모바일 인센티브 조건부 적용)
        </h4>
        <Switch checked={local.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>

      {local.enabled && (
        <>
          <p className="text-xs text-muted-foreground">
            개인별 인터넷 개통 건수에 따라 해당 월 모바일 인센티브의 최종 지급 비율을 차등 적용합니다.
            모바일 구간 단가가 계산된 후 마지막 단계에서 이 비율이 곱해집니다.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span>인터넷 건수별 지급률</span>
              <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={addTier}>
                <Plus className="size-3 mr-0.5" /> 구간 추가
              </Button>
            </div>
            {local.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 bg-background/60 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-muted-foreground">인터넷</span>
                <Input
                  type="number"
                  value={t.min_qty}
                  onChange={(e) => updateTier(i, { min_qty: Number(e.target.value) })}
                  className="h-7 text-xs w-16"
                  min={0}
                />
                <span className="text-[11px] text-muted-foreground">건 이상 →</span>
                <Input
                  type="number"
                  value={t.rate}
                  onChange={(e) => updateTier(i, { rate: Number(e.target.value) })}
                  className="h-7 text-xs w-16"
                  min={0}
                  max={200}
                />
                <span className="text-[11px] text-muted-foreground">%</span>
                {local.tiers.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-6 px-1 text-destructive" onClick={() => removeTier(i)}>
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* 예외 그레이드 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              <span>예외 직급 (항상 100% 지급)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGrade(g)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                    local.exempt_grades.includes(g)
                      ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-400"
                      : "border-border/50 text-muted-foreground hover:border-border"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save}>
            <Save className="size-3.5 mr-1" /> 연동 설정 저장
          </Button>
        </div>
      )}
    </Card>
  );
}
