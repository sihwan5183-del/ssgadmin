import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Link2, Package } from "lucide-react";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useFieldOptions } from "@/hooks/useFieldOptions";

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
}

export default function ProductRatePlansPage() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { options: PRODUCTS } = useFieldOptions("product");
  const { options: RATE_PLANS } = useFieldOptions("rate_plan");
  const { options: SALE_TYPES } = useFieldOptions("sale_type");

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [activeProduct, setActiveProduct] = useState<string>("");
  const [newPlan, setNewPlan] = useState<string>("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div>
      <Header
        title="상품-요금제 매핑 관리"
        subtitle="가입상품을 선택했을 때 실적 입력 화면에 표시될 요금제를 지정합니다"
        showScopeToggle={false}
      />

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
          {activeProduct && filtered.length > 0 && (
            <div className="mb-6 p-4 rounded-xl border border-border/40 bg-muted/20">
              <h4 className="text-sm font-semibold mb-3">📋 {activeProduct} 기본 설정</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">기본 판매유형</Label>
                  <Select
                    value={firstRow?.default_sale_type ?? ""}
                    onValueChange={(v) => saveDefaults("default_sale_type", v || null)}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="미설정" /></SelectTrigger>
                    <SelectContent>
                      {SALE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">기본 부가서비스 1</Label>
                  <Input
                    value={firstRow?.default_vas1 ?? ""}
                    onChange={(e) => saveDefaults("default_vas1", e.target.value || null)}
                    placeholder="예: 주셋톱"
                    className="h-9"
                  />
                </div>
                <div>
                  <Label className="text-xs">기본 부가서비스 2</Label>
                  <Input
                    value={firstRow?.default_vas2 ?? ""}
                    onChange={(e) => saveDefaults("default_vas2", e.target.value || null)}
                    placeholder="예: 부셋톱"
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
              filtered.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    m.active
                      ? "border-border bg-card"
                      : "border-dashed border-border/50 bg-muted/30 opacity-60"
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                  <span className="flex-1 font-medium text-sm">{m.rate_plan}</span>
                  {!m.active && (
                    <Badge variant="outline" className="text-[10px]">
                      비활성
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => toggle(m)} className="text-xs">
                    {m.active ? "숨기기" : "사용"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(m.id)} className="size-8">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
