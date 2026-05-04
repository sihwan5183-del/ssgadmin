import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Link2, Package, Tag, Layers, Sparkles } from "lucide-react";
import { SortableList, SortableItem } from "@/components/common/SortableList";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useFieldOptions } from "@/hooks/useFieldOptions";
import { isVasEligibleProduct } from "@/hooks/useProductRatePlans";

interface Mapping {
  id: string;
  product: string;
  rate_plan: string;
  sort_order: number;
  active: boolean;
  default_sale_type: string | null;
  default_vas1: string | null;
  default_vas2: string | null;
  vas1_duration: number | null;
  vas2_duration: number | null;
  allowed_sale_types: string[];
  vas_required: boolean;
  vas1_locked: boolean;
  vas2_locked: boolean;
  linked_vas: string[];
}

export default function ProductRatePlansPage() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { options: PRODUCTS } = useFieldOptions("product");
  const { options: RATE_PLANS, refresh: refreshRatePlans } = useFieldOptions("rate_plan");
  const { options: SALE_TYPES, refresh: refreshSaleTypes } = useFieldOptions("sale_type");

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [activeProduct, setActiveProduct] = useState<string>("");
  const [newPlan, setNewPlan] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [newRatePlanName, setNewRatePlanName] = useState("");
  const [newSaleTypeName, setNewSaleTypeName] = useState("");
  const [showManager, setShowManager] = useState<"none" | "rate_plan" | "sale_type">("none");

  // Master rows for rate_plan / sale_type to support edit/delete/reorder
  const [ratePlanRows, setRatePlanRows] = useState<Array<{ id: string; value: string; sort_order: number; active: boolean }>>([]);
  const [saleTypeRows, setSaleTypeRows] = useState<Array<{ id: string; value: string; sort_order: number; active: boolean }>>([]);

  const loadOptionRows = async (field: "rate_plan" | "sale_type") => {
    const { data, error } = await supabase
      .from("field_options")
      .select("id, value, sort_order, active")
      .eq("field", field)
      .order("sort_order", { ascending: true });
    if (error) { toast.error(error.message); return; }
    if (field === "rate_plan") setRatePlanRows((data ?? []) as any);
    else setSaleTypeRows((data ?? []) as any);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_rate_plans")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    else setMappings((data ?? []) as Mapping[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadOptionRows("rate_plan");
    loadOptionRows("sale_type");
  }, []);

  useEffect(() => {
    if (!activeProduct && PRODUCTS.length) setActiveProduct(PRODUCTS[0]);
  }, [PRODUCTS, activeProduct]);

  const filtered = useMemo(
    () => mappings.filter((m) => m.product === activeProduct),
    [mappings, activeProduct]
  );

  const availableToAdd = useMemo(
    () => RATE_PLANS.filter((p) => !filtered.some((m) => m.rate_plan === p)),
    [RATE_PLANS, filtered]
  );

  const productCounts = useMemo(() => {
    const c: Record<string, number> = {};
    mappings.forEach((m) => {
      if (m.active) c[m.product] = (c[m.product] ?? 0) + 1;
    });
    return c;
  }, [mappings]);

  const add = async () => {
    if (!newPlan || !activeProduct || !user) return;
    const maxOrder = filtered.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase.from("product_rate_plans").insert({
      product: activeProduct,
      rate_plan: newPlan,
      sort_order: maxOrder + 1,
      created_by: user.id,
    });
    if (error) toast.error("저장 실패: " + error.message);
    else {
      toast.success("매핑이 추가되었습니다");
      setNewPlan("");
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 매핑을 삭제할까요?")) return;
    const { error } = await supabase.from("product_rate_plans").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("삭제되었습니다");
      load();
    }
  };

  const toggle = async (m: Mapping) => {
    const { error } = await supabase
      .from("product_rate_plans")
      .update({ active: !m.active })
      .eq("id", m.id);
    if (error) toast.error(error.message);
    else load();
  };

  // ===== 부가서비스 풀: product가 '부가서비스' / 'VAS' 를 포함하는 매핑의 rate_plan 합집합 =====
  // NOTE: hooks must run before any early return — keep this above the role guards below.
  const vasPool = useMemo(() => {
    return Array.from(new Set(
      mappings
        .filter((m) => m.active && (m.product.includes("부가서비스") || m.product.toUpperCase().includes("VAS")))
        .map((m) => m.rate_plan),
    ));
  }, [mappings]);

  if (roleLoading) {
    return <div className="p-8 text-muted-foreground">권한 확인 중...</div>;
  }

  if (!isAdmin) {
    return (
      <div>
        <Header title="접근 권한 없음" subtitle="관리자만 접근할 수 있습니다" showScopeToggle={false} />
      </div>
    );
  }

  // ===== 마스터 옵션(요금제 / 판매유형) 관리 =====
  const addMasterOption = async (field: "rate_plan" | "sale_type", value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !user) return;
    const rows = field === "rate_plan" ? ratePlanRows : saleTypeRows;
    if (rows.some((r) => r.value === trimmed)) {
      toast.error("이미 동일한 이름이 존재합니다");
      return;
    }
    const maxOrder = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
    const { error } = await supabase.from("field_options").insert({
      field,
      value: trimmed,
      sort_order: maxOrder + 1,
      created_by: user.id,
    });
    if (error) { toast.error("저장 실패: " + error.message); return; }
    toast.success("추가되었습니다 (실적 입력창에 즉시 반영)");
    if (field === "rate_plan") { setNewRatePlanName(""); refreshRatePlans(); }
    else { setNewSaleTypeName(""); refreshSaleTypes(); }
    loadOptionRows(field);
  };

  const removeMasterOption = async (field: "rate_plan" | "sale_type", id: string, value: string) => {
    if (!confirm(`'${value}' 항목을 삭제할까요?\n과거 입력된 실적 데이터는 그대로 보존됩니다.`)) return;
    const { error } = await supabase.from("field_options").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("삭제되었습니다");
    if (field === "rate_plan") refreshRatePlans(); else refreshSaleTypes();
    loadOptionRows(field);
  };

  const toggleMasterOption = async (field: "rate_plan" | "sale_type", id: string, active: boolean) => {
    const { error } = await supabase.from("field_options").update({ active: !active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (field === "rate_plan") refreshRatePlans(); else refreshSaleTypes();
    loadOptionRows(field);
  };

  const reorderMasterOptions = async (
    field: "rate_plan" | "sale_type",
    newRows: Array<{ id: string; value: string; sort_order: number; active: boolean }>,
  ) => {
    const reindexed = newRows.map((r, i) => ({ ...r, sort_order: i + 1 }));
    if (field === "rate_plan") setRatePlanRows(reindexed);
    else setSaleTypeRows(reindexed);
    const updates = await Promise.all(
      reindexed.map((r) =>
        supabase.from("field_options").update({ sort_order: r.sort_order }).eq("id", r.id),
      ),
    );
    if (updates.some((u) => u.error)) {
      toast.error("순서 저장 실패");
      loadOptionRows(field);
    } else {
      toast.success("순서가 저장되었습니다");
      if (field === "rate_plan") refreshRatePlans(); else refreshSaleTypes();
    }
  };

  // ===== 매핑 순서 변경 (드래그 앤 드롭) =====
  const reorderMappings = async (newItems: Mapping[]) => {
    const reindexed = newItems.map((m, i) => ({ ...m, sort_order: i + 1 }));
    // Optimistic: replace filtered items inside mappings
    setMappings((prev) => {
      const others = prev.filter((p) => p.product !== activeProduct);
      return [...others, ...reindexed];
    });
    const updates = await Promise.all(
      reindexed.map((m) =>
        supabase.from("product_rate_plans").update({ sort_order: m.sort_order }).eq("id", m.id),
      ),
    );
    if (updates.some((u) => u.error)) {
      toast.error("순서 저장 실패");
      load();
    } else {
      toast.success("순서가 저장되었습니다");
    }
  };

  // Save product-level defaults on the first mapping row
  const saveDefaults = async (field: string, value: any) => {
    if (!activeProduct || filtered.length === 0) return;
    // Update all mappings for this product
    const ids = filtered.map((m) => m.id);
    const { error } = await supabase
      .from("product_rate_plans")
      .update({ [field]: value } as any)
      .in("id", ids);
    if (error) toast.error(error.message);
    else load();
  };

  const firstRow = filtered[0] as Mapping | undefined;
  const vasEnabled = isVasEligibleProduct(activeProduct);

  const toggleLinkedVas = async (mapping: Mapping, vas: string) => {
    const current = Array.isArray(mapping.linked_vas) ? mapping.linked_vas : [];
    const next = current.includes(vas)
      ? current.filter((v) => v !== vas)
      : [...current, vas];
    // Optimistic UI
    setMappings((prev) => prev.map((m) => (m.id === mapping.id ? { ...m, linked_vas: next } : m)));
    const { error } = await supabase
      .from("product_rate_plans")
      .update({ linked_vas: next } as any)
      .eq("id", mapping.id);
    if (error) {
      toast.error("부가서비스 저장 실패: " + error.message);
      load();
    }
  };

  return (
    <div>
      <Header
        title="상품-요금제 매핑 관리"
        subtitle="가입상품을 선택했을 때 실적 입력 화면에 표시될 요금제를 지정합니다"
        showScopeToggle={false}
      />

      {/* 마스터 옵션 관리: 요금제 / 판매유형 추가·삭제·순서 변경 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 요금제 마스터 */}
        <Card className="p-4 glass">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-primary" />
              <span className="text-sm font-semibold">요금제 마스터</span>
              <Badge variant="outline" className="text-[10px]">{ratePlanRows.length}개</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowManager(showManager === "rate_plan" ? "none" : "rate_plan")}
            >
              {showManager === "rate_plan" ? "접기" : "펼치기"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="새 요금제 이름 (예: 5G 프리미어)"
              value={newRatePlanName}
              onChange={(e) => setNewRatePlanName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMasterOption("rate_plan", newRatePlanName)}
              className="h-9"
            />
            <Button
              size="sm"
              onClick={() => addMasterOption("rate_plan", newRatePlanName)}
              disabled={!newRatePlanName.trim()}
              className="gap-1 shrink-0"
            >
              <Plus className="size-3.5" /> 추가
            </Button>
          </div>
          {showManager === "rate_plan" && (
            <div className="mt-3 space-y-1 max-h-72 overflow-y-auto pr-1">
              {ratePlanRows.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">등록된 요금제가 없습니다</div>
              ) : (
                <SortableList items={ratePlanRows} onReorder={(n) => reorderMasterOptions("rate_plan", n)}>
                  {(r, i) => (
                    <SortableItem
                      key={r.id}
                      id={r.id}
                      className={`flex items-center gap-1 p-2 rounded border text-sm ${r.active ? "border-border bg-card" : "border-dashed opacity-60"}`}
                    >
                      <span className="text-[10px] text-muted-foreground w-5 text-right">{i + 1}</span>
                      <span className="flex-1 truncate">{r.value}</span>
                      <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => toggleMasterOption("rate_plan", r.id, r.active)}>
                        {r.active ? "숨김" : "사용"}
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => removeMasterOption("rate_plan", r.id, r.value)}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </SortableItem>
                  )}
                </SortableList>
              )}
            </div>
          )}
        </Card>

        {/* 판매유형 마스터 */}
        <Card className="p-4 glass">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <span className="text-sm font-semibold">판매유형 마스터</span>
              <Badge variant="outline" className="text-[10px]">{saleTypeRows.length}개</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setShowManager(showManager === "sale_type" ? "none" : "sale_type")}
            >
              {showManager === "sale_type" ? "접기" : "펼치기"}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="새 판매유형 (예: MNP, 신규, 기변)"
              value={newSaleTypeName}
              onChange={(e) => setNewSaleTypeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMasterOption("sale_type", newSaleTypeName)}
              className="h-9"
            />
            <Button
              size="sm"
              onClick={() => addMasterOption("sale_type", newSaleTypeName)}
              disabled={!newSaleTypeName.trim()}
              className="gap-1 shrink-0"
            >
              <Plus className="size-3.5" /> 추가
            </Button>
          </div>
          {showManager === "sale_type" && (
            <div className="mt-3 space-y-1 max-h-72 overflow-y-auto pr-1">
              {saleTypeRows.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">등록된 판매유형이 없습니다</div>
              ) : (
                <SortableList items={saleTypeRows} onReorder={(n) => reorderMasterOptions("sale_type", n)}>
                  {(r, i) => (
                    <SortableItem
                      key={r.id}
                      id={r.id}
                      className={`flex items-center gap-1 p-2 rounded border text-sm ${r.active ? "border-border bg-card" : "border-dashed opacity-60"}`}
                    >
                      <span className="text-[10px] text-muted-foreground w-5 text-right">{i + 1}</span>
                      <span className="flex-1 truncate">{r.value}</span>
                      <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => toggleMasterOption("sale_type", r.id, r.active)}>
                        {r.active ? "숨김" : "사용"}
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => removeMasterOption("sale_type", r.id, r.value)}>
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </SortableItem>
                  )}
                </SortableList>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* 왼쪽: 상품 리스트 */}
        <Card className="p-4 glass h-fit">
          <div className="flex items-center gap-2 mb-3">
            <Package className="size-4 text-primary" />
            <span className="text-sm font-semibold">가입상품</span>
          </div>
          <div className="space-y-1">
            {PRODUCTS.length === 0 && (
              <div className="text-xs text-muted-foreground p-2">
                먼저 '입력 항목 관리'에서 가입상품을 등록하세요
              </div>
            )}
            {PRODUCTS.map((p) => {
              const count = productCounts[p] ?? 0;
              const active = activeProduct === p;
              return (
                <button
                  key={p}
                  onClick={() => setActiveProduct(p)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/60 text-foreground"
                  }`}
                >
                  <span>{p}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      count === 0 ? "border-dashed text-muted-foreground" : "border-primary/40 text-primary"
                    }`}
                  >
                    {count}개
                  </Badge>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 오른쪽: 매핑 편집 */}
        <Card className="p-6 glass">
          {/* 상품 기본값 설정 */}
          {activeProduct && filtered.length > 0 && vasEnabled && (
            <div className="mb-6 p-4 rounded-xl border border-border/40 bg-muted/20">
              <h4 className="text-sm font-semibold mb-3">📋 {activeProduct} 부가서비스 기본 설정 (선택)</h4>
              <p className="text-[11px] text-muted-foreground mb-3">
                요금제별 [연관 부가서비스]를 지정하지 않은 경우 사용되는 폴백 기본값입니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">기본 부가서비스 1</Label>
                  <Input
                    value={firstRow?.default_vas1 ?? ""}
                    onChange={(e) => saveDefaults("default_vas1", e.target.value || null)}
                    placeholder="예: 음악감상서비스"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">기본 부가서비스 2</Label>
                  <Input
                    value={firstRow?.default_vas2 ?? ""}
                    onChange={(e) => saveDefaults("default_vas2", e.target.value || null)}
                    placeholder="예: 데이터팩"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">VAS1 유지기간 (개월)</Label>
                  <Input
                    type="number"
                    value={firstRow?.vas1_duration ?? ""}
                    onChange={(e) => saveDefaults("vas1_duration", e.target.value ? Number(e.target.value) : null)}
                    placeholder="예: 3"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">VAS2 유지기간 (개월)</Label>
                  <Input
                    type="number"
                    value={firstRow?.vas2_duration ?? ""}
                    onChange={(e) => saveDefaults("vas2_duration", e.target.value ? Number(e.target.value) : null)}
                    placeholder="예: 3"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Link2 className="size-4 text-primary" />
                {activeProduct || "—"} 에서 사용할 요금제
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                연결된 요금제가 없으면 입력 화면에서 모든 요금제가 표시됩니다
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="추가할 요금제를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    추가 가능한 요금제가 없습니다
                  </div>
                ) : (
                  availableToAdd.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={!newPlan || !activeProduct} className="gap-2 shrink-0">
              <Plus className="size-4" />
              매핑 추가
            </Button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border/60 rounded-xl">
                <Link2 className="size-6 mx-auto mb-2 opacity-50" />
                연결된 요금제가 없습니다
                <div className="text-[11px] mt-1">위 드롭다운에서 요금제를 선택해 추가하세요</div>
              </div>
            ) : (
              <SortableList items={filtered} onReorder={reorderMappings}>
                {(m, i) => (
                  <SortableItem
                    key={m.id}
                    id={m.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      m.active
                        ? "border-border bg-card"
                        : "border-dashed border-border/50 bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                      <span className="flex-1 font-medium text-sm">{m.rate_plan}</span>
                      {vasEnabled && (m.linked_vas?.length ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                          VAS {m.linked_vas.length}
                        </Badge>
                      )}
                      {!m.active && (
                        <Badge variant="outline" className="text-[10px]">비활성</Badge>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => toggle(m)} className="text-xs">
                        {m.active ? "숨기기" : "사용"}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(m.id)} className="size-8">
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                    {vasEnabled && (
                      <div className="mt-2 pl-9 border-t border-border/30 pt-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="size-3" /> 연관 부가서비스 매핑
                          </Label>
                          <span className="text-[10px] text-muted-foreground">
                            클릭하여 선택/해제
                          </span>
                        </div>
                        {vasPool.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">
                            먼저 가입상품 [부가서비스] 카테고리에 부가서비스 명을 매핑으로 등록해주세요.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {vasPool.map((vas) => {
                              const selected = (m.linked_vas ?? []).includes(vas);
                              return (
                                <button
                                  key={vas}
                                  type="button"
                                  onClick={() => toggleLinkedVas(m, vas)}
                                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                    selected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-background hover:bg-muted text-foreground"
                                  }`}
                                >
                                  {vas}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </SortableItem>
                )}
              </SortableList>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
