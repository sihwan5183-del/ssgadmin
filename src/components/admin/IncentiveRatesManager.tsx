import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Coins, Plus, Trash2, Save, ChevronDown, ChevronUp,
  Layers, Wifi, ShieldCheck, Eye, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIncentivePolicies } from "@/hooks/useIncentivePolicies";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { useAppSettings } from "@/hooks/useAppSettings";
import { usePeriod } from "@/contexts/PeriodContext";
import { toast } from "sonner";
import type { PolicyTier, LinkageRule, IncentivePolicy, SaleForIncentive } from "@/lib/incentiveEngine";
import { DEFAULT_LINKAGE, calcFullIncentive } from "@/lib/incentiveEngine";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const DEFAULT_GRADES = ["매장장", "부매장장", "사원", "인턴"];

interface DraftPolicy {
  id: string;
  name: string;
  target_sale_types: string[];
  target_products: string[];
  tiers: PolicyTier[];
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  note: string | null;
  calc_method: "tiered" | "margin_100" | "fixed_amount";
  fixed_amount: number;
  match_model: string | null;
  isNew?: boolean;
  dirty?: boolean;
  bundle_only: boolean;
  no_offer_only: boolean;
}

function formatKRW(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만원`;
  return `${n.toLocaleString()}원`;
}

export function IncentiveRatesManager() {
  const { user } = useAuth();
  const { policies, refresh } = useIncentivePolicies();
  const { options: saleTypeOpts } = useFieldOptions("sale_type");
  const { options: productOpts } = useFieldOptions("product");
  const { linkageRule, upsert } = useAppSettings();

  const saleTypes = saleTypeOpts as string[];
  const products = productOpts as string[];

  const [drafts, setDrafts] = useState<Record<string, DraftPolicy>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSim, setShowSim] = useState(false);

  const rows: DraftPolicy[] = [
    ...policies.map((p) => drafts[p.id] ?? { ...p, bundle_only: (p as any).bundle_only ?? false, no_offer_only: (p as any).no_offer_only ?? false }),
    ...Object.values(drafts).filter((d) => d.isNew),
  ];

  const addPolicy = () => {
    const tmpId = "new_" + Math.random().toString(36).slice(2, 9);
    setDrafts((d) => ({
      ...d,
      [tmpId]: {
        id: tmpId,
        name: "새 인센티브 정책",
        target_sale_types: [],
        target_products: [],
        tiers: [
          { min_qty: 0, max_qty: 30, amount: 0 },
          { min_qty: 30, max_qty: 40, amount: 10000 },
          { min_qty: 40, max_qty: 50, amount: 15000 },
          { min_qty: 50, max_qty: null, amount: 20000 },
        ],
        active: true,
        valid_from: null,
        valid_to: null,
        note: null,
        calc_method: "tiered",
        fixed_amount: 0,
        match_model: null,
        isNew: true,
        dirty: true,
        bundle_only: false,
        no_offer_only: false,
      },
    }));
  };

  const updatePolicy = (id: string, patch: Partial<DraftPolicy>) => {
    setDrafts((d) => {
      const base = d[id] ?? rows.find((r) => r.id === id);
      if (!base) return d;
      return { ...d, [id]: { ...base, ...patch, dirty: true } };
    });
  };

  const toggleItem = (id: string, field: "target_sale_types" | "target_products", value: string) => {
    const row = drafts[id] ?? rows.find((r) => r.id === id);
    if (!row) return;
    const list = row[field];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    updatePolicy(id, { [field]: next });
  };

  const addTier = (id: string) => {
    const row = drafts[id] ?? rows.find((r) => r.id === id);
    if (!row) return;
    const tiers = row.tiers;
    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].max_qty ?? tiers[tiers.length - 1].min_qty + 10) : 10;
    // Convert last tier to bounded
    const updated = tiers.map((t, i) =>
      i === tiers.length - 1 && t.max_qty === null ? { ...t, max_qty: lastMax } : t
    );
    updatePolicy(id, { tiers: [...updated, { min_qty: lastMax, max_qty: null, amount: (tiers[tiers.length - 1]?.amount ?? 0) + 5000 }] });
  };

  const updateTier = (id: string, idx: number, patch: Partial<PolicyTier>) => {
    const row = drafts[id] ?? rows.find((r) => r.id === id);
    if (!row) return;
    const tiers = row.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    updatePolicy(id, { tiers });
  };

  const removeTier = (id: string, idx: number) => {
    const row = drafts[id] ?? rows.find((r) => r.id === id);
    if (!row) return;
    updatePolicy(id, { tiers: row.tiers.filter((_, i) => i !== idx) });
  };

  const savePolicy = async (row: DraftPolicy) => {
    const payload = {
      name: row.name,
      target_sale_types: row.target_sale_types,
      target_products: row.target_products,
      tiers: JSON.parse(JSON.stringify(row.tiers)),
      active: row.active,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
      note: row.note,
      calc_method: row.calc_method,
      fixed_amount: row.fixed_amount,
      match_model: row.match_model,
      bundle_only: row.bundle_only,
      no_offer_only: row.no_offer_only,
    };
    if (row.isNew) {
      const { error } = await supabase.from("incentive_policies").insert({ ...payload, created_by: user?.id } as any);
      if (error) return toast.error("저장 실패: " + error.message);
    } else {
      const { error } = await supabase.from("incentive_policies").update(payload as any).eq("id", row.id);
      if (error) return toast.error("저장 실패: " + error.message);
    }
    toast.success("정책이 저장되었습니다");
    setDrafts((d) => { const c = { ...d }; delete c[row.id]; return c; });
    refresh();
  };

  const deletePolicy = async (row: DraftPolicy) => {
    if (row.isNew) {
      setDrafts((d) => { const c = { ...d }; delete c[row.id]; return c; });
      return;
    }
    if (!confirm(`'${row.name}' 정책을 삭제할까요?`)) return;
    const { error } = await supabase.from("incentive_policies").delete().eq("id", row.id);
    if (error) return toast.error("삭제 실패");
    toast.success("삭제됨");
    refresh();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="p-6 glass space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Coins className="size-4 text-amber-400" /> 인센티브 정책 빌더
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              대상 항목을 체크하고, 실적 구간별 단가를 자유롭게 설정하세요. 여러 정책을 동시에 운영할 수 있습니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSim(!showSim)}>
              <Eye className="size-4 mr-1" /> {showSim ? "시뮬레이션 닫기" : "시뮬레이션"}
            </Button>
            <Button size="sm" onClick={addPolicy}>
              <Plus className="size-4 mr-1" /> 정책 추가
            </Button>
          </div>
        </div>

        {/* Policy cards */}
        {rows.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            등록된 인센티브 정책이 없습니다. '정책 추가' 버튼을 눌러 시작하세요.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <div
                  key={row.id}
                  className={`rounded-xl border transition-colors ${
                    row.dirty ? "border-amber-400/40 bg-amber-500/5" : "border-border/40 bg-background/40"
                  }`}
                >
                  {/* Collapsed header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => setExpandedId(isExpanded ? null : row.id)} className="text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <Input
                            value={row.name}
                            onChange={(e) => updatePolicy(row.id, { name: e.target.value })}
                            className="h-8 text-sm font-semibold max-w-[250px]"
                          />
                        ) : (
                          <span className="font-semibold text-sm truncate">{row.name}</span>
                        )}
                        {!row.active && <Badge variant="secondary" className="text-[10px]">비활성</Badge>}
                        <Badge variant="outline" className="text-[10px]">{CALC_METHOD_LABEL[row.calc_method] ?? "구간제"}</Badge>
                        {row.bundle_only && <Badge className="text-[10px] bg-violet-500/20 text-violet-400 border-violet-500/30">동판전용</Badge>}
                        {row.no_offer_only && <Badge className="text-[10px] bg-rose-500/20 text-rose-400 border-rose-500/30">무오퍼전용</Badge>}
                      </div>
                      {!isExpanded && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {row.target_sale_types.map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px] h-4">{t}</Badge>
                          ))}
                          {row.target_products.map((p) => (
                            <Badge key={p} variant="outline" className="text-[10px] h-4 border-primary/30 text-primary">{p}</Badge>
                          ))}
                          <Badge variant="outline" className="text-[10px] h-4">
                            <Layers className="size-2.5 mr-0.5" /> {row.tiers.length}구간
                          </Badge>
                        </div>
                      )}
                    </div>
                    <Switch checked={row.active} onCheckedChange={(v) => updatePolicy(row.id, { active: v })} />
                    <div className="flex gap-1">
                      {(row.dirty || row.isNew) && (
                        <Button size="sm" onClick={() => savePolicy(row)} className="h-7 text-xs px-2">
                          <Save className="size-3 mr-1" /> 저장
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => deletePolicy(row)} className="h-7 text-destructive hover:text-destructive px-1.5">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border/30 px-6 py-5 space-y-5">
                      {/* 유효기간 + 메모 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* 조건부 필터 토글 */}
                        <div className="md:col-span-3 flex flex-wrap gap-6 bg-muted/20 rounded-lg px-4 py-3 border border-border/30">
                          <div className="flex items-center gap-2">
                            <Switch checked={row.bundle_only} onCheckedChange={(v) => updatePolicy(row.id, { bundle_only: v })} />
                            <div>
                              <span className="text-xs font-medium">동판/번들 전용</span>
                              <p className="text-[10px] text-muted-foreground">ON 시 동판/번들 건만 인센티브 계산</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={row.no_offer_only} onCheckedChange={(v) => updatePolicy(row.id, { no_offer_only: v })} />
                            <div>
                              <span className="text-xs font-medium">무오퍼 전용</span>
                              <p className="text-[10px] text-muted-foreground">ON 시 무오퍼 건만 인센티브 계산</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">유효 시작일</label>
                          <Input type="date" value={row.valid_from ?? ""} onChange={(e) => updatePolicy(row.id, { valid_from: e.target.value || null })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">유효 종료일</label>
                          <Input type="date" value={row.valid_to ?? ""} onChange={(e) => updatePolicy(row.id, { valid_to: e.target.value || null })} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">메모</label>
                          <Input value={row.note ?? ""} onChange={(e) => updatePolicy(row.id, { note: e.target.value || null })} className="h-8 text-xs" placeholder="예: 4월 본부 프로모션" />
                        </div>
                      </div>

                      {/* 대상 항목 체크박스 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-secondary" /> 판매유형 (체크한 항목만 합산)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {saleTypes.map((st) => (
                              <label key={st} className="flex items-center gap-1.5 cursor-pointer">
                                <Checkbox
                                  checked={row.target_sale_types.includes(st)}
                                  onCheckedChange={() => toggleItem(row.id, "target_sale_types", st)}
                                />
                                <span className="text-xs">{st}</span>
                              </label>
                            ))}
                          </div>
                          {row.target_sale_types.length === 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">미선택 시 모든 판매유형 포함</p>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-primary" /> 가입상품 (체크한 항목만 합산)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {products.map((p) => (
                              <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                                <Checkbox
                                  checked={row.target_products.includes(p)}
                                  onCheckedChange={() => toggleItem(row.id, "target_products", p)}
                                />
                                <span className="text-xs">{p}</span>
                              </label>
                            ))}
                          </div>
                          {row.target_products.length === 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">미선택 시 모든 상품 포함</p>
                          )}
                        </div>
                      </div>

                      {/* 구간 설정 */}
                      {/* 계산 방식 선택 */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <Coins className="size-3.5 text-amber-400" /> 계산 방식 선택
                        </h4>
                        <RadioGroup
                          value={row.calc_method}
                          onValueChange={(v) => updatePolicy(row.id, { calc_method: v as any })}
                          className="flex flex-wrap gap-4"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="tiered" id={`${row.id}-tiered`} />
                            <Label htmlFor={`${row.id}-tiered`} className="text-xs cursor-pointer">구간 합산 단가</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="margin_100" id={`${row.id}-margin`} />
                            <Label htmlFor={`${row.id}-margin`} className="text-xs cursor-pointer">순마진 100% 지급</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="fixed_amount" id={`${row.id}-fixed`} />
                            <Label htmlFor={`${row.id}-fixed`} className="text-xs cursor-pointer">고정 금액 지급</Label>
                          </div>
                        </RadioGroup>
                        {row.calc_method === "fixed_amount" && (
                          <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 max-w-xs">
                            <span className="text-[11px] text-muted-foreground">건당 고정 금액:</span>
                            <MoneyInput value={row.fixed_amount} onChange={(v) => updatePolicy(row.id, { fixed_amount: v })} className="h-7 text-xs w-32" />
                          </div>
                        )}
                        {row.calc_method === "margin_100" && (
                          <p className="text-[11px] text-muted-foreground bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                            매칭되는 각 건의 순수익(net_fee)을 100% 인센티브로 책정합니다.
                          </p>
                        )}
                      </div>

                      {/* 특정 모델 매칭 */}
                      <div className="max-w-xs">
                        <label className="text-[11px] text-muted-foreground mb-1 block">특정 모델 매칭 (선택사항)</label>
                        <Input
                          value={row.match_model ?? ""}
                          onChange={(e) => updatePolicy(row.id, { match_model: e.target.value || null })}
                          className="h-8 text-xs"
                          placeholder="예: 아이폰15 (비워두면 전체)"
                        />
                      </div>

                      {/* 구간 설정 - only for tiered */}
                      {row.calc_method === "tiered" && <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Layers className="size-3.5 text-primary" />
                          <span className="text-xs font-semibold">실적 구간별 단가 설정</span>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => addTier(row.id)}>
                            <Plus className="size-3 mr-0.5" /> 구간 추가
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {row.tiers.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                              <span className="text-[11px] text-muted-foreground font-medium w-14">구간 {i + 1}</span>
                              <Input
                                type="number"
                                value={t.min_qty}
                                onChange={(e) => updateTier(row.id, i, { min_qty: Number(e.target.value) })}
                                className="h-7 text-xs w-16"
                                min={0}
                              />
                              <span className="text-[11px] text-muted-foreground">건 이상</span>
                              {t.max_qty !== null ? (
                                <>
                                  <span className="text-[11px] text-muted-foreground">~</span>
                                  <Input
                                    type="number"
                                    value={t.max_qty}
                                    onChange={(e) => updateTier(row.id, i, { max_qty: Number(e.target.value) || null })}
                                    className="h-7 text-xs w-16"
                                    min={0}
                                  />
                                  <span className="text-[11px] text-muted-foreground">건 미만</span>
                                </>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">(이상)</span>
                              )}
                              <span className="text-[11px] text-muted-foreground ml-2">→ 건당</span>
                              <MoneyInput
                                value={t.amount}
                                onChange={(v) => updateTier(row.id, i, { amount: v })}
                                className="h-7 text-xs w-28"
                              />
                              {row.tiers.length > 1 && (
                                <Button variant="ghost" size="sm" className="h-6 px-1 text-destructive" onClick={() => removeTier(row.id, i)}>
                                  <Trash2 className="size-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 인터넷 연동 설정 */}
      <LinkageConfigPanel linkageRule={linkageRule} upsert={upsert} />

      {/* 시뮬레이션 */}
      {showSim && <SimulationPanel policies={rows.filter((r) => !r.isNew || r.dirty)} linkageRule={linkageRule} />}
    </div>
  );
}

/* ===== 인터넷 연동 지급률 설정 패널 ===== */
function LinkageConfigPanel({ linkageRule, upsert }: { linkageRule: LinkageRule; upsert: (k: string, v: any) => Promise<{ error: any }> }) {
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

  const removeTier = (idx: number) => update({ tiers: local.tiers.filter((_, i) => i !== idx) });

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
    <Card className="p-5 glass border-primary/20 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Wifi className="size-4 text-primary" /> 개인별 조건부 비율 연동 (인터넷 → 모바일)
        </h4>
        <Switch checked={local.enabled} onCheckedChange={(v) => update({ enabled: v })} />
      </div>

      {local.enabled && (
        <>
          <p className="text-xs text-muted-foreground">
            위 정책으로 계산된 모바일 인센티브에, 개인별 인터넷 건수 기준 비율을 최종 곱합니다.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span>인터넷 건수별 지급률</span>
              <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={addTier}>
                <Plus className="size-3 mr-0.5" /> 추가
              </Button>
            </div>
            {local.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5">
                <span className="text-[11px] text-muted-foreground">인터넷</span>
                <Input type="number" value={t.min_qty} onChange={(e) => updateTier(i, { min_qty: Number(e.target.value) })} className="h-7 text-xs w-16" min={0} />
                <span className="text-[11px] text-muted-foreground">건 이상 →</span>
                <Input type="number" value={t.rate} onChange={(e) => updateTier(i, { rate: Number(e.target.value) })} className="h-7 text-xs w-16" min={0} max={200} />
                <span className="text-[11px] text-muted-foreground">%</span>
                {local.tiers.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-6 px-1 text-destructive" onClick={() => removeTier(i)}>
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>예외 직급 (항상 100%)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_GRADES.map((g) => (
                <button key={g} onClick={() => toggleGrade(g)} className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                  local.exempt_grades.includes(g) ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500" : "border-border/50 text-muted-foreground hover:border-border"
                }`}>{g}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {dirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save}><Save className="size-3.5 mr-1" /> 연동 설정 저장</Button>
        </div>
      )}
    </Card>
  );
}

const CALC_METHOD_LABEL: Record<string, string> = { tiered: "구간제", margin_100: "마진100%", fixed_amount: "고정액" };

/* ===== 시뮬레이션 패널 ===== */
function SimulationPanel({ policies, linkageRule }: { policies: DraftPolicy[]; linkageRule: LinkageRule }) {
  const period = usePeriod();
  const [staffData, setStaffData] = useState<{ userId: string; name: string; sales: SaleForIncentive[]; position: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: salesData }, { data: profiles }] = await Promise.all([
        supabase
          .from("sales")
          .select("id, open_date, device_model, product, sale_type, net_fee, customer_name, created_by, bundle, custom_fields")
          .gte("open_date", period.startDate)
          .lte("open_date", period.endDate),
        supabase.from("profiles").select("user_id, display_name, position").eq("status", "active"),
      ]);

      const byUser = new Map<string, SaleForIncentive[]>();
      for (const s of salesData ?? []) {
        const uid = (s as any).created_by;
        if (!byUser.has(uid)) byUser.set(uid, []);
        const cf = (s as any).custom_fields ?? {};
        byUser.get(uid)!.push({
          ...(s as any),
          bundle: (s as any).bundle ?? null,
          has_offer: cf.has_offer !== false,
        } as SaleForIncentive);
      }

      const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, { name: p.display_name, position: p.position }]));

      const result = Array.from(byUser.entries()).map(([uid, sales]) => ({
        userId: uid,
        name: nameMap.get(uid)?.name ?? uid.slice(0, 8),
        position: nameMap.get(uid)?.position ?? null,
        sales,
      }));

      setStaffData(result.sort((a, b) => b.sales.length - a.sales.length));
      setLoading(false);
    })();
  }, [period.startDate, period.endDate]);

  const results = useMemo(() => {
    return staffData.map((staff) => {
      const internetCount = staff.sales.filter(
        (s) => (s.product ?? "").includes("인터넷") || (s.product ?? "").includes("홈")
      ).length;

      const calc = calcFullIncentive(
        staff.sales,
        policies as IncentivePolicy[],
        linkageRule,
        internetCount,
        staff.position,
      );

      return { ...staff, internetCount, calc };
    });
  }, [staffData, policies, linkageRule]);

  return (
    <Card className="p-5 glass space-y-4">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Users className="size-4 text-primary" /> 직원별 인센티브 시뮬레이션 ({period.label})
      </h4>
      {loading ? (
        <div className="text-center text-muted-foreground py-4 text-sm">데이터 로딩 중...</div>
      ) : results.length === 0 ? (
        <div className="text-center text-muted-foreground py-4 text-sm">해당 기간에 실적이 없습니다.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground border-b border-border/50">
              <tr>
                <th className="text-left py-2 font-medium">직원</th>
                <th className="text-right py-2 font-medium">총 실적</th>
                <th className="text-right py-2 font-medium">인터넷</th>
                <th className="text-right py-2 font-medium">연동률</th>
                {policies.filter((p) => p.active).map((p) => (
                  <th key={p.id} className="text-right py-2 font-medium max-w-[100px] truncate">{p.name}</th>
                ))}
                <th className="text-right py-2 font-medium">구간제</th>
                <th className="text-right py-2 font-medium">마진100%</th>
                <th className="text-right py-2 font-medium">고정액</th>
                <th className="text-right py-2 font-semibold">최종 인센티브</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.userId} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="py-2 font-medium">
                    {r.name}
                    {r.position && <span className="text-muted-foreground ml-1">({r.position})</span>}
                  </td>
                  <td className="py-2 text-right">{r.sales.length}건</td>
                  <td className="py-2 text-right">{r.internetCount}건</td>
                  <td className={`py-2 text-right font-semibold ${r.calc.linkageRate === 100 ? "text-emerald-500" : r.calc.linkageRate > 0 ? "text-amber-500" : "text-destructive"}`}>
                    {r.calc.linkageRate}%
                  </td>
                  {policies.filter((p) => p.active).map((p) => {
                    const pr = r.calc.policyResults.find((x) => x.policyId === p.id);
                    return (
                      <td key={p.id} className="py-2 text-right text-muted-foreground">
                        {pr ? (
                          pr.calcMethod === "margin_100"
                            ? `${pr.matchedCount}건 마진 ${formatKRW(pr.subtotal)}`
                            : `${pr.matchedCount}건 × ${formatKRW(pr.tierAmount)}`
                        ) : "-"}
                      </td>
                    );
                  })}
                  {(() => {
                    const byMethod: Record<string, number> = { tiered: 0, margin_100: 0, fixed_amount: 0 };
                    r.calc.policyResults.forEach((pr) => { byMethod[pr.calcMethod] = (byMethod[pr.calcMethod] || 0) + pr.subtotal; });
                    return (
                      <>
                        <td className="py-2 text-right text-muted-foreground">{byMethod.tiered ? formatKRW(byMethod.tiered) : "-"}</td>
                        <td className="py-2 text-right text-muted-foreground">{byMethod.margin_100 ? formatKRW(byMethod.margin_100) : "-"}</td>
                        <td className="py-2 text-right text-muted-foreground">{byMethod.fixed_amount ? formatKRW(byMethod.fixed_amount) : "-"}</td>
                      </>
                    );
                  })()}
                  <td className="py-2 text-right font-bold text-foreground">{formatKRW(r.calc.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border/50">
              <tr>
                <td className="py-2 font-semibold">합계</td>
                <td className="py-2 text-right font-semibold">{results.reduce((s, r) => s + r.sales.length, 0)}건</td>
                <td colSpan={2 + policies.filter((p) => p.active).length} />
                <td colSpan={3} />
                <td className="py-2 text-right font-bold text-lg">
                  {formatKRW(results.reduce((s, r) => s + r.calc.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
